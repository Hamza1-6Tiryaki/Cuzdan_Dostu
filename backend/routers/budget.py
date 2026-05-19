"""
routers/budget.py
==================
Bütçe, rapor, sipariş ve AI chat endpoint'leri.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import aiosqlite
from typing import Optional
from pydantic import BaseModel

from database import get_db
from models.schemas import (
    BudceKaydet, BudceYanit, ChatIstek, AjanYanit,
    SepetAnaliz, SiparisUrun, ProfilGuncelle,
    UrunEkle, KuponEkle, FiyatAnalizIstek, FiyatAnalizYanit,
)
from services.auth_service  import mevcut_kullanici
from services.budget_service import budget_service
from services.ai_service     import get_ai_service
from services.privacy_service import privacy_service_olustur

router = APIRouter(prefix="/api", tags=["budget"])
bearer = HTTPBearer(auto_error=False)
privacy = privacy_service_olustur()

import time
_chat_rate_limit: dict[int, float] = {}


async def _auth(credentials, db):
    if not credentials:
        raise HTTPException(401, "Token gerekli.")
    return await mevcut_kullanici(credentials.credentials, db)


# ── Bütçe ────────────────────────────────────────────────────────────────────

@router.post("/butce", response_model=BudceYanit)
async def butce_kaydet(
    istek: BudceKaydet,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    return await budget_service.butce_kaydet(db, k["id"], istek)


@router.get("/butce", response_model=BudceYanit | None)
async def butce_getir(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    return await budget_service.butce_getir(db, k["id"])


# ── Siparişler ────────────────────────────────────────────────────────────────

@router.get("/siparisler")
async def siparisler_listesi(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    async with db.execute(
        "SELECT * FROM siparisler WHERE kullanici_id=? ORDER BY olusturuldu DESC",
        (k["id"],)
    ) as cur:
        rows = await cur.fetchall()
    return {"siparisler": [dict(r) for r in rows]}


class SepetKuponIstek(BaseModel):
    urun_ids: list[int]

class SiparisOlusturRequest(BaseModel):
    urunler: list[SiparisUrun]
    kupon_kodu: Optional[str] = None

@router.post("/sepet/kuponlar")
async def sepet_kuponlari(
    istek: SepetKuponIstek,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    if not istek.urun_ids:
        return {"kuponlar": []}
        
    placeholders = ",".join("?" for _ in istek.urun_ids)
    query = f"""
        SELECT k.kod, k.indirim_yuzde, k.gecerlilik, c.kurum_adi as sirket_adi, c.id as sirket_id
        FROM kuponlar k
        JOIN kullanicilar c ON k.kullanici_id = c.id
        WHERE k.kullanildi = 0 
          AND k.gecerlilik >= date('now')
          AND (c.id IN (SELECT DISTINCT sirket_id FROM urunler WHERE id IN ({placeholders}) AND sirket_id IS NOT NULL)
               OR EXISTS (SELECT 1 FROM urunler WHERE id IN ({placeholders}) AND sirket_id IS NULL))
    """
    async with db.execute(query, istek.urun_ids) as cur:
        rows = await cur.fetchall()
    return {"kuponlar": [dict(r) for r in rows]}


@router.post("/siparisler", status_code=201)
async def siparis_olustur(
    istek: SiparisOlusturRequest,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    
    for u in istek.urunler:
        async with db.execute("SELECT stok_var FROM urunler WHERE id=?", (u.urun_id,)) as cur:
            row = await cur.fetchone()
            if not row or not row["stok_var"]:
                raise HTTPException(400, f"Ürün (ID:{u.urun_id}) stokta yok.")
                
    toplam = sum(u.birim_fiyat * u.adet for u in istek.urunler)
    
    # Apply coupon discount if coupon is provided and valid
    indirim_yuzde = 0
    if istek.kupon_kodu:
        # Validate coupon: unused and not expired
        async with db.execute(
            "SELECT id, kullanici_id, indirim_yuzde FROM kuponlar WHERE kod = ? AND kullanildi = 0 AND gecerlilik >= date('now')",
            (istek.kupon_kodu,)
        ) as cur:
            coupon_row = await cur.fetchone()
        
        if not coupon_row:
            raise HTTPException(400, "Geçersiz veya süresi dolmuş kupon kodu.")
            
        sirket_id = coupon_row["kullanici_id"]
        indirim_yuzde = coupon_row["indirim_yuzde"]
        
        # Verify that this coupon applies to at least one product in this order
        applies = False
        for u in istek.urunler:
            async with db.execute("SELECT sirket_id FROM urunler WHERE id = ?", (u.urun_id,)) as cur:
                prod_row = await cur.fetchone()
            if prod_row and (prod_row["sirket_id"] == sirket_id or prod_row["sirket_id"] is None):
                applies = True
                break
                
        if not applies:
            raise HTTPException(400, "Bu kupon sepetinizdeki ürünler için geçerli değil.")
            
        # Apply discount to the total amount of the order
        toplam = toplam * (1 - indirim_yuzde / 100)
        
        # Mark coupon as used
        await db.execute("UPDATE kuponlar SET kullanildi = 1 WHERE kod = ?", (istek.kupon_kodu,))
        
    await db.execute(
        "INSERT INTO siparisler (kullanici_id, toplam_tutar) VALUES (?,?)",
        (k["id"], toplam)
    )
    await db.commit()
    
    async with db.execute("SELECT last_insert_rowid()") as cur:
        siparis_id = (await cur.fetchone())[0]
        
    for u in istek.urunler:
        await db.execute(
            "INSERT INTO siparis_kalemleri (siparis_id, urun_id, adet, birim_fiyat) VALUES (?,?,?,?)",
            (siparis_id, u.urun_id, u.adet, u.birim_fiyat)
        )
    await db.commit()
    return {"siparis_id": siparis_id, "toplam_tutar": toplam}


# ── Raporlar ─────────────────────────────────────────────────────────────────

@router.get("/rapor/aylik/{yil}/{ay}")
async def aylik_rapor(
    yil: int, ay: int,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    return await budget_service.aylik_rapor(db, k["id"], yil, ay)


@router.get("/rapor/yillik/{yil}")
async def yillik_rapor(
    yil: int,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    return await budget_service.yillik_rapor(db, k["id"], yil)


# ── Profil ───────────────────────────────────────────────────────────────────

@router.get("/profil")
async def profil(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    async with db.execute(
        "SELECT id, kullanici_adi, email, tip, ad_soyad, yas, cinsiyet, telefon_hash, kurum_adi, sirket_kategorisi, aciklama FROM kullanicilar WHERE id=?",
        (k["id"],)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        return {}
    d = dict(row)
    d["telefon"] = d.pop("telefon_hash")
    return d


@router.put("/profil")
async def profil_guncelle(
    istek: ProfilGuncelle,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    
    if istek.kullanici_adi is not None:
        async with db.execute(
            "SELECT id FROM kullanicilar WHERE kullanici_adi = ? AND id != ?",
            (istek.kullanici_adi, k["id"])
        ) as cur:
            row = await cur.fetchone()
            if row:
                raise HTTPException(400, "Bu kullanıcı adı başka bir kullanıcı tarafından alınmış.")

    if istek.email is not None:
        async with db.execute(
            "SELECT id FROM kullanicilar WHERE email = ? AND id != ?",
            (istek.email, k["id"])
        ) as cur:
            row = await cur.fetchone()
            if row:
                raise HTTPException(400, "Bu e-posta adresi başka bir kullanıcı tarafından alınmış.")

    update_parts = []
    params = []
    
    if istek.kullanici_adi is not None:
        update_parts.append("kullanici_adi = ?")
        params.append(istek.kullanici_adi)
    if istek.email is not None:
        update_parts.append("email = ?")
        params.append(istek.email)
    if istek.ad_soyad is not None:
        update_parts.append("ad_soyad = ?")
        params.append(istek.ad_soyad)
    if istek.yas is not None:
        update_parts.append("yas = ?")
        params.append(istek.yas)
    if istek.cinsiyet is not None:
        update_parts.append("cinsiyet = ?")
        params.append(istek.cinsiyet)
    if istek.telefon is not None:
        update_parts.append("telefon_hash = ?")
        params.append(istek.telefon)
    if istek.kurum_adi is not None:
        update_parts.append("kurum_adi = ?")
        params.append(istek.kurum_adi)
    if istek.sirket_kategorisi is not None:
        update_parts.append("sirket_kategorisi = ?")
        params.append(istek.sirket_kategorisi)
    if istek.aciklama is not None:
        update_parts.append("aciklama = ?")
        params.append(istek.aciklama)
        
    if not update_parts:
        raise HTTPException(400, "Güncellenecek alan gönderilmedi.")
        
    params.append(k["id"])
    query = f"UPDATE kullanicilar SET {', '.join(update_parts)} WHERE id = ?"
    
    await db.execute(query, params)
    await db.commit()
    
    async with db.execute(
        "SELECT id, kullanici_adi, email, tip, ad_soyad, yas, cinsiyet, telefon_hash, kurum_adi, sirket_kategorisi, aciklama FROM kullanicilar WHERE id=?",
        (k["id"],)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        return {}
    d = dict(row)
    d["telefon"] = d.pop("telefon_hash")
    return d


# ── AI Chat ───────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=AjanYanit)
async def chat(
    istek: ChatIstek,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k    = await _auth(credentials, db)
    now = time.time()
    if k["id"] in _chat_rate_limit and now - _chat_rate_limit[k["id"]] < 5:
        raise HTTPException(429, "Çok sık istek gönderiyorsunuz. Lütfen biraz bekleyin.")
    _chat_rate_limit[k["id"]] = now
    
    butce = await budget_service.butce_getir(db, k["id"])
    
    # Get current year and month to fetch current monthly spending report
    from datetime import datetime
    simdi = datetime.now()
    rapor = await budget_service.aylik_rapor(db, k["id"], simdi.year, simdi.month)
    
    ai   = get_ai_service()
    return await ai.chat(
        mesaj=istek.mesaj,
        privacy=privacy,
        butce=butce,
        gecmis=istek.gecmis,
        sepet=istek.sepet,
        kullanici_tipi=k["tip"],
        rapor=rapor,
    )


# ── Sepet Analiz ─────────────────────────────────────────────────────────────

@router.post("/sepet/analiz", response_model=AjanYanit)
async def sepet_analiz(
    istek: SepetAnaliz,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k    = await _auth(credentials, db)
    butce = await budget_service.butce_getir(db, k["id"])
    ai   = get_ai_service()
    return await ai.chat(
        mesaj="Sepetimi analiz et ve bütçeme göre öneride bulun.",
        privacy=privacy,
        butce=butce,
        sepet=istek.sepet,
        kullanici_tipi=k["tip"],
    )


# ── Öneriler ─────────────────────────────────────────────────────────────────

@router.get("/oneriler")
async def oneriler(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    # Geçmiş ve favorilere bakarak öneriler
    async with db.execute(
        """SELECT u.* FROM gecmis g JOIN urunler u ON g.urun_id=u.id
           WHERE g.kullanici_id=? ORDER BY g.goruntuleme_sayisi DESC LIMIT 5""",
        (k["id"],)
    ) as cur:
        gecmis = await cur.fetchall()

    async with db.execute(
        """SELECT u.* FROM favoriler f LEFT JOIN urunler u ON f.referans_id=u.id
           WHERE f.kullanici_id=? AND f.tur='urun' LIMIT 5""",
        (k["id"],)
    ) as cur:
        favoriler = await cur.fetchall()

    kategoriler = list({r["kategori"] for r in (gecmis + favoriler) if r["kategori"]})

    onerilen: list = []
    if kategoriler:
        placeholders = ",".join("?" * len(kategoriler))
        sorgu = "SELECT * FROM urunler WHERE kategori IN (" + placeholders + ") ORDER BY puan DESC, RANDOM() LIMIT 10"
        async with db.execute(sorgu, kategoriler) as cur:
            onerilen = [dict(r) for r in await cur.fetchall()]
    else:
        async with db.execute("SELECT * FROM urunler ORDER BY puan DESC LIMIT 10") as cur:
            onerilen = [dict(r) for r in await cur.fetchall()]

    return {"oneriler": onerilen}


# ── Kuponlar ─────────────────────────────────────────────────────────────────

@router.get("/kuponlar")
async def kuponlar(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    if k["tip"] == "sirket":
        query = """
            SELECT k.*, c.kurum_adi as sirket_adi 
            FROM kuponlar k
            JOIN kullanicilar c ON k.kullanici_id = c.id
            WHERE k.kullanici_id=? AND k.kullanildi=0 AND k.gecerlilik >= date('now')
        """
        params = (k["id"],)
    else:
        query = """
            SELECT k.*, c.kurum_adi as sirket_adi 
            FROM kuponlar k
            JOIN kullanicilar c ON k.kullanici_id = c.id
            WHERE k.kullanildi=0 AND k.gecerlilik >= date('now')
        """
        params = ()
        
    async with db.execute(query, params) as cur:
        rows = await cur.fetchall()
    return {"kuponlar": [dict(r) for r in rows]}


@router.get("/health")
async def health():
    return {"durum": "aktif", "versiyon": "2.0.0"}


# ── Şirket Özel İşlemleri ───────────────────────────────────────────────────────


@router.post("/urun/fiyat-analiz", response_model=FiyatAnalizYanit)
async def urun_fiyat_analiz(
    istek: FiyatAnalizIstek,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    await _auth(credentials, db)
    ai = get_ai_service()
    res = await ai.fiyat_analizi(istek.ad, istek.fiyat, istek.maliyet)
    return FiyatAnalizYanit(**res)


@router.post("/kuponlar")
async def kupon_ekle(
    istek: KuponEkle,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    k = await _auth(credentials, db)
    if k["tip"] != "sirket":
        raise HTTPException(403, "Sadece şirket hesapları kupon oluşturabilir.")
        
    try:
        await db.execute(
            "INSERT INTO kuponlar (kullanici_id, kod, indirim_yuzde, gecerlilik, kullanildi) VALUES (?, ?, ?, ?, 0)",
            (k["id"], istek.kod, istek.indirim_yuzde, istek.gecerlilik)
        )
        await db.commit()
    except aiosqlite.IntegrityError:
        raise HTTPException(400, "Bu kod ile tanımlanmış bir kupon zaten mevcut.")
        
    return {"mesaj": "Kupon başarıyla oluşturuldu! ✅"}
