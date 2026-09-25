@echo off
title ABC Restaurant - Frontend
echo ==========================================
echo  ABC Restaurant - React Frontend
echo  Local:   http://localhost:3000
echo  Network: open with your WiFi IP
echo ==========================================
echo.
cd /d "%~dp0frontend"
npm run dev
pause