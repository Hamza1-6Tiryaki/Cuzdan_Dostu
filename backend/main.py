"""
main.py — CüzdanDostu FastAPI Uygulaması
=========================================
Giriş noktası. CORS, loglama ve veritabanı başlatma.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).parent / ".env")

from database import init_db
from routers  import auth_router, products_router, budget_router, admin_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("cuzdan")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("🚀 CüzdanDostu başlatılıyor...")
    await init_db()
    logger.info("✅ Veritabanı hazır.")
    yield
    logger.info("🛑 CüzdanDostu kapatılıyor.")


app = FastAPI(
    title="CüzdanDostu API",
    version="2.0.0",
    description="KVKK Uyumlu Finansal Alışveriş Ajanı",
    lifespan=lifespan,
)

# CORS — React dev sunucusu
raw_allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in raw_allowed.split(",") if o.strip()]

# Geliştirme kolaylığı: environment ile tüm origin'leri açmak için
# DEV_CORS_ALLOW_ALL=1 veya ALLOWED_ORIGINS='*' kullanın.
allow_all = os.getenv("DEV_CORS_ALLOW_ALL", "0") == "1" or "*" in ALLOWED_ORIGINS
if allow_all:
    logger.warning("CORS: Tüm origin'lere izin veriliyor (geliştirme modu).")
    cors_origins = ["*"]
    cors_allow_credentials = False
else:
    cors_origins = ALLOWED_ORIGINS
    cors_allow_credentials = True

logger.info("CORS origins: %s (allow_credentials=%s)", cors_origins, cors_allow_credentials)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(PermissionError)
async def permission_error_handler(request: Request, exc: PermissionError):
    logger.warning(f"🔒 Yetkilendirme Hatası ({request.url.path}): {exc}")
    return JSONResponse(
        status_code=403,
        content={"detail": str(exc)},
    )


app.include_router(auth_router)
app.include_router(products_router)
app.include_router(budget_router)
app.include_router(admin_router)

@app.get("/")
async def root():
    return {"mesaj": "CüzdanDostu API v2.0.0 — KVKK Uyumlu 🔒"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
