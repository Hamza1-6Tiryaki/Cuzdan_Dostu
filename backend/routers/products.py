"""
routers/products.py
====================
Ürün, kategori, favori ve geçmiş endpoint'leri.
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import aiosqlite

from database import get_db
from models.schemas import UrunKategorisi, FavoriEkle, UrunEkle
from services.auth_service import mevcut_kullanici

router = APIRouter(prefix="/api/urunler", tags=["products"])
bearer = HTTPBearer(auto_error=False)


async def _get_kullanici_optional(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db)
):
    if not credentials:
        return None
    try:
        return await mevcut_kullanici(credentials.credentials, db)
    except PermissionError:
        return None


@router.get("/")
async def urun_listesi(
    kategori:  Optional[str] = Query(None),
    arama:     Optional[str] = Query(None),
    limit:     int = Query(20, ge=1, le=100),
    offset:    int = Query(0, ge=0),
    db: aiosqlite.Connection = Depends(get_db),
):
    kosullar = []
    params: list = []

    if kategori:
        kosullar.append("kategori = ?")
        params.append(kategori)
    if arama:
        kosullar.append("(ad LIKE ? OR marka LIKE ?)")
        params += [f"%{arama}%", f"%{arama}%"]

    where = "WHERE " + " AND ".join(kosullar) if kosullar else ""
    params += [limit, offset]

    sorgu = "SELECT * FROM urunler " + where + " ORDER BY puan DESC LIMIT ? OFFSET ?"
    async with db.execute(sorgu, params) as cur:
        rows = await cur.fetchall()

    return {"urunler": [dict(r) for r in rows]}


@router.get("/kategoriler")
async def kategoriler():
    return {"kategoriler": [k.value for k in UrunKategorisi]}





@router.get("/kullanici/gecmis")
async def goruntuleme_gecmisi(
    limit: int = Query(20, ge=1, le=50),
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not credentials:
        raise HTTPException(401, "Token gerekli.")
    kullanici = await mevcut_kullanici(credentials.credentials, db)
    async with db.execute(
        """SELECT g.goruntuleme_sayisi, g.son_goruntuleme, u.*
           FROM gecmis g JOIN urunler u ON g.urun_id=u.id
           WHERE g.kullanici_id=?
           ORDER BY g.son_goruntuleme DESC LIMIT ?""",
        (kullanici["id"], limit)
    ) as cur:
        rows = await cur.fetchall()
    return {"gecmis": [dict(r) for r in rows]}


@router.post("/favori")
async def favori_ekle(
    istek: FavoriEkle,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not credentials:
        raise HTTPException(401, "Token gerekli.")
    kullanici = await mevcut_kullanici(credentials.credentials, db)
    try:
        await db.execute(
            """INSERT OR IGNORE INTO favoriler (kullanici_id, tur, referans_id, ad)
               VALUES (?,?,?,?)""",
            (kullanici["id"], istek.tur, istek.referans_id, istek.ad)
        )
        await db.commit()
    except aiosqlite.Error as e:
        raise HTTPException(400, str(e))
    return {"mesaj": "Favoriye eklendi."}


@router.delete("/favori/{tur}/{referans_id}")
async def favori_cikar(
    tur: str, referans_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not credentials:
        raise HTTPException(401, "Token gerekli.")
    kullanici = await mevcut_kullanici(credentials.credentials, db)
    await db.execute(
        "DELETE FROM favoriler WHERE kullanici_id=? AND tur=? AND referans_id=?",
        (kullanici["id"], tur, referans_id)
    )
    await db.commit()
    return {"mesaj": "Favoriden çıkarıldı."}


@router.get("/kullanici/favoriler")
async def favoriler_listesi(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not credentials:
        raise HTTPException(401, "Token gerekli.")
    kullanici = await mevcut_kullanici(credentials.credentials, db)
    async with db.execute(
        """SELECT f.*, u.fiyat, u.kategori, u.marka, u.site, u.stok_var, u.resim_url, u.puan
           FROM favoriler f LEFT JOIN urunler u ON f.referans_id=u.id AND f.tur='urun'
           WHERE f.kullanici_id=? ORDER BY f.eklendi DESC""",
        (kullanici["id"],)
    ) as cur:
        rows = await cur.fetchall()
    return {"favoriler": [dict(r) for r in rows]}


@router.get("/sirket")
async def sirket_urunleri(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not credentials:
        raise HTTPException(401, "Token gerekli.")
    k = await mevcut_kullanici(credentials.credentials, db)
    if k["tip"] != "sirket":
        raise HTTPException(403, "Sadece şirket hesapları kendi ürünlerini görüntüleyebilir.")
        
    async with db.execute(
        "SELECT id, ad, kategori, fiyat, marka, site, stok_var, resim_url, aciklama FROM urunler WHERE sirket_id = ? ORDER BY id DESC",
        (k["id"],)
    ) as cur:
        rows = await cur.fetchall()
    return {"urunler": [dict(r) for r in rows]}


@router.post("")
async def urun_ekle(
    istek: UrunEkle,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not credentials:
        raise HTTPException(401, "Token gerekli.")
    k = await mevcut_kullanici(credentials.credentials, db)
    if k["tip"] != "sirket":
        raise HTTPException(403, "Sadece şirket hesapları ürün ekleyebilir.")
        
    marka_val = istek.marka or k["kurum_adi"] or "Şirketim"
    site_val = istek.site or "Trendyol"
    
    async with db.execute(
        """INSERT INTO urunler (sirket_id, ad, kategori, fiyat, marka, site, stok_var, resim_url, aciklama)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
        (k["id"], istek.ad, istek.kategori, istek.fiyat, marka_val, site_val, istek.resim_url, istek.aciklama)
    ) as cur:
        urun_id = cur.lastrowid
    await db.commit()
    return {"id": urun_id, "mesaj": "Ürün başarıyla eklendi! ✅"}


SYNONYMS = {
    "macbook": ["macbook", "laptop", "notebook", "bilgisayar"],
    "laptop": ["macbook", "laptop", "notebook", "bilgisayar"],
    "notebook": ["macbook", "laptop", "notebook", "bilgisayar"],
    "iphone": ["iphone", "telefon", "galaxy", "samsung"],
    "galaxy": ["galaxy", "telefon", "iphone", "samsung"],
    "bezi": ["bezi", "bebek"],
    "bebek": ["bezi", "bebek"],
    "kulaklık": ["kulaklık", "kulaklik", "headphone"],
    "ipad": ["ipad", "tablet"],
    "tablet": ["ipad", "tablet"],
    "trençkot": ["trençkot", "ceket", "kaban", "mont"],
    "ceket": ["ceket", "trençkot", "blazer"],
    "jean": ["jean", "pantolon"],
    "ayakkabı": ["ayakkabı", "sneaker", "shoes"],
    "polo": ["polo", "t-shirt", "tişört"],
    "serum": ["serum", "cilt", "krem"],
    "ruj": ["ruj", "lip", "makyaj"],
    "şort": ["şort", "pantolon", "tayt"],
    "saat": ["saat", "watch"],
}


@router.get("/muadil/{urun_id}")
async def ucuz_muadil_bul(urun_id: int, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM urunler WHERE id=?", (urun_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    
    current_product = dict(row)
    current_name_lower = current_product["ad"].lower()
    alternative = None
    
    # 1. Try synonym matching (same logic/product type)
    matched_synonyms = []
    for key, syns in SYNONYMS.items():
        if key in current_name_lower:
            matched_synonyms = syns
            break
            
    if matched_synonyms:
        like_clauses = " OR ".join(["ad LIKE ?" for _ in matched_synonyms])
        params = [current_product["kategori"], current_product["fiyat"], urun_id] + [f"%{s}%" for s in matched_synonyms]
        query = f"""SELECT * FROM urunler 
                   WHERE kategori = ? AND fiyat < ? AND id != ? AND stok_var = 1 AND ({like_clauses})
                   ORDER BY fiyat ASC, puan DESC LIMIT 1"""
        async with db.execute(query, params) as cur:
            alt_row = await cur.fetchone()
            if alt_row:
                alternative = dict(alt_row)
                
    # 2. Try generic keyword match if no synonym matched
    if not alternative:
        keywords = [w for w in current_product["ad"].split() if len(w) > 2]
        for kw in keywords:
            if kw.lower() in ["pro", "ultra", "seti", "seri", "plus", "60li", "60lı", "256gb", "128gb"]:
                continue
            async with db.execute(
                """SELECT * FROM urunler 
                   WHERE kategori = ? AND fiyat < ? AND id != ? AND stok_var = 1 AND ad LIKE ?
                   ORDER BY fiyat ASC, puan DESC LIMIT 1""",
                (current_product["kategori"], current_product["fiyat"], urun_id, f"%{kw}%")
            ) as cur:
                alt_row = await cur.fetchone()
                if alt_row:
                    alternative = dict(alt_row)
                    break
                    
    # 3. Fallback to the cheapest product in the same category
    if not alternative:
        async with db.execute(
            """SELECT * FROM urunler 
               WHERE kategori = ? AND fiyat < ? AND id != ? AND stok_var = 1 
               ORDER BY fiyat ASC, puan DESC LIMIT 1""",
            (current_product["kategori"], current_product["fiyat"], urun_id)
        ) as cur:
            alt_row = await cur.fetchone()
            if alt_row:
                alternative = dict(alt_row)
                
    return alternative


@router.get("/{urun_id}")
async def urun_detay(urun_id: int, db: aiosqlite.Connection = Depends(get_db)):
    async with db.execute("SELECT * FROM urunler WHERE id=?", (urun_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")
    return dict(row)


@router.post("/goruntule/{urun_id}")
async def urun_goruntule(
    urun_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not credentials:
        return {"ok": True}
    try:
        kullanici = await mevcut_kullanici(credentials.credentials, db)
        kid = kullanici["id"]
        await db.execute(
            """INSERT INTO gecmis (kullanici_id, urun_id, goruntuleme_sayisi, son_goruntuleme)
               VALUES (?,?,1, datetime('now'))
               ON CONFLICT(kullanici_id, urun_id) DO UPDATE SET
                 goruntuleme_sayisi=goruntuleme_sayisi+1,
                 son_goruntuleme=datetime('now')""",
            (kid, urun_id)
        )
        await db.commit()
    except (PermissionError, aiosqlite.Error):
        pass
    return {"ok": True}


@router.delete("/{urun_id}")
async def urun_sil(
    urun_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db),
):
    if not credentials:
        raise HTTPException(401, "Token gerekli.")
    k = await mevcut_kullanici(credentials.credentials, db)
    if k["tip"] != "sirket":
        raise HTTPException(403, "Sadece şirket hesapları ürün silebilir.")
        
    async with db.execute("SELECT sirket_id FROM urunler WHERE id = ?", (urun_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Ürün bulunamadı.")
    if row["sirket_id"] != k["id"]:
        raise HTTPException(403, "Bu ürünü silme yetkiniz yok.")
        
    await db.execute("DELETE FROM urunler WHERE id = ?", (urun_id,))
    await db.commit()
    return {"mesaj": "Ürün başarıyla silindi! 🗑️"}

