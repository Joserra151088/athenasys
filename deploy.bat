@echo off
title AthenaSys - Despliegue Automatico
color 1F
cls

echo ================================================
echo   AthenaSys - Despliegue Automatico a AWS
echo ================================================
echo.

REM ─── CONFIGURACION ───────────────────────────────
set EC2_IP=3.140.107.137
set EC2_USER=ubuntu
set SSH_KEY=%~dp0athenasys-key.pem
set FRONTEND_DIR=%~dp0frontend
set PROJECT_DIR=%~dp0

REM ─── Verificar que existe la llave SSH ────────────
if not exist "%SSH_KEY%" (
    echo [ERROR] No se encontro la llave SSH: %SSH_KEY%
    echo Copia el archivo athenasys-key.pem en la carpeta del proyecto.
    pause
    exit /b 1
)

REM ─── MENU ─────────────────────────────────────────
echo Que deseas desplegar?
echo.
echo   [1] Frontend + Backend (completo)
echo   [2] Solo Frontend
echo   [3] Solo Backend
echo   [4] Cancelar
echo.
set /p opcion="Selecciona una opcion (1-4): "

if "%opcion%"=="1" goto FULL
if "%opcion%"=="2" goto FRONTEND
if "%opcion%"=="3" goto BACKEND
if "%opcion%"=="4" goto FIN
echo Opcion invalida.
pause
exit /b 1

REM ─── FRONTEND ──────────────────────────────────────
:FRONTEND
echo.
echo [1/2] Generando build del frontend...
cd /d "%FRONTEND_DIR%"
call npm run build
if errorlevel 1 (
    echo [ERROR] Fallo el build del frontend.
    pause
    exit /b 1
)

echo.
echo [2/2] Subiendo frontend al servidor...
scp -i "%SSH_KEY%" -o StrictHostKeyChecking=no -r "%FRONTEND_DIR%\dist\*" %EC2_USER%@%EC2_IP%:/var/www/athenasys/
if errorlevel 1 (
    echo [ERROR] Fallo la subida del frontend.
    pause
    exit /b 1
)
echo.
echo [OK] Frontend desplegado correctamente.
goto FIN

REM ─── BACKEND ───────────────────────────────────────
:BACKEND
echo.
echo [1/1] Actualizando backend en el servidor...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %EC2_USER%@%EC2_IP% "cd ~/athenasys && git pull && pm2 restart athenasys-backend"
if errorlevel 1 (
    echo [ERROR] Fallo la actualizacion del backend.
    pause
    exit /b 1
)
echo.
echo [OK] Backend actualizado correctamente.
goto FIN

REM ─── COMPLETO ──────────────────────────────────────
:FULL
echo.
echo [1/3] Generando build del frontend...
cd /d "%FRONTEND_DIR%"
call npm run build
if errorlevel 1 (
    echo [ERROR] Fallo el build del frontend.
    pause
    exit /b 1
)

echo.
echo [2/3] Subiendo frontend al servidor...
scp -i "%SSH_KEY%" -o StrictHostKeyChecking=no -r "%FRONTEND_DIR%\dist\*" %EC2_USER%@%EC2_IP%:/var/www/athenasys/
if errorlevel 1 (
    echo [ERROR] Fallo la subida del frontend.
    pause
    exit /b 1
)

echo.
echo [3/3] Actualizando backend en el servidor...
ssh -i "%SSH_KEY%" -o StrictHostKeyChecking=no %EC2_USER%@%EC2_IP% "cd ~/athenasys && git pull && pm2 restart athenasys-backend"
if errorlevel 1 (
    echo [ERROR] Fallo la actualizacion del backend.
    pause
    exit /b 1
)

echo.
echo [OK] Despliegue completo exitoso.

:FIN
echo.
echo ================================================
echo   Listo. App disponible en: http://%EC2_IP%
echo ================================================
echo.
pause
