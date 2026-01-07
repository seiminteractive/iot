# 📂 Estructura del Proyecto

Documentación detallada de la organización del código.

## 🌳 Árbol de Directorios

```
iot-telemetry/
│
├── backend/                          # Backend Node.js + TypeScript
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts               # Validación de variables de entorno con Zod
│   │   │
│   │   ├── mqtt/
│   │   │   ├── client.ts            # Cliente AWS IoT SDK v2 con reconexión
│   │   │   └── parseTopic.ts        # Parser de topics MQTT
│   │   │
│   │   ├── services/
│   │   │   ├── ingestTelemetry.ts   # Normalización e inserción de datos
│   │   │   └── alarmService.ts      # Gestión de alarmas
│   │   │
│   │   ├── api/
│   │   │   ├── plugins/
│   │   │   │   ├── cors.ts          # Configuración CORS
│   │   │   │   └── rateLimit.ts     # Rate limiting
│   │   │   │
│   │   │   └── routes/
│   │   │       ├── health.ts        # Health check y métricas
│   │   │       ├── machines.ts      # CRUD de máquinas
│   │   │       ├── telemetry.ts     # Consultas de telemetría
│   │   │       └── alarms.ts        # Gestión de alarmas
│   │   │
│   │   ├── ws/
│   │   │   ├── connectionManager.ts # Gestión de conexiones WebSocket
│   │   │   └── realtime.ts          # Plugin WebSocket de Fastify
│   │   │
│   │   ├── db/
│   │   │   └── prisma.ts            # Cliente Prisma configurado
│   │   │
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript types compartidos
│   │   │
│   │   ├── utils/
│   │   │   ├── logger.ts            # Logger Pino configurado
│   │   │   └── metrics.ts           # Collector de métricas
│   │   │
│   │   └── app.ts                   # Punto de entrada principal
│   │
│   ├── prisma/
│   │   ├── schema.prisma            # Schema de base de datos
│   │   └── migrations/              # Migraciones de Prisma
│   │
│   ├── Dockerfile                   # Multi-stage build para producción
│   ├── package.json
│   ├── tsconfig.json
│   └── .dockerignore
│
├── frontend/                         # Frontend Vue 3
│   ├── src/
│   │   ├── components/              # Componentes Vue (vacío por ahora)
│   │   │
│   │   ├── composables/
│   │   │   └── useWebSocket.js      # Composable para WebSocket
│   │   │
│   │   ├── services/
│   │   │   └── api.js               # Cliente API REST con Axios
│   │   │
│   │   ├── App.vue                  # Componente principal
│   │   └── main.js                  # Punto de entrada
│   │
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile
│   ├── nginx.conf                   # Config Nginx para SPA
│   └── .dockerignore
│
├── nginx/
│   └── nginx.conf                   # Reverse proxy principal
│
├── secrets/                          # Certificados y credenciales
│   ├── certificate.pem.crt          # Certificado AWS IoT (crear)
│   ├── private.pem.key              # Llave privada AWS IoT (crear)
│   ├── AmazonRootCA1.pem            # Root CA de Amazon
│   ├── db_password.txt              # Password de PostgreSQL (crear)
│   ├── *.example                    # Archivos de ejemplo
│   └── README.md                    # Instrucciones
│
├── docker-compose.production.yml    # Orquestación de servicios
├── .env.production                  # Variables de entorno (crear)
├── env.production.example           # Ejemplo de variables
├── deploy.sh                        # Script de deployment
├── .gitignore
├── .dockerignore
│
└── Documentación/
    ├── README.md                    # Documentación principal
    ├── DEPLOYMENT.md                # Guía de deployment detallada
    ├── QUICKSTART.md                # Guía rápida
    └── PROJECT_STRUCTURE.md         # Este archivo
```

## 🔍 Descripción de Módulos

### Backend

#### `src/config/env.ts`
- Valida variables de entorno con Zod
- Convierte strings a tipos apropiados
- Falla rápido si falta alguna variable requerida

#### `src/mqtt/client.ts`
- Conexión a AWS IoT Core con AWS IoT SDK v2
- Reconexión automática con backoff exponencial
- Suscripción a topics con wildcards
- Manejo de eventos (connect, disconnect, error, resume)
- Publicación de mensajes con QoS

#### `src/mqtt/parseTopic.ts`
- Extrae `site`, `machineId` y `type` de topics MQTT
- Formato esperado: `factory/{site}/{machineId}/{type}`

#### `src/services/ingestTelemetry.ts`
- Normaliza mensajes entrantes (formato A → formato B)
- Upsert de máquinas en DB
- Inserta eventos de telemetría
- Actualiza estado actual de máquinas
- Broadcast a clientes WebSocket

#### `src/services/alarmService.ts`
- Creación de alarmas
- Acknowledgement de alarmas
- Consultas de alarmas por máquina/severidad

#### `src/api/routes/*`
- **health.ts**: Health check, métricas del sistema
- **machines.ts**: GET máquinas, sites, estados
- **telemetry.ts**: GET histórico de telemetría
- **alarms.ts**: GET/POST alarmas

#### `src/ws/connectionManager.ts`
- Gestión de conexiones WebSocket activas
- Filtrado de mensajes por site/machineId
- Heartbeat automático (ping cada 30s)
- Cleanup de conexiones muertas

#### `src/ws/realtime.ts`
- Plugin WebSocket para Fastify
- Acepta query params: `?site=X&machineId=Y`
- Envía eventos en tiempo real a clientes

#### `src/utils/metrics.ts`
- Contador de mensajes MQTT (recibidos, procesados, fallidos)
- Contador de conexiones WebSocket
- Uptime del sistema
- Timestamp del último mensaje

#### `src/app.ts`
- Bootstrap de Fastify
- Registro de plugins y rutas
- Conexión a AWS IoT Core
- Graceful shutdown (SIGTERM, SIGINT)

### Frontend

#### `src/App.vue`
- Dashboard principal con:
  - Header con estado de conexión
  - Cards de estadísticas
  - Grid de máquinas con último estado
  - Lista de telemetría en tiempo real (últimos 20 eventos)
- Estilos dark theme

#### `src/composables/useWebSocket.js`
- Composable reutilizable para WebSocket
- Reconexión automática cada 5s
- Buffer de mensajes (últimos 100)
- Manejo de eventos: connect, disconnect, message

#### `src/services/api.js`
- Cliente Axios configurado
- Métodos para todos los endpoints REST
- Timeout de 10s
- Headers JSON

### Docker

#### `docker-compose.production.yml`
- **db**: PostgreSQL 16 con healthcheck
- **migrator**: Ejecuta migraciones de Prisma
- **api**: Backend Node.js
- **frontend**: Frontend Vue 3 + Nginx
- **nginx**: Reverse proxy principal

Servicios conectados por red `iot-network`.

Secrets montados como archivos en `/run/secrets/`.

#### `backend/Dockerfile`
- Multi-stage build:
  1. **Builder**: Compila TypeScript, genera Prisma client
  2. **Production**: Solo runtime, dependencies de producción
- Instala dependencias nativas para AWS IoT SDK v2
- Healthcheck en `/health`

#### `frontend/Dockerfile`
- Multi-stage build:
  1. **Builder**: Build de Vite
  2. **Production**: Nginx Alpine con archivos estáticos
- Configuración Nginx para SPA (fallback a index.html)

### Nginx

#### `nginx/nginx.conf`
- Reverse proxy para:
  - `/api/*` → backend:3002
  - `/health` → backend:3002
  - `/metrics` → backend:3002
  - `/ws` → backend:3002 (con upgrade para WebSocket)
  - `/` → frontend:80
- Configuración HTTPS comentada (descomentar en producción)
- Headers de seguridad
- Gzip compression

### Scripts

#### `deploy.sh`
Comandos:
- `start`: Verifica requisitos y levanta servicios
- `stop`: Detiene servicios
- `restart`: Reinicia servicios
- `logs [service]`: Muestra logs
- `status`: Estado y health check
- `backup`: Backup de PostgreSQL

## 🔄 Flujo de Datos

### Ingesta de Telemetría

```
1. Dispositivo IoT → AWS IoT Core
   Topic: factory/home/plc-01/telemetry
   Payload: {"Temperature": 22.6}

2. AWS IoT Core → Backend (MQTT Subscribe)
   src/mqtt/client.ts recibe mensaje

3. Backend → Normalización
   src/services/ingestTelemetry.ts
   - Parsea topic → {site: "home", machineId: "plc-01"}
   - Normaliza payload → {schema: 1, values: {...}}

4. Backend → Base de Datos
   - Upsert machine
   - Insert telemetry_event
   - Upsert machine_state

5. Backend → WebSocket Broadcast
   src/ws/connectionManager.ts
   - Envía a clientes conectados filtrados

6. Frontend → Actualización UI
   - WebSocket recibe evento
   - Vue reactivity actualiza dashboard
```

### Consulta de Histórico

```
1. Frontend → API REST
   GET /api/telemetry/home/plc-01?from=...&to=...

2. Backend → Base de Datos
   Prisma query con filtros

3. Backend → Response JSON
   Array de eventos ordenados por timestamp

4. Frontend → Renderiza tabla/gráfico
```

## 🗄️ Schema de Base de Datos

### Tablas

#### `machines`
- Registro de máquinas/dispositivos
- Unique constraint en (site, machine_id)

#### `telemetry_events`
- Eventos de telemetría con timestamp
- JSONB para values (flexible schema)
- JSONB para raw payload (auditoría)
- Índices en (machine_id, ts) y (ts)

#### `machine_state`
- Estado actual de cada máquina
- 1:1 con machines
- Actualizado en cada evento

#### `alarms`
- Alarmas generadas por el sistema
- Severidad: low, medium, high, critical
- Campo acknowledged para tracking

### Índices

```sql
-- Búsquedas por máquina y tiempo
CREATE INDEX idx_telemetry_machine_ts ON telemetry_events (machine_id, ts DESC);

-- Búsquedas por tiempo global
CREATE INDEX idx_telemetry_ts ON telemetry_events (ts DESC);

-- Búsquedas en JSONB (opcional)
CREATE INDEX idx_telemetry_values_gin ON telemetry_events USING GIN (values_json jsonb_path_ops);

-- Alarmas no reconocidas
CREATE INDEX idx_alarms_ack_severity ON alarms (acknowledged, severity);
```

## 🔐 Seguridad

### Certificados
- AWS IoT mTLS (mutual TLS)
- Certificados únicos por Thing
- Rotación manual cuando sea necesario

### API
- CORS configurado por dominio
- Rate limiting (100 req/min por IP)
- HTTPS obligatorio en producción

### WebSocket
- WSS (WebSocket Secure) sobre TLS
- Filtrado por site/machineId
- Heartbeat para detectar conexiones muertas

### Base de Datos
- Password en archivo separado (Docker secret)
- Solo accesible desde red interna Docker
- Backups automáticos recomendados

## 📊 Observabilidad

### Logs
- Pino logger con niveles configurables
- Logs estructurados (JSON)
- Rotación automática en producción

### Métricas
- Endpoint `/metrics` con:
  - Mensajes MQTT (recibidos, procesados, fallidos)
  - Conexiones WebSocket activas
  - Uptime del sistema
  - Timestamp del último mensaje

### Health Check
- Endpoint `/health` con:
  - Estado de conexión MQTT
  - Métricas del sistema
  - HTTP 200 si healthy, 503 si degraded

## 🚀 Deployment

### Desarrollo Local
```bash
cd backend
npm install
npm run dev

cd frontend
npm install
npm run dev
```

### Producción (Docker)
```bash
./deploy.sh start
```

## 📈 Escalabilidad

### Consideraciones Futuras

1. **Particionamiento de telemetry_events**
   - Por mes/año para mejor performance
   - Usar pg_partman

2. **Múltiples instancias del backend**
   - Shared subscriptions en MQTT 5.0
   - Load balancer para API REST

3. **Cache con Redis**
   - Estado actual de máquinas
   - Queries frecuentes

4. **Time-series DB**
   - TimescaleDB para telemetría
   - Mejor compresión y queries

---

**Última actualización:** Enero 2025
