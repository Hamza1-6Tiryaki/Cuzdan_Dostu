"""
database/db.py
==============
Async SQLite veritabanı — tüm tablolar burada tanımlanır.
SOLID: Single Responsibility — sadece DB yönetimi.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import AsyncGenerator

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = Path(os.getenv("DATABASE_URL", str(Path(__file__).parent.parent / "data" / "cuzdan.db")))

CREATE_TABLES_SQL = """
-- Kullanıcılar
CREATE TABLE IF NOT EXISTS kullanicilar (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_adi   TEXT    NOT NULL UNIQUE,
    email           TEXT    NOT NULL UNIQUE,
    sifre_hash      TEXT    NOT NULL,
    tip             TEXT    NOT NULL DEFAULT 'musteri',
    ad_soyad        TEXT,
    yas             INTEGER,
    cinsiyet        TEXT,
    telefon_hash    TEXT,
    kurum_adi       TEXT,
    sirket_kategorisi TEXT,
    aciklama        TEXT,
    kvkk_onay       INTEGER NOT NULL DEFAULT 0,
    olusturuldu     TEXT    NOT NULL DEFAULT (datetime('now')),
    aktif           INTEGER NOT NULL DEFAULT 1
);

-- Bütçe
CREATE TABLE IF NOT EXISTS butceler (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id        INTEGER NOT NULL UNIQUE REFERENCES kullanicilar(id),
    aylik_gelir         REAL    NOT NULL,
    aylik_sabit_gider   REAL    NOT NULL DEFAULT 0,
    birikim_hedefi      REAL    NOT NULL DEFAULT 0,
    guncellendi         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Ürünler (mock + dinamik)
CREATE TABLE IF NOT EXISTS urunler (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sirket_id   INTEGER REFERENCES kullanicilar(id),
    ad          TEXT    NOT NULL,
    kategori    TEXT    NOT NULL,
    fiyat       REAL    NOT NULL,
    marka       TEXT    NOT NULL DEFAULT '',
    site        TEXT    NOT NULL DEFAULT '',
    stok_var    INTEGER NOT NULL DEFAULT 1,
    resim_url   TEXT,
    aciklama    TEXT,
    puan        REAL    NOT NULL DEFAULT 4.0,
    bildirim_listesi TEXT DEFAULT '',
    olusturuldu TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Siparişler
CREATE TABLE IF NOT EXISTS siparisler (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id    INTEGER NOT NULL REFERENCES kullanicilar(id),
    durum           TEXT    NOT NULL DEFAULT 'beklemede',
    toplam_tutar    REAL    NOT NULL,
    olusturuldu     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Sipariş kalemleri
CREATE TABLE IF NOT EXISTS siparis_kalemleri (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    siparis_id  INTEGER NOT NULL REFERENCES siparisler(id),
    urun_id     INTEGER NOT NULL REFERENCES urunler(id),
    adet        INTEGER NOT NULL DEFAULT 1,
    birim_fiyat REAL    NOT NULL
);

-- Favoriler
CREATE TABLE IF NOT EXISTS favoriler (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id    INTEGER NOT NULL REFERENCES kullanicilar(id),
    tur             TEXT    NOT NULL,  -- 'urun' | 'marka'
    referans_id     INTEGER NOT NULL,
    ad              TEXT    NOT NULL,
    eklendi         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(kullanici_id, tur, referans_id)
);

-- Görüntüleme geçmişi
CREATE TABLE IF NOT EXISTS gecmis (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id    INTEGER NOT NULL REFERENCES kullanicilar(id),
    urun_id         INTEGER NOT NULL REFERENCES urunler(id),
    goruntuleme_sayisi INTEGER NOT NULL DEFAULT 1,
    son_goruntuleme TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(kullanici_id, urun_id)
);

-- İndirim kuponları
CREATE TABLE IF NOT EXISTS kuponlar (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id),
    kod         TEXT    NOT NULL UNIQUE,
    indirim_yuzde REAL  NOT NULL DEFAULT 10,
    gecerlilik  TEXT    NOT NULL DEFAULT (date('now', '+30 days')),
    kullanildi  INTEGER NOT NULL DEFAULT 0
);

-- AI Chat hız sınırı (multi-worker uyumlu)
CREATE TABLE IF NOT EXISTS chat_rate_limit (
    kullanici_id INTEGER PRIMARY KEY REFERENCES kullanicilar(id),
    son_istek    REAL    NOT NULL DEFAULT 0
);
"""

MOCK_URUNLER = [
    # Elektronik
    ("iPhone 15 Pro 256GB",       "Elektronik",  "Apple",      "Trendyol",  85000.0, 1, "https://images.unsplash.com/photo-1695048133142-1a20484429be?w=400", 4.8),
    ("Samsung Galaxy S24 Ultra",  "Elektronik",  "Samsung",    "Hepsiburada",78000.0,1, "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400", 4.7),
    ("MacBook Air M3",            "Elektronik",  "Apple",      "Apple TR",  65000.0, 1, "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400", 4.9),
    ("Sony WH-1000XM5 Kulaklık",  "Elektronik",  "Sony",       "Amazon TR", 8500.0,  1, "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400", 4.6),
    ("iPad Pro 12.9 M4",          "Elektronik",  "Apple",      "MediaMarkt",45000.0, 1, "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400", 4.8),
    ("MacBook Air M1 (2020)",     "Elektronik",  "Apple",      "Hepsiburada",27500.0,1, "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400", 4.8),
    ("Lenovo IdeaPad 3 Laptop",   "Elektronik",  "Lenovo",     "Trendyol",  17999.0, 1, "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400", 4.4),
    ("iPhone 13 128GB",           "Elektronik",  "Apple",      "Trendyol",  37999.0, 1, "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=400", 4.7),
    ("Xiaomi Redmi Note 13",      "Elektronik",  "Xiaomi",     "Mi Store",  11500.0, 1, "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400", 4.5),
    ("JBL Tune 510BT Kulaklık",   "Elektronik",  "JBL",        "Trendyol",   1299.0, 1, "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400", 4.5),
    ("Samsung Galaxy Tab S9 FE",  "Elektronik",  "Samsung",    "Hepsiburada",11999.0, 1, "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400", 4.6),
    
    # Kadın
    ("Zara Trençkot",             "Kadın",       "Zara",       "Zara TR",   2499.0,  1, "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", 4.3),
    ("Mavi Skinny Jean",          "Kadın",       "Mavi",       "Trendyol",   899.0,  1, "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400", 4.5),
    ("LCW Blazer Ceket",          "Kadın",       "LCW",        "LCWaikiki",  799.0,  0, "https://images.unsplash.com/photo-1548624313-0396a51aa0e3?w=400", 4.1),
    ("Koton Kuşaklı Trençkot",    "Kadın",       "Koton",      "Koton",       899.0, 1, "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", 4.2),
    ("DeFacto Slim Fit Jean",     "Kadın",       "DeFacto",    "Trendyol",    449.0, 1, "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400", 4.1),
    
    # Erkek
    ("Tommy Hilfiger Polo",       "Erkek",       "Tommy",      "Trendyol",  1299.0,  1, "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400", 4.4),
    ("Hugo Boss Deri Ceket",      "Erkek",       "Hugo Boss",  "Trendyol",   9500.0, 1, "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400", 4.8),
    ("LCW Suni Deri Ceket",       "Erkek",       "LCW",        "LCWaikiki",   1499.0, 1, "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400", 4.3),
    ("LCW Polo Yaka Tişört",      "Erkek",       "LCW",        "LCWaikiki",    349.0, 1, "https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=400", 4.3),
    
    # Ayakkabı & Çanta
    ("Nike Air Max 270",          "Ayakkabı & Çanta", "Nike",  "Nike TR",   3499.0,  1, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400", 4.7),
    ("Adidas Stan Smith",         "Ayakkabı & Çanta", "Adidas","Adidas TR", 2999.0,  1, "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400", 4.5),
    ("Decathlon Koşu Ayakkabısı", "Ayakkabı & Çanta", "Kalenji", "Decathlon",   899.0, 1, "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400", 4.4),
    ("Slazenger Sneaker Ayakkabı", "Ayakkabı & Çanta", "Slazenger", "Hepsiburada", 749.0, 1, "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400", 4.2),
    
    # Ev & Yaşam
    ("Nespresso Vertuo",          "Ev & Yaşam",  "Nespresso",  "Trendyol",  4500.0,  1, "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400", 4.6),
    ("Dyson V15 Detect",          "Ev & Yaşam",  "Dyson",      "Hepsiburada",18000.0,1,"https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", 4.8),
    ("IKEA Kallax Raf",           "Ev & Yaşam",  "IKEA",       "IKEA TR",   1299.0,  1, "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400", 4.2),
    ("Sinbo Kahve Makinesi",      "Ev & Yaşam",  "Sinbo",      "Migros",      699.0,  1, "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400", 4.1),
    ("Philips Süpürge",           "Ev & Yaşam",  "Philips",    "Hepsiburada", 7999.0, 1, "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400", 4.6),
    ("Tekzen 5 Raflı Kitaplık",    "Ev & Yaşam",  "Tekzen",     "Trendyol",    499.0, 1, "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400", 4.0),
    
    # Market
    ("Organik Çay Seti",          "Market",      "Çaykur",     "Migros",     299.0,  1, "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400", 4.3),
    ("Protein Bar 12li Kutu",     "Market",      "PowerBar",   "A101",       649.0,  1, "https://images.unsplash.com/photo-1622484212850-eb596d769edc?w=400", 4.0),
    ("Fellas Protein Bar 12li",   "Market",      "Fellas",     "Migros",      349.0, 1, "https://images.unsplash.com/photo-1622484212850-eb596d769edc?w=400", 4.3),
    ("Lipton Dökme Çay",          "Market",      "Lipton",     "Migros",      149.0, 1, "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400", 4.4),
    
    # Kozmetik
    ("L'Oreal Revitalift Serum",  "Kozmetik",    "L'Oreal",    "Watsons",    899.0,  1, "https://images.unsplash.com/photo-1614859324452-edf7d90a2bd5?w=400", 4.4),
    ("MAC Lipstick",              "Kozmetik",    "MAC",        "Sephora",    799.0,  1, "https://images.unsplash.com/photo-1586495777744-4e6232bf2e93?w=400", 4.6),
    ("The Purest Solutions Serum","Kozmetik",    "The Purest", "Watsons",     299.0, 1, "https://images.unsplash.com/photo-1614859324452-edf7d90a2bd5?w=400", 4.5),
    ("Maybelline Likit Ruj",      "Kozmetik",    "Maybelline", "Gratis",      249.0, 1, "https://images.unsplash.com/photo-1586495777744-4e6232bf2e93?w=400", 4.4),
    
    # Spor
    ("Nike Dri-FIT Şort",         "Spor",        "Nike",       "Nike TR",    899.0,  1, "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400", 4.3),
    ("Kettlebell 16kg",           "Spor",        "Decathlon",  "Decathlon",  899.0,  1, "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400", 4.5),
    ("Decathlon Spor Şort",       "Spor",        "Domyos",     "Decathlon",   299.0, 1, "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400", 4.4),
    ("Delta Kettlebell 16kg",     "Spor",        "Delta",      "Trendyol",    449.0, 1, "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400", 4.3),
    
    # Aksesuar
    ("Ray-Ban Aviator",           "Aksesuar",    "Ray-Ban",    "Trendyol",  3299.0,  1, "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400", 4.7),
    ("Apple Watch Series 9",      "Aksesuar",    "Apple",      "Apple TR",  18000.0, 1, "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400", 4.8),
    ("Decathlon Güneş Gözlüğü",   "Aksesuar",    "Quechua",    "Decathlon",   499.0, 1, "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400", 4.3),
    ("Xiaomi Redmi Watch 4",      "Aksesuar",    "Xiaomi",     "Trendyol",   3299.0, 1, "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400", 4.6),
    
    # Anne & Çocuk
    ("Bebek Bezi 60lı",           "Anne & Çocuk","Pampers",    "Trendyol",   399.0,  1, "https://images.unsplash.com/photo-1579722820310-37b0df8f5929?w=400", 4.4),
    ("Sleepy Natural Bebek Bezi", "Anne & Çocuk","Sleepy",     "Trendyol",   199.0,  1, "https://images.unsplash.com/photo-1579722820310-37b0df8f5929?w=400", 4.5),
    ("Molfix Ultra Bebek Bezi",   "Anne & Çocuk","Molfix",     "Migros",     249.0,  1, "https://images.unsplash.com/photo-1579722820310-37b0df8f5929?w=400", 4.3),
    
    # Oyuncak
    ("LEGO City Seti",            "Oyuncak",     "LEGO",       "ToysRus",   1299.0,  1, "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=400", 4.9),
    ("Dede Blok Oyuncak Seti",    "Oyuncak",     "Dede",       "Toyzz Shop",  349.0, 1, "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=400", 4.2),
]


async def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        
        # 1. Create tables first
        await db.executescript(CREATE_TABLES_SQL)
        await db.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_butceler_kullanici_id ON butceler(kullanici_id)"
        )
        
        # 2. Add columns conditionally if they don't exist yet
        async with db.execute("PRAGMA table_info(urunler)") as cur:
            columns = [row["name"] for row in await cur.fetchall()]
        if "sirket_id" not in columns:
            await db.execute("ALTER TABLE urunler ADD COLUMN sirket_id INTEGER")
        if "bildirim_listesi" not in columns:
            await db.execute("ALTER TABLE urunler ADD COLUMN bildirim_listesi TEXT DEFAULT ''")
            
        await db.commit()
        
        # Ensure all mock products exist, insert or update
        for item in MOCK_URUNLER:
            async with db.execute("SELECT id FROM urunler WHERE ad = ?", (item[0],)) as cur:
                exists = await cur.fetchone()
            if not exists:
                await db.execute(
                    """INSERT INTO urunler (ad, kategori, marka, site, fiyat, stok_var, resim_url, puan)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    item,
                )
            else:
                await db.execute(
                    """UPDATE urunler SET kategori=?, marka=?, site=?, fiyat=?, stok_var=?, resim_url=?, puan=?
                       WHERE ad = ?""",
                    (item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[0])
                )
        # Ensure default admin exists
        async with db.execute("SELECT id FROM kullanicilar WHERE kullanici_adi = 'admin'") as cur:
            admin_exists = await cur.fetchone()
        if not admin_exists:
            from services.auth_service import sifre_hashle
            import secrets
            env_pass = os.getenv("ADMIN_PASSWORD")
            if not env_pass:
                env_pass = secrets.token_urlsafe(12)
                logger.warning("=" * 60)
                logger.warning("UYARI: ADMIN_PASSWORD env degiskeni tanimli degil!")
                logger.warning(f"Gecici admin sifresi otomatik olusturuldu: {env_pass}")
                logger.warning("Guvenliginiz icin bu sifreyi kaydedin veya .env dosyasina ADMIN_PASSWORD ekleyin.")
                logger.warning("=" * 60)
            admin_sifre = sifre_hashle(env_pass)
            await db.execute(
                """INSERT INTO kullanicilar (kullanici_adi, email, sifre_hash, tip, ad_soyad, kvkk_onay)
                   VALUES (?,?,?,?,?,?)""",
                ("admin", "admin@cuzdandostu.com", admin_sifre, "admin", "Sistem Yöneticisi", 1)
            )
        await db.commit()
    logger.info("Veritabanı başarıyla başlatıldı: %s", DB_PATH)


async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db
