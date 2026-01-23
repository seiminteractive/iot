# 🔌 API Examples

Ejemplos prácticos de uso de la API REST.

## 🌐 Base URL

```
Producción: https://testingiot.seiminteractive.io
Desarrollo: http://localhost:3002
```

## 📡 Endpoints

### Health & Metrics

#### GET /health

Verifica el estado del sistema.

```bash
curl https://testingiot.seiminteractive.io/health
```

**Response 200:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-07T15:30:00.000Z",
  "mqtt": {
    "connected": true
  },
  "metrics": {
    "mqttMessagesReceived": 1523,
    "mqttMessagesProcessed": 1520,
    "mqttMessagesFailed": 3,
    "wsConnections": 2,
    "uptime": 3600000,
    "lastMessage": 1704639000000
  }
}
```

#### GET /metrics

Obtiene métricas detalladas del sistema.

```bash
curl https://testingiot.seiminteractive.io/metrics
```

**Response 200:**
```json
{
  "mqttMessagesReceived": 1523,
  "mqttMessagesProcessed": 1520,
  "mqttMessagesFailed": 3,
  "wsConnections": 2,
  "uptime": 3600000,
  "lastMessage": 1704639000000,
  "mqttConnected": true
}
```

---

### PLCs

#### GET /api/plcs

Lista todas las plcs registradas.

```bash
curl https://testingiot.seiminteractive.io/api/plcs
```

**Response 200:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "site": "home",
    "plcId": "plc-01",
    "name": "plc-01",
    "createdAt": "2025-01-07T10:00:00.000Z",
    "state": {
      "plcId": "550e8400-e29b-41d4-a716-446655440000",
      "lastTs": "2025-01-07T15:25:00.000Z",
      "lastValuesJson": {
        "temperature": 22.6,
        "pressure": 101.3,
        "motorOn": true
      },
      "updatedAt": "2025-01-07T15:25:00.000Z"
    },
    "_count": {
      "telemetryEvents": 1523,
      "alarms": 5
    }
  }
]
```

#### GET /api/plcs/:site

Lista plcs de un site específico.

```bash
curl https://testingiot.seiminteractive.io/api/plcs/home
```

#### GET /api/plcs/:site/:plcId

Obtiene una máquina específica.

```bash
curl https://testingiot.seiminteractive.io/api/plcs/home/plc-01
```

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "site": "home",
  "plcId": "plc-01",
  "name": "plc-01",
  "createdAt": "2025-01-07T10:00:00.000Z",
  "state": {
    "plcId": "550e8400-e29b-41d4-a716-446655440000",
    "lastTs": "2025-01-07T15:25:00.000Z",
    "lastValuesJson": {
      "temperature": 22.6,
      "pressure": 101.3,
      "motorOn": true
    },
    "updatedAt": "2025-01-07T15:25:00.000Z"
  },
  "_count": {
    "telemetryEvents": 1523,
    "alarms": 5
  }
}
```

**Response 404:**
```json
{
  "error": "PLC not found"
}
```

#### GET /api/plcs/:site/:plcId/state

Obtiene el estado actual de una máquina.

```bash
curl https://testingiot.seiminteractive.io/api/plcs/home/plc-01/state
```

**Response 200:**
```json
{
  "plcId": "550e8400-e29b-41d4-a716-446655440000",
  "lastTs": "2025-01-07T15:25:00.000Z",
  "lastValuesJson": {
    "temperature": 22.6,
    "pressure": 101.3,
    "motorOn": true
  },
  "updatedAt": "2025-01-07T15:25:00.000Z"
}
```

#### GET /api/sites

Lista todos los sites disponibles.

```bash
curl https://testingiot.seiminteractive.io/api/sites
```

**Response 200:**
```json
[
  "home",
  "cordoba",
  "factory-a"
]
```

---

### Telemetry

#### GET /api/telemetry/:site/:plcId

Obtiene histórico de telemetría de una máquina.

**Query Parameters:**
- `from` (opcional): ISO timestamp inicio
- `to` (opcional): ISO timestamp fin
- `limit` (opcional): Número máximo de resultados (default: 1000)

```bash
# Últimos 100 eventos
curl "https://testingiot.seiminteractive.io/api/telemetry/home/plc-01?limit=100"

# Eventos en rango de tiempo
curl "https://testingiot.seiminteractive.io/api/telemetry/home/plc-01?from=2025-01-07T00:00:00Z&to=2025-01-07T23:59:59Z"
```

**Response 200:**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "plcId": "550e8400-e29b-41d4-a716-446655440000",
    "ts": "2025-01-07T15:25:00.000Z",
    "topic": "factory/granix/ba/planta-1/gateway/granix-ba-gw-01/telemetry",
    "valuesJson": {
      "temp_head": {
        "value": 22.6,
        "dataType": "float",
        "unit": "celsius",
        "quality": "GOOD"
      }
    },
    "rawJson": {
      "schemaVersion": 1,
      "timestamp": 1736359200000,
      "type": "telemetry",
      "tenant": "granix",
      "province": "ba",
      "plant": "planta-1",
      "gatewayId": "granix-ba-gw-01",
      "plcId": "plc-01",
      "metricId": "temp_head",
      "value": 22.6,
      "dataType": "float",
      "unit": "celsius",
      "quality": "GOOD"
    },
    "createdAt": "2025-01-07T15:25:00.100Z"
  }
]
```

#### GET /api/telemetry/latest

Obtiene los últimos eventos de telemetría de todas las plcs.

**Query Parameters:**
- `limit` (opcional): Número máximo de resultados (default: 100)

```bash
curl "https://testingiot.seiminteractive.io/api/telemetry/latest?limit=50"
```

#### GET /api/telemetry/hourly

Obtiene agregados por hora.

**Query Parameters:**
- `plant` (opcional)
- `gatewayId` (opcional)
- `plcId` (opcional)
- `metricId` (opcional)
- `from` / `to` (ISO)
- `limit` (opcional, default: 500)

```bash
curl "https://testingiot.seiminteractive.io/api/telemetry/hourly?plant=planta-1&metricId=temp_head&limit=100"
```

**Response 200:**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "plcId": "550e8400-e29b-41d4-a716-446655440000",
    "ts": "2025-01-07T15:25:00.000Z",
    "topic": "factory/granix/ba/planta-1/gateway/granix-ba-gw-01/telemetry",
    "valuesJson": {
      "temp_head": {
        "value": 22.6,
        "dataType": "float",
        "unit": "celsius",
        "quality": "GOOD"
      }
    },
    "rawJson": {
      "schemaVersion": 1,
      "timestamp": 1736359200000,
      "type": "telemetry",
      "tenant": "granix",
      "province": "ba",
      "plant": "planta-1",
      "gatewayId": "granix-ba-gw-01",
      "plcId": "plc-01",
      "metricId": "temp_head",
      "value": 22.6,
      "dataType": "float",
      "unit": "celsius",
      "quality": "GOOD"
    },
    "createdAt": "2025-01-07T15:25:00.100Z",
    "plc": {
      "plantId": "home",
      "plcId": "plc-01",
      "name": "plc-01"
    }
  }
]
```

---

### Alarms

#### GET /api/alarms

Lista todas las alarmas.

**Query Parameters:**
- `acknowledged` (opcional): `true` o `false`
- `severity` (opcional): `low`, `medium`, `high`, `critical`
- `limit` (opcional): Número máximo de resultados (default: 100)

```bash
# Todas las alarmas
curl https://testingiot.seiminteractive.io/api/alarms

# Alarmas no reconocidas
curl "https://testingiot.seiminteractive.io/api/alarms?acknowledged=false"

# Alarmas críticas
curl "https://testingiot.seiminteractive.io/api/alarms?severity=critical"

# Alarmas críticas no reconocidas
curl "https://testingiot.seiminteractive.io/api/alarms?acknowledged=false&severity=critical&limit=50"
```

**Response 200:**
```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "plcId": "550e8400-e29b-41d4-a716-446655440000",
    "ts": "2025-01-07T15:20:00.000Z",
    "type": "temperature_high",
    "message": "Temperature above threshold (25°C)",
    "severity": "high",
    "acknowledged": false,
    "createdAt": "2025-01-07T15:20:00.100Z",
    "plc": {
      "plantId": "home",
      "plcId": "plc-01",
      "name": "plc-01"
    }
  }
]
```

#### GET /api/alarms/:site/:plcId

Lista alarmas de un PLC específico.

**Query Parameters:**
- `acknowledged` (opcional): `true` o `false`

```bash
curl "https://testingiot.seiminteractive.io/api/alarms/home/plc-01?acknowledged=false"
```

#### POST /api/alarms/:id/acknowledge

Reconoce una alarma.

```bash
curl -X POST https://testingiot.seiminteractive.io/api/alarms/770e8400-e29b-41d4-a716-446655440002/acknowledge
```

**Response 200:**
```json
{
  "success": true,
  "message": "Alarm acknowledged"
}
```

**Response 400:**
```json
{
  "error": "Failed to acknowledge alarm"
}
```

---

## 🔌 WebSocket

### Conexión

```javascript
const ws = new WebSocket('wss://testingiot.seiminteractive.io/ws');

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Con Filtros

```javascript
// Solo eventos de un site específico
const ws = new WebSocket('wss://testingiot.seiminteractive.io/ws?site=home');

// Solo eventos de una máquina específica
const ws = new WebSocket('wss://testingiot.seiminteractive.io/ws?site=home&plcId=plc-01');

// Todos los eventos (wildcard)
const ws = new WebSocket('wss://testingiot.seiminteractive.io/ws?site=*&plcId=*');
```

### Mensajes Recibidos

#### Conexión exitosa
```json
{
  "type": "connected",
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Connected to IoT Telemetry WebSocket"
}
```

#### Evento de telemetría
```json
{
  "type": "telemetry",
  "tenant": "granix",
  "plant": "planta-1",
  "plcId": "plc-01",
  "gatewayId": "granix-ba-gw-01",
  "ts": 1704639000000,
  "values": {
    "temp_head": {
      "value": 22.6,
      "dataType": "float",
      "unit": "celsius",
      "quality": "GOOD"
    }
  }
}
```

#### Evento de heartbeat
```json
{
  "type": "heartbeat",
  "tenant": "granix",
  "plant": "planta-1",
  "gatewayId": "granix-ba-gw-01",
  "ts": 1704639000000
}
```

#### Heartbeat (ping)
```json
{
  "type": "ping",
  "ts": 1704639000000
}
```

---

## 📝 Ejemplos con JavaScript

### Fetch API

```javascript
// GET request
async function getPlcs() {
  const response = await fetch('https://testingiot.seiminteractive.io/api/plcs');
  const plcs = await response.json();
  console.log(plcs);
}

// GET con query params
async function getTelemetry(site, plcId, limit = 100) {
  const url = new URL(`https://testingiot.seiminteractive.io/api/telemetry/${site}/${plcId}`);
  url.searchParams.append('limit', limit);
  
  const response = await fetch(url);
  const telemetry = await response.json();
  return telemetry;
}

// POST request
async function acknowledgeAlarm(alarmId) {
  const response = await fetch(
    `https://testingiot.seiminteractive.io/api/alarms/${alarmId}/acknowledge`,
    { method: 'POST' }
  );
  const result = await response.json();
  return result;
}
```

### Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://testingiot.seiminteractive.io',
  timeout: 10000,
});

// GET plcs
const plcs = await api.get('/api/plcs');

// GET telemetry with params
const telemetry = await api.get('/api/telemetry/home/plc-01', {
  params: {
    from: '2025-01-07T00:00:00Z',
    to: '2025-01-07T23:59:59Z',
    limit: 500
  }
});

// POST acknowledge alarm
await api.post('/api/alarms/alarm-id/acknowledge');
```

---

## 🧩 Persistencia (Admin)

### GET /api/admin/access

```bash
curl https://testingiot.seiminteractive.io/api/admin/access
```

### GET /api/persist-rules

```bash
curl https://testingiot.seiminteractive.io/api/persist-rules
```

### POST /api/persist-rules

```json
{
  "plantId": "planta-1",
  "gatewayId": "granix-ba-gw-01",
  "plcId": "plc-03",
  "metricId": "temp_head",
  "mode": "hourly",
  "aggregate": "avg"
}
```

---

## 🧱 Dashboards (Admin)

### GET /api/admin/tenants/:tenantId/plants/:plantId/plcs

```bash
curl https://testingiot.seiminteractive.io/api/admin/tenants/<tenantId>/plants/<plantId>/plcs
```

### GET /api/admin/plcs/:plcId/dashboard

```bash
curl https://testingiot.seiminteractive.io/api/admin/plcs/<plcId>/dashboard
```

### POST /api/admin/plcs/:plcId/dashboard

```json
{
  "name": "Linea 1 - PLC 03",
  "iconUrl": "https://firebasestorage.googleapis.com/..."
}
```

### POST /api/admin/dashboards/:dashboardId/widgets

```json
{
  "widgetKey": "temp_head",
  "type": "gauge",
  "label": "Temp Cabezal",
  "metricId": "temp_head",
  "unit": "celsius",
  "dataType": "float",
  "configJson": { "max": 120 },
  "layoutJson": { "row": 1, "col": 1, "width": 1, "height": 1 },
  "sortOrder": 0,
  "isVisible": true
}
```

---

## 🌐 Dashboard público (read-only)

```
GET /tenants/:tenantSlug/plants/:plantId/plcs/:plcId/dashboard
```

---

## 🧪 Testing con curl

### Health check
```bash
curl -i https://testingiot.seiminteractive.io/health
```

### GET con headers
```bash
curl -H "Accept: application/json" \
     https://testingiot.seiminteractive.io/api/plcs
```

### GET con query params
```bash
curl -G \
  --data-urlencode "from=2025-01-07T00:00:00Z" \
  --data-urlencode "to=2025-01-07T23:59:59Z" \
  --data-urlencode "limit=100" \
  https://testingiot.seiminteractive.io/api/telemetry/home/plc-01
```

### POST
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  https://testingiot.seiminteractive.io/api/alarms/alarm-id/acknowledge
```

### Pretty print JSON
```bash
curl -s https://testingiot.seiminteractive.io/api/plcs | jq '.'
```

---

## 📊 Rate Limiting

La API tiene rate limiting configurado:
- **Límite:** 100 requests por minuto por IP
- **Header de respuesta:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`

Si excedes el límite:

**Response 429:**
```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded, retry in 1 minute"
}
```

---

## 🔐 CORS

CORS está configurado para permitir:
- **Origin:** Configurado en `.env.production` (variable `CORS_ORIGIN`)
- **Credentials:** true
- **Methods:** GET, POST, PUT, DELETE, OPTIONS

---

## ❌ Códigos de Error

| Código | Descripción |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 404 | Not Found |
| 429 | Too Many Requests (Rate Limit) |
| 500 | Internal Server Error |
| 503 | Service Unavailable (MQTT disconnected) |

---

**Última actualización:** Enero 2025
