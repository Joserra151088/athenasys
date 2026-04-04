#!/bin/bash
# =============================================================
# AthenaSys - Configurar variables de entorno
# Edita las variables con los datos de tu RDS antes de ejecutar
# =============================================================

# ============================================================
#  EDITA ESTOS VALORES CON LOS DATOS DE TU RDS
# ============================================================
DB_HOST="TU_ENDPOINT_RDS.rds.amazonaws.com"   # Endpoint de RDS
DB_NAME="athenasys"
DB_USER="admin"
DB_PASSWORD="TU_PASSWORD_RDS"
JWT_SECRET="athenasys_$(openssl rand -hex 32)"
# ============================================================

echo "Creando archivo .env para producción..."

cat > ~/athenasys/backend/.env << EOF
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

echo "Archivo .env creado en ~/athenasys/backend/.env"
echo ""
echo "Contenido (sin mostrar password):"
grep -v "PASSWORD\|JWT_SECRET" ~/athenasys/backend/.env
echo ""
echo "SIGUIENTE PASO: Ejecutar desplegar-app.sh"
