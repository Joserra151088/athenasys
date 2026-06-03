#!/bin/bash
# =============================================================
# AthenaSys - Configurar variables de entorno de producción
# Guarda el archivo fuera del repo para no bloquear despliegues
# =============================================================

set -euo pipefail

ENV_DIR="${HOME}/.athenasys"
ENV_FILE="${ENV_DIR}/backend.env"

# ============================================================
#  EDITA ESTOS VALORES CON LOS DATOS DE TU RDS
# ============================================================
DB_HOST="TU_ENDPOINT_RDS.rds.amazonaws.com"
DB_NAME="athenasys"
DB_USER="admin"
DB_PASSWORD="TU_PASSWORD_RDS"
JWT_SECRET="athenasys_$(openssl rand -hex 32)"
# ============================================================

mkdir -p "${ENV_DIR}"

echo "Creando archivo de entorno en ${ENV_FILE}..."

cat > "${ENV_FILE}" << EOF
NODE_ENV=production
PORT=3002
DB_HOST=${DB_HOST}
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_CONNECTION_LIMIT=10
JWT_SECRET=${JWT_SECRET}
EOF

chmod 600 "${ENV_FILE}"

echo "Archivo creado en ${ENV_FILE}"
echo ""
echo "Contenido (sin mostrar password):"
grep -v "PASSWORD\|JWT_SECRET" "${ENV_FILE}"
echo ""
echo "SIGUIENTE PASO: Ejecutar bash deploy/desplegar-app.sh"
