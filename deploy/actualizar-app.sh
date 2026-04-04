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
cd ~/athenasys/frontend && npm install && npm run build

# Reiniciar backend
pm2 restart athenasys-backend

echo "Actualización completada."
pm2 status
