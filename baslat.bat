@echo off
chcp 65001 > nul
title CüzdanDostu Başlatıcı 🚀
cls
echo ===================================================
echo   🚀 CüzdanDostu Sunucu Başlatma Sihirbazı 🚀
echo ===================================================
echo.
echo [1] Çalışan eski sunucuları temizle (Port 8000 ve 5173)
echo [2] Temizlemeden direkt başlat
echo.
set /p secim="Seçiminiz (1 veya 2): "

if "%secim%"=="1" (
    echo.
    echo 🧹 Eski portlar temizleniyor...
    python kill_ports.py
)

echo.
echo 📡 Backend sunucusu yeni pencerede başlatılıyor...
start "CüzdanDostu - Backend (FastAPI)" cmd /k "cd backend && python main.py"

echo.
echo 💻 Frontend sunucusu yeni pencerede başlatılıyor...
start "CüzdanDostu - Frontend (React/Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo  ✅ Sunucular başlatıldı!
echo  - Backend API: http://localhost:8000
echo  - Frontend App: http://localhost:5173
echo ===================================================
echo.
pause
