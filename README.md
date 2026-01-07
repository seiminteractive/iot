# 🏭 IoT Telemetry Backend - Industrial Monitoring System

Sistema completo de telemetría industrial con backend Node.js, AWS IoT Core (MQTT), PostgreSQL y frontend Vue3.

## 📋 Características

- ✅ **Backend Node.js + TypeScript** con Fastify
- ✅ **AWS IoT Device SDK v2** para conexión MQTT con mTLS
- ✅ **PostgreSQL 16** con Prisma ORM
- ✅ **WebSocket** para actualizaciones en tiempo real
- ✅ **API REST** completa para consultas históricas
- ✅ **Frontend Vue3** con dashboard en tiempo real
- ✅ **Docker Compose** listo para producción
- ✅ **Nginx** como reverse proxy
- ✅ **Observabilidad** con métricas y logs estructurados

## 🏗️ Arquitectura

```
┌─────────────────┐
│   Dispositivos  │
│   IoT / PLCs    │
└────────┬────────┘
         │ MQTT (TLS)
         ▼
┌─────────────────┐
│  AWS IoT Core   │
└────────┬────────┘
         │ MQTT Subscribe
         ▼
┌─────────────────┐      ┌──────────────┐
│  Backend API    │◄────►│ PostgreSQL   │
│  (Fastify)      │      │   Database   │
└────────┬────────┘      └──────────────┘
         │
         ├─► REST API
         └─► WebSocket
              │
              ▼
         ┌──────────┐
         │ Frontend │
         │  (Vue3)  │
         └──────────┘
```

## 📁 Estructura del Proyecto

```
iot-telemetry/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuración y validación de env
│   │   ├── mqtt/            # Cliente MQTT AWS IoT SDK v2
│   │   ├── services/        # Lógica de negocio
│   │   ├── api/
│   │   │   ├── plugins/     # CORS, Rate Limit
│   │   │   └── routes/      # Rutas REST
│   │   ├── ws/              # WebSocket y gestión de conexiones
│   │   ├── db/              # Prisma client
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Logger, métricas
│   ├── prisma/
│   │   └── schema.prisma    # Schema de base de datos
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── composables/     # useWebSocket
│   │   ├── services/        # API client
│   │   └── App.vue
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf           # Reverse proxy config
├── secrets/
│   ├── certificate.pem.crt  # AWS IoT cert (crear)
│   ├── private.pem.key      # AWS IoT key (crear)
│   ├── AmazonRootCA1.pem    # Root CA
│   └── db_password.txt      # DB password (crear)
├── docker-compose.production.yml
├── .env.production
└── README.md
```

## 🚀 Deployment en VPS Hostinger

### Pre-requisitos

- Ubuntu 22.04 LTS
- Docker y Docker Compose instalados
- Certificados AWS IoT Core descargados
- Subdominio configurado: `testingiot.seiminteractive.io`

### Paso 1: Clonar el Proyecto

```bash
cd /srv/apps
git clone <tu-repo> iot-telemetry
cd iot-telemetry
```

### Paso 2: Configurar Certificados AWS IoT

1. **Obtener certificados de AWS IoT Core:**

```bash
# Ve a AWS IoT Core Console
# Security → Certificates → Create certificate
# Descarga:
# - Device certificate
# - Private key  
# - Root CA certificate
```

2. **Copiar certificados al proyecto:**

```bash
# Copiar tus certificados descargados
cp ~/Downloads/certificate.pem.crt secrets/
cp ~/Downloads/private.pem.key secrets/
cp secrets/AmazonRootCA1.pem.example secrets/AmazonRootCA1.pem

# Configurar permisos
chmod 600 secrets/private.pem.key
chmod 644 secrets/certificate.pem.crt
chmod 644 secrets/AmazonRootCA1.pem
```

3. **Crear contraseña de base de datos:**

```bash
echo "tu_password_seguro_$(openssl rand -hex 16)" > secrets/db_password.txt
chmod 600 secrets/db_password.txt
```

### Paso 3: Configurar Variables de Entorno

```bash
cp env.production.example .env.production
nano .env.production
```

Editar con tus valores:

```bash
NODE_ENV=production
PORT=3002
LOG_LEVEL=info

# Database password (debe coincidir con secrets/db_password.txt)
DB_PASSWORD=tu_password_aqui

# AWS IoT Core - IMPORTANTE: Cambiar estos valores
AWS_IOT_ENDPOINT=tu-endpoint.iot.us-east-2.amazonaws.com
AWS_IOT_CLIENT_ID=backend-subscriber-testingiot

# MQTT Topics
MQTT_TOPICS_TELEMETRY=factory/+/+/telemetry
MQTT_TOPICS_STATUS=factory/+/+/status

# CORS
CORS_ORIGIN=https://testingiot.seiminteractive.io
```

**¿Cómo obtener tu AWS_IOT_ENDPOINT?**

```bash
# Opción 1: AWS Console
# AWS IoT Core → Settings → Device data endpoint

# Opción 2: AWS CLI
aws iot describe-endpoint --endpoint-type iot:Data-ATS
```

### Paso 4: Configurar Nginx en el VPS

Editar el Nginx principal del VPS para agregar el subdominio:

```bash
sudo nano /etc/nginx/sites-available/testingiot.seiminteractive.io
```

Agregar:

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
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Activar y recargar:

```bash
sudo ln -s /etc/nginx/sites-available/testingiot.seiminteractive.io /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Paso 5: Configurar SSL con Certbot

```bash
sudo certbot --nginx -d testingiot.seiminteractive.io
```

### Paso 6: Construir y Levantar los Contenedores

```bash
# Construir imágenes
docker compose -f docker-compose.production.yml build

# Levantar servicios
docker compose -f docker-compose.production.yml up -d

# Ver logs
docker compose -f docker-compose.production.yml logs -f
```

### Paso 7: Verificar el Deployment

```bash
# Health check del backend
curl http://localhost:3002/health

# O desde el dominio
curl https://testingiot.seiminteractive.io/health

# Ver logs del API
docker logs -f iot-telemetry-api

# Ver logs de la base de datos
docker logs -f iot-telemetry-db
```

## 📡 Topics MQTT

### Convención de Topics

```
factory/{site}/{machineId}/telemetry
factory/{site}/{machineId}/status
```

Ejemplos:
- `factory/home/plc-01/telemetry`
- `factory/cordoba/machine-02/status`

### Formato de Mensajes

**Opción A: Simple (desde KepServer/PLCs):**

```json
{
  "Temperature": 22.6,
  "Pressure": 101.3,
  "MotorOn": true
}
```

**Opción B: Normalizado:**

```json
{
  "schema": 1,
  "machineId": "plc-01",
  "site": "home",
  "ts": 1700000000000,
  "values": {
    "temperature": 22.6,
    "pressure": 101.3,
    "motorOn": true
  }
}
```

El backend acepta ambos formatos y los normaliza automáticamente.

## 🔌 API REST

### Endpoints Disponibles

#### Health & Metrics

```bash
GET /health
GET /metrics
```

#### Machines

```bash
GET /api/machines                    # Todas las máquinas
GET /api/machines/:site              # Máquinas por site
GET /api/machines/:site/:machineId   # Máquina específica
GET /api/machines/:site/:machineId/state  # Estado actual
GET /api/sites                       # Lista de sites
```

#### Telemetry

```bash
GET /api/telemetry/:site/:machineId?from=ISO&to=ISO&limit=1000
GET /api/telemetry/latest?limit=100
```

#### Alarms

```bash
GET /api/alarms?acknowledged=false&severity=high
GET /api/alarms/:site/:machineId
POST /api/alarms/:id/acknowledge
```

### Ejemplos de Uso

```bash
# Obtener todas las máquinas
curl https://testingiot.seiminteractive.io/api/machines

# Obtener telemetría de una máquina
curl "https://testingiot.seiminteractive.io/api/telemetry/home/plc-01?limit=100"

# Obtener estado actual
curl https://testingiot.seiminteractive.io/api/machines/home/plc-01/state
```

## 🔄 WebSocket

### Conexión

```javascript
const ws = new WebSocket('wss://testingiot.seiminteractive.io/ws');

// Con filtros
const ws = new WebSocket('wss://testingiot.seiminteractive.io/ws?site=home&machineId=plc-01');
```

### Mensajes Recibidos

```json
{
  "type": "telemetry",
  "site": "home",
  "machineId": "plc-01",
  "ts": 1700000000000,
  "values": {
    "temperature": 22.6
  }
}
```

## 🗄️ Base de Datos

### Schema

```sql
-- Máquinas registradas
machines (
  id UUID PRIMARY KEY,
  site TEXT,
  machine_id TEXT,
  name TEXT,
  created_at TIMESTAMPTZ
)

-- Eventos de telemetría
telemetry_events (
  id UUID PRIMARY KEY,
  machine_id UUID REFERENCES machines(id),
  ts TIMESTAMPTZ,
  topic TEXT,
  values_json JSONB,
  raw_json JSONB,
  created_at TIMESTAMPTZ
)

-- Estado actual de cada máquina
machine_state (
  machine_id UUID PRIMARY KEY REFERENCES machines(id),
  last_ts TIMESTAMPTZ,
  last_values_json JSONB,
  updated_at TIMESTAMPTZ
)

-- Alarmas
alarms (
  id UUID PRIMARY KEY,
  machine_id UUID REFERENCES machines(id),
  ts TIMESTAMPTZ,
  type TEXT,
  message TEXT,
  severity TEXT,
  acknowledged BOOLEAN,
  created_at TIMESTAMPTZ
)
```

### Acceder a la Base de Datos

```bash
# Conectar a PostgreSQL
docker exec -it iot-telemetry-db psql -U iot_user -d iot_telemetry

# Ver máquinas
SELECT * FROM machines;

# Ver últimos eventos
SELECT * FROM telemetry_events ORDER BY ts DESC LIMIT 10;

# Ver estado actual
SELECT m.site, m.machine_id, ms.last_values_json 
FROM machines m 
JOIN machine_state ms ON m.id = ms.machine_id;
```

## 🔧 Comandos Útiles

### Docker

```bash
# Ver estado de contenedores
docker compose -f docker-compose.production.yml ps

# Ver logs
docker compose -f docker-compose.production.yml logs -f api
docker compose -f docker-compose.production.yml logs -f db

# Reiniciar servicios
docker compose -f docker-compose.production.yml restart api

# Detener todo
docker compose -f docker-compose.production.yml down

# Detener y eliminar volúmenes (¡CUIDADO! Borra la DB)
docker compose -f docker-compose.production.yml down -v

# Reconstruir y reiniciar
docker compose -f docker-compose.production.yml up -d --build
```

### Prisma

```bash
# Generar cliente Prisma
docker exec iot-telemetry-api npx prisma generate

# Ver base de datos con Prisma Studio (desarrollo)
cd backend
npm run prisma:studio
```

### Backups

```bash
# Backup de la base de datos
docker exec iot-telemetry-db pg_dump -U iot_user iot_telemetry > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup_20250107.sql | docker exec -i iot-telemetry-db psql -U iot_user -d iot_telemetry
```

## 🐛 Troubleshooting

### MQTT no conecta

```bash
# Verificar logs
docker logs iot-telemetry-api | grep -i mqtt

# Verificar certificados
ls -la secrets/
# Deben existir: certificate.pem.crt, private.pem.key, AmazonRootCA1.pem

# Verificar endpoint
echo $AWS_IOT_ENDPOINT

# Test de conectividad
openssl s_client -connect tu-endpoint.iot.us-east-2.amazonaws.com:8883 \
  -CAfile secrets/AmazonRootCA1.pem \
  -cert secrets/certificate.pem.crt \
  -key secrets/private.pem.key
```

### Base de datos lenta

```bash
# Ver queries lentas
docker exec iot-telemetry-db psql -U iot_user -d iot_telemetry -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# Verificar índices
docker exec iot-telemetry-db psql -U iot_user -d iot_telemetry -c "\di"
```

### WebSocket se desconecta

```bash
# Ajustar heartbeat interval en .env.production
WS_HEARTBEAT_INTERVAL=30000

# Verificar logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

### Contenedor no inicia

```bash
# Ver logs detallados
docker logs iot-telemetry-api --tail 100

# Verificar healthcheck
docker inspect iot-telemetry-api | grep -A 10 Health

# Entrar al contenedor
docker exec -it iot-telemetry-api sh
```

## 📊 Monitoreo

### Métricas Disponibles

```bash
curl https://testingiot.seiminteractive.io/metrics
```

Respuesta:

```json
{
  "mqttMessagesReceived": 1523,
  "mqttMessagesProcessed": 1520,
  "mqttMessagesFailed": 3,
  "wsConnections": 2,
  "uptime": 3600000,
  "lastMessage": 1700000000000,
  "mqttConnected": true
}
```

## 🔐 Seguridad

### Checklist de Seguridad

- ✅ Certificados mTLS para AWS IoT
- ✅ HTTPS con Let's Encrypt
- ✅ WebSocket sobre WSS (TLS)
- ✅ Rate limiting en API
- ✅ CORS configurado
- ✅ Secrets en archivos separados (no en código)
- ✅ Permisos restrictivos en certificados
- ✅ PostgreSQL solo accesible internamente

### Rotar Certificados

```bash
# 1. Generar nuevos certificados en AWS IoT Console
# 2. Descargar nuevos archivos
# 3. Reemplazar en secrets/
cp ~/Downloads/new-certificate.pem.crt secrets/certificate.pem.crt
cp ~/Downloads/new-private.pem.key secrets/private.pem.key

# 4. Reiniciar API
docker compose -f docker-compose.production.yml restart api
```

## 🧪 Testing

### Simular Dispositivo IoT

```bash
# Instalar mosquitto-clients
sudo apt install mosquitto-clients

# Publicar mensaje de prueba
mosquitto_pub \
  --cafile secrets/AmazonRootCA1.pem \
  --cert secrets/certificate.pem.crt \
  --key secrets/private.pem.key \
  -h tu-endpoint.iot.us-east-2.amazonaws.com \
  -p 8883 \
  -q 1 \
  -t factory/home/plc-test/telemetry \
  -m '{"temperature": 25.5, "pressure": 101.3}'
```

## 📚 Recursos

- [AWS IoT Core Documentation](https://docs.aws.amazon.com/iot/)
- [Fastify Documentation](https://www.fastify.io/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vue 3 Documentation](https://vuejs.org/)

## 📝 Licencia

MIT

## 👥 Soporte

Para problemas o preguntas, crear un issue en el repositorio.

---

**Desarrollado con ❤️ para SEIM Interactive**
