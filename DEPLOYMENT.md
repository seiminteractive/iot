# 🚀 Guía de Deployment - VPS Hostinger

Esta guía te llevará paso a paso para deployar el sistema IoT Telemetry en tu VPS de Hostinger.

## 📋 Pre-requisitos

### En tu VPS Hostinger

- Ubuntu 22.04 LTS
- Acceso SSH como root o usuario con sudo
- Docker y Docker Compose instalados
- Puertos disponibles: 80, 443, 3002, 5434, 8082

### Certificados AWS IoT

- Cuenta de AWS con acceso a IoT Core
- Certificados descargados (veremos cómo obtenerlos)

## 🔧 Paso 1: Preparar el VPS

### 1.1 Conectar al VPS

```bash
ssh root@tu-vps-ip
```

### 1.2 Instalar Docker (si no está instalado)

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verificar instalación
docker --version
docker compose version
```

### 1.3 Crear directorio del proyecto

```bash
cd /srv/apps
mkdir iot-telemetry
cd iot-telemetry
```

## 🔐 Paso 2: Configurar AWS IoT Core

### 2.1 Crear Thing en AWS IoT

1. Ve a [AWS IoT Core Console](https://console.aws.amazon.com/iot/)
2. En el menú lateral: **Manage** → **All devices** → **Things**
3. Click en **Create things**
4. Selecciona **Create single thing**
5. Nombre: `backend-subscriber-testingiot`
6. Click **Next**

### 2.2 Generar Certificados

1. Selecciona **Auto-generate a new certificate**
2. Click **Next**
3. **Descarga TODOS los archivos:**
   - Device certificate (termina en `-certificate.pem.crt`)
   - Private key (termina en `-private.pem.key`)
   - Root CA certificate (Amazon Root CA 1)
4. Click **Done**

⚠️ **IMPORTANTE:** Guarda estos archivos en un lugar seguro. No podrás descargar la llave privada nuevamente.

### 2.3 Crear y Adjuntar Policy

1. En AWS IoT Console: **Security** → **Policies**
2. Click **Create policy**
3. Nombre: `iot-telemetry-policy`
4. En **Policy document**, pega:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect"
      ],
      "Resource": "arn:aws:iot:us-east-2:*:client/backend-subscriber-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Subscribe"
      ],
      "Resource": "arn:aws:iot:us-east-2:*:topicfilter/factory/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Receive"
      ],
      "Resource": "arn:aws:iot:us-east-2:*:topic/factory/*"
    },
  ]
}
```

Nota: el backend solo suscribe, no publica a topics MQTT.

5. Click **Create**

### 2.4 Adjuntar Policy al Certificado

1. Ve a **Security** → **Certificates**
2. Click en tu certificado
3. En **Actions** → **Attach policy**
4. Selecciona `iot-telemetry-policy`
5. Click **Attach**

### 2.5 Obtener el Endpoint

```bash
# Opción 1: AWS Console
# Settings → Device data endpoint
# Ejemplo: a3rrbz0ypehoz3-ats.iot.us-east-2.amazonaws.com

# Opción 2: AWS CLI (si lo tienes instalado)
aws iot describe-endpoint --endpoint-type iot:Data-ATS
```

Guarda este endpoint, lo necesitarás en el `.env.production`.

## 📦 Paso 3: Subir el Proyecto al VPS

### Opción A: Desde Git (Recomendado)

```bash
cd /srv/apps
git clone <tu-repositorio> iot-telemetry
cd iot-telemetry
```

### Opción B: Subir archivos manualmente

```bash
# Desde tu máquina local
scp -r ./iot-telemetry root@tu-vps-ip:/srv/apps/
```

## 🔑 Paso 4: Configurar Secrets

### 4.1 Subir certificados AWS IoT

Desde tu máquina local (donde descargaste los certificados):

```bash
# Renombrar certificados para que coincidan con los nombres esperados
mv *-certificate.pem.crt certificate.pem.crt
mv *-private.pem.key private.pem.key

# Subir al VPS
scp certificate.pem.crt root@tu-vps-ip:/srv/apps/iot-telemetry/secrets/
scp private.pem.key root@tu-vps-ip:/srv/apps/iot-telemetry/secrets/
```

### 4.2 Configurar Root CA

En el VPS:

```bash
cd /srv/apps/iot-telemetry
cp secrets/AmazonRootCA1.pem.example secrets/AmazonRootCA1.pem
```

### 4.3 Crear contraseña de base de datos

```bash
# Generar contraseña segura
echo "iot_$(openssl rand -hex 16)" > secrets/db_password.txt

# Ver la contraseña generada (la necesitarás para .env.production)
cat secrets/db_password.txt
```

### 4.4 Configurar permisos

```bash
chmod 600 secrets/private.pem.key
chmod 644 secrets/certificate.pem.crt
chmod 644 secrets/AmazonRootCA1.pem
chmod 600 secrets/db_password.txt
```

## ⚙️ Paso 5: Configurar Variables de Entorno

```bash
cd /srv/apps/iot-telemetry
cp env.production.example .env.production
nano .env.production
```

Editar con tus valores:

```bash
NODE_ENV=production
PORT=3002
LOG_LEVEL=info

# Database - Usar la contraseña de secrets/db_password.txt
DB_PASSWORD=iot_abc123def456...

# AWS IoT Core - CAMBIAR CON TUS VALORES
AWS_IOT_ENDPOINT=a3rrbz0ypehoz3-ats.iot.us-east-2.amazonaws.com
AWS_IOT_CLIENT_ID=backend-subscriber-testingiot

# MQTT Topics (puedes dejar estos valores)
MQTT_TOPICS_TELEMETRY=factory/+/+/+/gateway/+/telemetry

# Admin interno (acceso UI de reglas)
ADMIN_EMAILS=admin@tuempresa.com

# Persistencia por defecto
PERSIST_DEFAULT_MODE=none

# CORS - Cambiar con tu dominio
CORS_ORIGIN=https://testingiot.seiminteractive.io
```

Guardar: `Ctrl + O`, `Enter`, `Ctrl + X`

## 🌐 Paso 6: Configurar Nginx y DNS

### 6.1 Configurar DNS

En tu proveedor de DNS (donde tienes seiminteractive.io):

1. Agregar registro A:
   - Nombre: `testingiot`
   - Tipo: `A`
   - Valor: `IP de tu VPS`
   - TTL: `300`

2. Esperar propagación (1-5 minutos)

3. Verificar:
```bash
dig testingiot.seiminteractive.io
# o
nslookup testingiot.seiminteractive.io
```

### 6.2 Configurar Nginx en el VPS

```bash
# Crear configuración para el subdominio
sudo nano /etc/nginx/sites-available/testingiot.seiminteractive.io
```

Pegar:

```nginx
server {
    listen 80;
    server_name testingiot.seiminteractive.io;

    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar:

```bash
sudo ln -s /etc/nginx/sites-available/testingiot.seiminteractive.io /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 Configurar SSL con Certbot

```bash
# Instalar Certbot (si no está instalado)
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL
sudo certbot --nginx -d testingiot.seiminteractive.io

# Seguir las instrucciones:
# - Ingresar email
# - Aceptar términos
# - Seleccionar opción 2 (redirect HTTP to HTTPS)
```

## 🐳 Paso 7: Levantar los Contenedores

### 7.1 Construir y levantar

```bash
cd /srv/apps/iot-telemetry

# Dar permisos al script de deploy
chmod +x deploy.sh

# Iniciar servicios
./deploy.sh start
```

Esto hará:
1. Verificar requisitos
2. Construir imágenes Docker
3. Crear base de datos
4. Ejecutar migraciones de Prisma
5. Levantar API, Frontend y Nginx

### 7.2 Verificar que todo esté corriendo

```bash
# Ver estado de contenedores
./deploy.sh status

# Ver logs en tiempo real
./deploy.sh logs

# Ver logs de un servicio específico
./deploy.sh logs api
```

## ✅ Paso 8: Verificar el Deployment

### 8.1 Health Check

```bash
# Desde el VPS
curl http://localhost:3002/health

# Desde tu navegador
https://testingiot.seiminteractive.io/health
```

Deberías ver:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-07T...",
  "mqtt": {
    "connected": true
  },
  "metrics": {
    "mqttMessagesReceived": 0,
    "mqttMessagesProcessed": 0,
    "mqttMessagesFailed": 0,
    "wsConnections": 0,
    "uptime": 12345,
    "lastMessage": null
  }
}
```

### 8.2 Verificar Frontend

Abre en tu navegador:
```
https://testingiot.seiminteractive.io
```

Deberías ver el dashboard con:
- Header con indicador de conexión WebSocket
- Cards con estadísticas
- Sección de plcs (vacía al inicio)
- Sección de telemetría en tiempo real

### 8.3 Verificar MQTT

```bash
# Ver logs del API
docker logs -f iot-telemetry-api

# Buscar línea similar a:
# ✅ Connected to AWS IoT Core
# 📥 Subscribed to: factory/+/+/+/gateway/+/telemetry
```

## 🧪 Paso 9: Enviar Datos de Prueba

### Opción A: Desde AWS IoT Console

1. Ve a AWS IoT Core Console
2. **Test** → **MQTT test client**
3. En **Publish to a topic**:
  - Topic: `factory/granix/ba/planta-1/gateway/granix-ba-gw-01/telemetry`
  - Message:
  ```json
  {
    "schemaVersion": 1,
    "timestamp": 1736359200000,
    "type": "telemetry",
    "tenant": "granix",
    "province": "ba",
    "plant": "planta-1",
    "gatewayId": "granix-ba-gw-01",
    "plcId": "plc-03",
    "metricId": "temp_head",
    "value": 25.5,
    "dataType": "float",
    "unit": "celsius",
    "quality": "GOOD"
  }
  ```
4. Click **Publish**

### Opción B: Con mosquitto_pub

```bash
# Instalar mosquitto-clients en el VPS
apt install mosquitto-clients -y

# Publicar mensaje
cd /srv/apps/iot-telemetry
mosquitto_pub \
  --cafile secrets/AmazonRootCA1.pem \
  --cert secrets/certificate.pem.crt \
  --key secrets/private.pem.key \
  -h tu-endpoint.iot.us-east-2.amazonaws.com \
  -p 8883 \
  -q 1 \
  -t factory/granix/ba/planta-1/gateway/granix-ba-gw-01/telemetry \
  -m '{"schemaVersion":1,"timestamp":1736359200000,"type":"telemetry","tenant":"granix","province":"ba","plant":"planta-1","gatewayId":"granix-ba-gw-01","plcId":"plc-03","metricId":"temp_head","value":25.5,"dataType":"float","unit":"celsius","quality":"GOOD"}'
```

### Verificar que se recibió

1. En el dashboard web deberías ver el evento aparecer en tiempo real
2. En los logs:
```bash
docker logs iot-telemetry-api --tail 50
```

3. En la base de datos:
```bash
docker exec -it iot-telemetry-db psql -U iot_user -d iot_telemetry

# En psql:
SELECT * FROM plcs;
SELECT * FROM telemetry_events ORDER BY ts DESC LIMIT 5;
\q
```

## 🎉 ¡Deployment Completo!

Tu sistema IoT Telemetry está ahora funcionando en:

- **Frontend:** https://testingiot.seiminteractive.io
- **API:** https://testingiot.seiminteractive.io/api/*
- **WebSocket:** wss://testingiot.seiminteractive.io/ws
- **Health:** https://testingiot.seiminteractive.io/health

## 📊 Comandos Útiles Post-Deployment

```bash
# Ver estado
./deploy.sh status

# Ver logs
./deploy.sh logs
./deploy.sh logs api
./deploy.sh logs db

# Reiniciar servicios
./deploy.sh restart

# Detener todo
./deploy.sh stop

# Backup de base de datos
./deploy.sh backup

# Ver métricas
curl https://testingiot.seiminteractive.io/metrics
```

## 🔧 Troubleshooting

Ver la sección **Troubleshooting** en el README.md principal.

## 🔄 Actualizaciones

Para actualizar el código:

```bash
cd /srv/apps/iot-telemetry
git pull
./deploy.sh restart
```

---

**¿Problemas?** Revisa los logs con `./deploy.sh logs` o consulta el README.md principal.
