#!/bin/bash
# =============================================================
# AthenaSys - Actualizar la app (cuando hay cambios en el repo)
# =============================================================

set -euo pipefail

REPO_DIR="${HOME}/athenasys"
ENV_DIR="${HOME}/.athenasys"
ENV_FILE="${ENV_DIR}/backend.env"
WEB_ROOT="/var/www/athenasys"

echo "Actualizando AthenaSys..."

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

cd "${REPO_DIR}"
git fetch origin master
git reset --hard origin/master

# Limpiar artefactos generados antes de reinstalar/build
rm -rf "${REPO_DIR}/backend/node_modules" "${REPO_DIR}/frontend/dist"

cd "${REPO_DIR}/backend"
npm ci --omit=dev

cd "${REPO_DIR}/frontend"
export NODE_OPTIONS="--max-old-space-size=4096"
npm ci
npm run build

sudo mkdir -p "${WEB_ROOT}"
sudo rsync -a --delete "${REPO_DIR}/frontend/dist/" "${WEB_ROOT}/"

cd "${REPO_DIR}/backend"
export ATHENASYS_ENV_FILE="${ENV_FILE}"

if pm2 describe athenasys-backend >/dev/null 2>&1; then
  pm2 restart athenasys-backend --update-env
else
  pm2 start src/server.js --name "athenasys-backend" --update-env
fi

echo "Actualización completada."
pm2 status
