"""
routers/auth.py
================
Kimlik doğrulama endpoint'leri.
"""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import aiosqlite

from database import get_db
from models.schemas import GirisIstegi, MusteriKayitIstegi, SirketKayitIstegi, TokenYanit
from services.auth_service import giris_yap, musteri_kayit, sirket_kayit, mevcut_kullanici

router  = APIRouter(prefix="/api/auth", tags=["auth"])
bearer  = HTTPBearer(auto_error=False)

@router.post("/giris", response_model=TokenYanit)
async def giris(istek: GirisIstegi, db: aiosqlite.Connection = Depends(get_db)):
    try:
        return await giris_yap(db, istek)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

@router.post("/kayit/musteri", response_model=dict, status_code=201)
async def kayit_musteri(istek: MusteriKayitIstegi, db: aiosqlite.Connection = Depends(get_db)):
    try:
        kullanici = await musteri_kayit(db, istek)
        return {"mesaj": "Kayıt başarılı!", "kullanici_id": kullanici["id"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/kayit/sirket", response_model=dict, status_code=201)
async def kayit_sirket(istek: SirketKayitIstegi, db: aiosqlite.Connection = Depends(get_db)):
    try:
        kullanici = await sirket_kayit(db, istek)
        return {"mesaj": "Şirket kaydı başarılı!", "kullanici_id": kullanici["id"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/ben", response_model=dict)
async def ben(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: aiosqlite.Connection = Depends(get_db)
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Token gerekli.")
    try:
        return await mevcut_kullanici(credentials.credentials, db)
    except PermissionError as e:
        raise HTTPException(status_code=401, detail=str(e))
