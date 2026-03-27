@echo off
title Aion TI - Inicio
echo.
echo  ==========================================
echo   Aion TI - Sistema de Inventario
echo  ==========================================
echo.
echo  Iniciando Backend (puerto 3002)...
start "Aion TI - Backend" cmd /k "cd /d %~dp0backend && node src/server.js"

timeout /t 2 /nobreak > nul

echo  Iniciando Frontend (puerto 5174)...
start "Aion TI - Frontend" cmd /k "cd /d %~dp0frontend && npx vite --port 5174"

timeout /t 4 /nobreak > nul

echo.
echo  ==========================================
echo   Listo! Abre en tu navegador:
echo.
echo   Local:   http://localhost:5174
echo   Red:     http://%COMPUTERNAME%:5174
echo  ==========================================
echo.
pause
