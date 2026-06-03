#!/bin/bash
# =============================================================
# AthenaSys - Despliegue inicial de la aplicación
# Instala dependencias, configura Nginx y deja PM2 operativo
# =============================================================

set -euo pipefail

REPO_DIR="${HOME}/athenasys"
ENV_DIR="${HOME}/.athenasys"
ENV_FILE="${ENV_DIR}/backend.env"

echo "========================================"
echo " AthenaSys - Desplegando aplicación"
echo "========================================"

mkdir -p "${ENV_DIR}"

if [ ! -f "${ENV_FILE}" ] && [ -f "${REPO_DIR}/backend/.env" ]; then
  cp "${REPO_DIR}/backend/.env" "${ENV_FILE}"
  echo "✓ Variables migradas a ${ENV_FILE}"
fi

if [ ! -f "${ENV_FILE}" ]; then
  echo "ERROR: No existe el archivo de entorno en ${ENV_FILE}"
  echo "Ejecuta primero: bash deploy/configurar-env.sh"
  exit 1
fi

echo "[1/3] Configurando Nginx..."
sudo tee /etc/nginx/sites-available/athenasys > /dev/null << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;
    root /var/www/athenasys;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    location /uploads/ {
        alias /home/ubuntu/athenasys/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/athenasys /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo "[2/3] Ejecutando actualización limpia..."
bash "${REPO_DIR}/deploy/actualizar-app.sh"

echo "[3/3] Persistiendo servicio PM2..."
pm2 save
pm2 startup | tail -1 | sudo bash || true

echo ""
echo "========================================"
echo " Despliegue completado exitosamente"
echo "========================================"
pm2 status
