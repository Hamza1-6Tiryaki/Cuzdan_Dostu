"""
services/auth_service.py
=========================
JWT tabanlı kimlik doğrulama servisi.
SOLID: Single Responsibility — sadece auth işlemleri.
KVKK: Telefon numarası hash'li saklanır.
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
import aiosqlite

from models.schemas import (
    MusteriKayitIstegi, SirketKayitIstegi, GirisIstegi,
    TokenYanit, KullaniciTipi, pii_hashle
)

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("DEV_SECRET_KEY_OK", "0") == "1":
        SECRET_KEY = os.getenv("DEV_SECRET_KEY", "dev_secret_key_for_local_development_only")
        logger.warning(
            "Uyar: SECRET_KEY ortam değişkeni bulunamadı. DEV_SECRET_KEY_OK=1 kullanılarak "
            "stabil bir geliştirme anahtarı yüklendi. Bu anahtar üretim için güvenli değildir."
        )
    else:
        raise RuntimeError(
            "SECRET_KEY ortam değişkeni tanımlanmadı. backend/.env veya ortam değişkenlerine "
            "SECRET_KEY=... ekleyin. Geliştirme için DEV_SECRET_KEY_OK=1 kullanabilirsiniz."
        )

ALGORITHM     = os.getenv("ALGORITHM", "HS256")
TOKEN_EXPIRE  = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 gün

import bcrypt

# Direct bcrypt hashing (safer, faster, no deprecated passlib dependencies)
def sifre_hashle(sifre: str) -> str:
    return bcrypt.hashpw(sifre.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

def sifre_dogrula(duz: str, hashli: str) -> bool:
    try:
        return bcrypt.checkpw(duz.encode("utf-8"), hashli.encode("utf-8"))
    except (ValueError, TypeError):
        return False

def token_olustur(veri: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE)
    return jwt.encode({**veri, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def token_coz(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        logger.debug("Token çözülemedi: %s", exc)
        return None


async def musteri_kayit(db: aiosqlite.Connection, istek: MusteriKayitIstegi) -> dict:
    # Email/kullanıcı adı benzersizlik kontrolü
    async with db.execute(
        "SELECT id FROM kullanicilar WHERE email=? OR kullanici_adi=?",
        (istek.email, istek.kullanici_adi)
    ) as cur:
        if await cur.fetchone():
            raise ValueError("Bu email veya kullanıcı adı zaten kayıtlı.")

    telefon_hash = pii_hashle(istek.telefon) if istek.telefon else None
    await db.execute(
        """INSERT INTO kullanicilar
           (kullanici_adi, email, sifre_hash, tip, ad_soyad, yas, cinsiyet, telefon_hash, kvkk_onay)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            istek.kullanici_adi, istek.email,
            sifre_hashle(istek.sifre), "musteri",
            istek.ad_soyad, istek.yas,
            istek.cinsiyet.value if istek.cinsiyet else None,
            telefon_hash, 1
        )
    )
    await db.commit()
    async with db.execute("SELECT last_insert_rowid()") as cur:
        row = await cur.fetchone()
        new_id = row[0]
    return {"id": new_id, "ad": istek.ad_soyad or istek.kullanici_adi, "tip": "musteri"}


async def sirket_kayit(db: aiosqlite.Connection, istek: SirketKayitIstegi) -> dict:
    async with db.execute(
        "SELECT id FROM kullanicilar WHERE email=? OR kullanici_adi=?",
        (istek.email, istek.kullanici_adi)
    ) as cur:
        if await cur.fetchone():
            raise ValueError("Bu email veya kullanıcı adı zaten kayıtlı.")

    await db.execute(
        """INSERT INTO kullanicilar
           (kullanici_adi, email, sifre_hash, tip, kurum_adi, sirket_kategorisi, aciklama, kvkk_onay)
           VALUES (?,?,?,?,?,?,?,?)""",
        (
            istek.kullanici_adi, istek.email,
            sifre_hashle(istek.sifre), "sirket",
            istek.kurum_adi, istek.sirket_kategorisi, istek.aciklama, 1
        )
    )
    await db.commit()
    async with db.execute("SELECT last_insert_rowid()") as cur:
        row = await cur.fetchone()
        new_id = row[0]
    return {"id": new_id, "ad": istek.kurum_adi, "tip": "sirket"}


async def giris_yap(db: aiosqlite.Connection, istek: GirisIstegi) -> TokenYanit:
    async with db.execute(
        "SELECT id, sifre_hash, tip, ad_soyad, kurum_adi FROM kullanicilar WHERE kullanici_adi=? OR email=?",
        (istek.kullanici_adi, istek.kullanici_adi)
    ) as cur:
        row = await cur.fetchone()

    if not row or not sifre_dogrula(istek.sifre, row["sifre_hash"]):
        raise ValueError("Kullanıcı adı veya şifre hatalı.")

    tip = KullaniciTipi(row["tip"])
    ad  = row["ad_soyad"] or row["kurum_adi"] or istek.kullanici_adi
    token = token_olustur({"sub": str(row["id"]), "tip": tip.value})

    return TokenYanit(
        access_token=token,
        kullanici_tipi=tip,
        kullanici_id=row["id"],
        ad=ad,
    )


async def mevcut_kullanici(token: str, db: aiosqlite.Connection) -> dict:
    payload = token_coz(token)
    if not payload:
        raise PermissionError("Geçersiz veya süresi dolmuş token.")
    kullanici_id = int(payload["sub"])
    async with db.execute(
        "SELECT id, kullanici_adi, tip, ad_soyad, kurum_adi, email FROM kullanicilar WHERE id=? AND aktif=1",
        (kullanici_id,)
    ) as cur:
        row = await cur.fetchone()
    if not row:
        raise PermissionError("Kullanıcı bulunamadı.")
    return dict(row)
