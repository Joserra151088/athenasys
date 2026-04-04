# Guía de Despliegue AthenaSys en AWS

## PASO 1 — Crear la base de datos en RDS

1. Entra a **console.aws.amazon.com** → busca **RDS** → "Create database"
2. Selecciona:
   - Standard create
   - Engine: **MySQL**
   - Version: **MySQL 8.0**
   - Template: **Free tier**
   - DB instance identifier: `athenasys-db`
   - Master username: `admin`
   - Master password: (elige una contraseña segura y guárdala)
   - DB instance class: `db.t3.micro`
   - Storage: 20 GB (viene por defecto)
   - **Public access: No**
3. En "Connectivity":
   - VPC: default
   - Subnet group: default
4. Haz clic en **Create database** y espera ~5 minutos
5. Una vez creada, copia el **Endpoint** (parece: `athenasys-db.xxxx.us-east-1.rds.amazonaws.com`)

---

## PASO 2 — Crear el servidor EC2

1. AWS Console → **EC2** → "Launch Instance"
2. Configura:
   - Name: `athenasys-server`
   - AMI: **Ubuntu Server 22.04 LTS** (64-bit x86)
   - Instance type: **t2.micro** (Free tier eligible)
   - Key pair: "Create new key pair"
     - Name: `athenasys-key`
     - Type: RSA
     - Format: `.pem`
     - Descarga el archivo `.pem` (guárdalo bien, no se puede recuperar)
3. En "Network settings" → "Create security group":
   - SSH (22) — Source: My IP
   - HTTP (80) — Source: Anywhere
4. Storage: 8 GB (default está bien)
5. Haz clic en **Launch instance**

---

## PASO 3 — Asignar IP fija (Elastic IP)

1. EC2 → "Elastic IPs" → "Allocate Elastic IP address" → Allocate
2. Selecciona la IP creada → "Associate Elastic IP"
3. Selecciona tu instancia `athenasys-server` → Associate
4. Copia la **IP pública** asignada

---

## PASO 4 — Conectar RDS con EC2 (Security Group)

1. Ve a tu instancia RDS → "Connectivity & security"
2. Haz clic en el VPC security group de RDS
3. "Edit inbound rules" → "Add rule":
   - Type: MySQL/Aurora (3306)
   - Source: Custom → selecciona el Security Group de tu EC2
4. Guarda

---

## PASO 5 — Conectarte al servidor EC2

### En Windows (usando PowerShell o CMD):
```
ssh -i C:\ruta\athenasys-key.pem ubuntu@TU_IP_PUBLICA
```

### Si pide permisos del archivo .pem en Windows:
1. Clic derecho en `athenasys-key.pem` → Propiedades → Seguridad
2. Deshabilitar herencia → quitar todos los permisos
3. Agregar solo tu usuario con permiso de Lectura

---

## PASO 6 — Ejecutar los scripts de despliegue

Una vez conectado al servidor EC2, ejecuta en orden:

```bash
# Descargar los scripts de despliegue
curl -O https://raw.githubusercontent.com/Joserra151088/athenasys/main/deploy/setup-servidor.sh
bash setup-servidor.sh

# Editar con los datos de tu RDS antes de ejecutar
nano ~/athenasys/deploy/configurar-env.sh
# Cambia: DB_HOST, DB_PASSWORD
# Guarda: Ctrl+O, Enter, Ctrl+X

bash ~/athenasys/deploy/configurar-env.sh
bash ~/athenasys/deploy/desplegar-app.sh
```

---

## PASO 7 — Verificar

Abre en tu navegador: `http://TU_IP_PUBLICA`

La app AthenaSys debería cargar correctamente.

---

## Comandos útiles en el servidor

```bash
pm2 status                        # Estado del backend
pm2 logs athenasys-backend        # Ver logs en tiempo real
pm2 restart athenasys-backend     # Reiniciar backend
sudo systemctl status nginx       # Estado de Nginx
sudo tail -f /var/log/nginx/error.log  # Logs de Nginx
```

## Actualizar la app cuando haya cambios

```bash
bash ~/athenasys/deploy/actualizar-app.sh
```
