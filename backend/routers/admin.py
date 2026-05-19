"""
routers/admin.py
================
Yönetici (Admin) işlemleri için API uç noktaları.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import aiosqlite
from datetime import datetime

from database import get_db
from services.auth_service import mevcut_kullanici

router = APIRouter(prefix="/api/admin", tags=["admin"])
bearer = HTTPBearer(auto_error=False)

# Admin Doğrulama Bağımlılığı
async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db)
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Token gerekli.")
    try:
        user = await mevcut_kullanici(credentials.credentials, db)
        if user["tip"] != "admin":
            raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gereklidir.")
        return user
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))

# ─── 1. İstatistikler (Dashboard Stats) ──────────────────────────────────────
@router.get("/stats")
async def get_stats(
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    # Toplam Müşteri
    async with db.execute("SELECT COUNT(*) FROM kullanicilar WHERE tip = 'musteri'") as cur:
        row = await cur.fetchone()
        musteri_sayisi = row[0] if row else 0

    # Toplam Şirket
    async with db.execute("SELECT COUNT(*) FROM kullanicilar WHERE tip = 'sirket'") as cur:
        row = await cur.fetchone()
        sirket_sayisi = row[0] if row else 0

    # Toplam Ürün
    async with db.execute("SELECT COUNT(*) FROM urunler") as cur:
        row = await cur.fetchone()
        urun_sayisi = row[0] if row else 0

    # Toplam Sipariş
    async with db.execute("SELECT COUNT(*), SUM(toplam_tutar) FROM siparisler") as cur:
        row = await cur.fetchone()
        siparis_sayisi = row[0] if row else 0
        toplam_kazanc = row[1] if row and row[1] is not None else 0.0

    # Son Siparişler (limit 5)
    recent_orders = []
    async with db.execute(
        """SELECT s.id, s.toplam_tutar, s.durum, s.olusturuldu, k.kullanici_adi 
           FROM siparisler s 
           JOIN kullanicilar k ON s.kullanici_id = k.id 
           ORDER BY s.olusturuldu DESC LIMIT 5"""
    ) as cur:
        rows = await cur.fetchall()
        for r in rows:
            recent_orders.append(dict(r))

    return {
        "musteri_sayisi": musteri_sayisi,
        "sirket_sayisi": sirket_sayisi,
        "urun_sayisi": urun_sayisi,
        "siparis_sayisi": siparis_sayisi,
        "toplam_kazanc": toplam_kazanc,
        "recent_orders": recent_orders
    }

# ─── 2. Kullanıcı Yönetimi ───────────────────────────────────────────────────
@router.get("/users")
async def list_users(
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute(
        "SELECT id, kullanici_adi, email, tip, ad_soyad, kurum_adi, aktif, olusturuldu FROM kullanicilar"
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]

@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: int,
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute("SELECT aktif, tip FROM kullanicilar WHERE id = ?", (user_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    
    if row["tip"] == "admin":
        raise HTTPException(status_code=400, detail="Admin hesabı devre dışı bırakılamaz.")

    yeni_durum = 0 if row["aktif"] == 1 else 1
    await db.execute("UPDATE kullanicilar SET aktif = ? WHERE id = ?", (yeni_durum, user_id))
    await db.commit()
    return {"mesaj": "Kullanıcı durumu güncellendi.", "aktif": yeni_durum}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute("SELECT tip FROM kullanicilar WHERE id = ?", (user_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    
    if row["tip"] == "admin":
        raise HTTPException(status_code=400, detail="Admin hesabı silinemez.")

    # İlişkili tabloları temizle
    await db.execute("DELETE FROM butceler WHERE kullanici_id = ?", (user_id,))
    await db.execute("DELETE FROM favoriler WHERE kullanici_id = ?", (user_id,))
    await db.execute("DELETE FROM gecmis WHERE kullanici_id = ?", (user_id,))
    await db.execute("DELETE FROM kuponlar WHERE kullanici_id = ?", (user_id,))
    
    # Siparişleri sil (ve sipariş kalemlerini)
    async with db.execute("SELECT id FROM siparisler WHERE kullanici_id = ?", (user_id,)) as cur:
        order_rows = await cur.fetchall()
        order_ids = [r[0] for r in order_rows]
    for oid in order_ids:
        await db.execute("DELETE FROM siparis_kalemleri WHERE siparis_id = ?", (oid,))
    await db.execute("DELETE FROM siparisler WHERE kullanici_id = ?", (user_id,))
    
    # Kullanıcıyı sil
    await db.execute("DELETE FROM kullanicilar WHERE id = ?", (user_id,))
    await db.commit()
    return {"mesaj": "Kullanıcı ve tüm ilişkili verileri başarıyla silindi."}

# ─── 3. Ürün Yönetimi ────────────────────────────────────────────────────────
@router.get("/products")
async def list_products(
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute(
        """SELECT u.id, u.ad, u.kategori, u.fiyat, u.marka, u.site, u.stok_var, u.resim_url, u.puan, k.kurum_adi as sirket_adi 
           FROM urunler u 
           LEFT JOIN kullanicilar k ON u.sirket_id = k.id"""
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]

@router.put("/products/{product_id}/stok")
async def toggle_product_stock(
    product_id: int,
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute("SELECT stok_var FROM urunler WHERE id = ?", (product_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")

    yeni_durum = 0 if row["stok_var"] == 1 else 1
    await db.execute("UPDATE urunler SET stok_var = ? WHERE id = ?", (yeni_durum, product_id))
    await db.commit()
    return {"mesaj": "Ürün stok durumu güncellendi.", "stok_var": yeni_durum}

@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute("SELECT id FROM urunler WHERE id = ?", (product_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı.")

    await db.execute("DELETE FROM siparis_kalemleri WHERE urun_id = ?", (product_id,))
    await db.execute("DELETE FROM gecmis WHERE urun_id = ?", (product_id,))
    await db.execute("DELETE FROM urunler WHERE id = ?", (product_id,))
    await db.commit()
    return {"mesaj": "Ürün başarıyla silindi."}

# ─── 4. Sipariş Yönetimi ──────────────────────────────────────────────────────
@router.get("/orders")
async def list_orders(
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute(
        """SELECT s.id, s.durum, s.toplam_tutar, s.olusturuldu, k.kullanici_adi, k.email 
           FROM siparisler s 
           JOIN kullanicilar k ON s.kullanici_id = k.id 
           ORDER BY s.olusturuldu DESC"""
    ) as cur:
        rows = await cur.fetchall()
        
    orders_list = []
    for r in rows:
        order_dict = dict(r)
        # Sipariş kalemlerini çek
        async with db.execute(
            """SELECT sk.adet, sk.birim_fiyat, u.ad, u.marka 
               FROM siparis_kalemleri sk 
               JOIN urunler u ON sk.urun_id = u.id 
               WHERE sk.siparis_id = ?""",
            (order_dict["id"],)
        ) as item_cur:
            items = await item_cur.fetchall()
            order_dict["urunler"] = [dict(i) for i in items]
        orders_list.append(order_dict)
        
    return orders_list

@router.put("/orders/{order_id}/durum")
async def update_order_status(
    order_id: int,
    payload: dict,
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    yeni_durum = payload.get("durum")
    valid_statuses = ["beklemede", "onaylandi", "kargoda", "teslim_edildi", "iptal"]
    if yeni_durum not in valid_statuses:
        raise HTTPException(status_code=400, detail="Geçersiz sipariş durumu.")

    async with db.execute("SELECT id FROM siparisler WHERE id = ?", (order_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı.")

    await db.execute("UPDATE siparisler SET durum = ? WHERE id = ?", (yeni_durum, order_id))
    await db.commit()
    return {"mesaj": "Sipariş durumu güncellendi.", "durum": yeni_durum}

# ─── 5. Kupon Yönetimi ────────────────────────────────────────────────────────
@router.get("/coupons")
async def list_coupons(
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute(
        """SELECT kp.id, kp.kod, kp.indirim_yuzde, kp.gecerlilik, kp.kullanildi, kl.kurum_adi as sirket_adi 
           FROM kuponlar kp 
           JOIN kullanicilar kl ON kp.kullanici_id = kl.id"""
    ) as cur:
        rows = await cur.fetchall()
    return [dict(r) for r in rows]

@router.delete("/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: int,
    _admin: dict = Depends(get_current_admin),
    db: aiosqlite.Connection = Depends(get_db)
):
    async with db.execute("SELECT id FROM kuponlar WHERE id = ?", (coupon_id,)) as cur:
        row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Kupon bulunamadı.")

    await db.execute("DELETE FROM kuponlar WHERE id = ?", (coupon_id,))
    await db.commit()
    return {"mesaj": "Kupon başarıyla silindi."}
