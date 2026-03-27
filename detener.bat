@echo off
title Aion TI - Detener
echo.
echo  Deteniendo Aion TI...
taskkill /FI "WINDOWTITLE eq Aion TI - Backend*" /F > nul 2>&1
taskkill /FI "WINDOWTITLE eq Aion TI - Frontend*" /F > nul 2>&1
echo  Servidores detenidos.
pause
