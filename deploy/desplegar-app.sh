#!/bin/bash
# =============================================================
# AthenaSys - Despliegue de la aplicación
# Instala dependencias, build del frontend e inicia servicios
# =============================================================

set -e

echo "========================================"
echo " AthenaSys - Desplegando aplicación"
echo "========================================"

# Verificar que existe el .env
if [ ! -f ~/athenasys/backend/.env ]; then
  echo "ERROR: No existe el archivo .env"
  echo "Ejecuta primero: bash configurar-env.sh"
  exit 1
fi

# 1. Instalar dependencias del backend
echo "[1/5] Instalando dependencias del backend..."
cd ~/athenasys/backend
npm install --production

# 2. Instalar dependencias del frontend y hacer build
echo "[2/5] Instalando dependencias del frontend..."
cd ~/athenasys/frontend
npm install

echo "[3/5] Generando build de producción del frontend..."
npm run build

# 3. Configurar Nginx
echo "[4/5] Configurando Nginx..."
sudo tee /etc/nginx/sites-available/athenasys > /dev/null << 'NGINX_CONF'
server {
    listen 80;
    server_name _;

    # Tamaño máximo de archivos subidos (firmas, PDFs)
    client_max_body_size 50M;

    # Servir el frontend (React build)
    root /home/ubuntu/athenasys/frontend/dist;
    index index.html;

    # SPA routing - todo redirige al index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy al backend Node.js
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

    # Archivos subidos (firmas, PDFs generados)
    location /uploads/ {
        alias /home/ubuntu/athenasys/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGINX_CONF

# Activar configuración de Nginx
sudo ln -sf /etc/nginx/sites-available/athenasys /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

# 4. Iniciar backend con PM2
echo "[5/5] Iniciando backend con PM2..."
cd ~/athenasys/backend
pm2 delete athenasys-backend 2>/dev/null || true
pm2 start src/server.js --name "athenasys-backend" --env production
pm2 save
pm2 startup | tail -1 | sudo bash || true

echo ""
echo "========================================"
echo " Despliegue completado exitosamente"
echo "========================================"
echo ""
echo " Estado del backend:"
pm2 status
echo ""

# Obtener IP pública
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "No disponible")
echo " App disponible en: http://${PUBLIC_IP}"
echo ""
echo " Comandos útiles:"
echo "   pm2 logs athenasys-backend   -> Ver logs del backend"
echo "   pm2 restart athenasys-backend -> Reiniciar backend"
echo "   sudo systemctl status nginx   -> Estado de Nginx"
echo "========================================"
