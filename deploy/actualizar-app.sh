#!/bin/bash
# =============================================================
# AthenaSys - Actualizar la app (cuando hay cambios en el repo)
# =============================================================

set -e

echo "Actualizando AthenaSys..."

cd ~/athenasys
git pull

# Reinstalar dependencias si hubo cambios en package.json
cd ~/athenasys/backend && npm install --production

# Rebuild del frontend
cd ~/athenasys/frontend
export NODE_OPTIONS="--max-old-space-size=4096"
npm install
npm run build

# Publicar el frontend compilado en el web root real de Nginx
sudo mkdir -p /var/www/athenasys
sudo rsync -a --delete ~/athenasys/frontend/dist/ /var/www/athenasys/

# Reiniciar backend
pm2 restart athenasys-backend

echo "Actualización completada."
pm2 status
