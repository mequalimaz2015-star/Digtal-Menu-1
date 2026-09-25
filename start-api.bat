@echo off
title ABC Restaurant - Backend API Server
echo ==========================================
echo  ABC Restaurant - Node.js Backend
echo  Port: 8000
echo  Database: SQL Server (RestaurantDB)
echo ==========================================
echo.
cd /d "%~dp0backend"
node server.js
pause
