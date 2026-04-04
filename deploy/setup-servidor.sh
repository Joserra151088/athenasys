#!/bin/bash
# =============================================================
# AthenaSys - Script de configuración del servidor EC2
# Ejecutar SOLO UNA VEZ después de conectarte al servidor
# Uso: bash setup-servidor.sh
# =============================================================

set -e  # Detener si hay algún error

echo "========================================"
echo " AthenaSys - Configurando servidor EC2"
echo "========================================"

# 1. Actualizar sistema
echo "[1/7] Actualizando paquetes del sistema..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Instalar Node.js 20
echo "[2/7] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Instalar PM2 y Nginx
echo "[3/7] Instalando PM2 y Nginx..."
sudo npm install -g pm2
sudo apt-get install -y nginx

# 4. Instalar cliente MySQL
echo "[4/7] Instalando cliente MySQL..."
sudo apt-get install -y mysql-client

# 5. Instalar Git
echo "[5/7] Instalando Git..."
sudo apt-get install -y git

# 6. Clonar el repositorio
echo "[6/7] Clonando repositorio AthenaSys..."
cd ~
if [ -d "athenasys" ]; then
  echo "  -> Directorio athenasys ya existe, haciendo git pull..."
  cd athenasys && git pull && cd ~
else
  git clone https://github.com/Joserra151088/athenasys.git
fi

# 7. Crear carpeta de uploads
echo "[7/7] Creando directorios necesarios..."
mkdir -p ~/athenasys/backend/uploads
mkdir -p ~/athenasys/backend/uploads/firmas
mkdir -p ~/athenasys/backend/uploads/pdfs
chmod -R 755 ~/athenasys/backend/uploads

echo ""
echo "========================================"
echo " Servidor configurado correctamente"
echo " SIGUIENTE PASO: Ejecutar configurar-env.sh"
echo "========================================"
