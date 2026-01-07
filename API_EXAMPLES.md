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

### Machines

#### GET /api/machines

Lista todas las máquinas registradas.

```bash
curl https://testingiot.seiminteractive.io/api/machines
```

**Response 200:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "site": "home",
    "machineId": "plc-01",
    "name": "plc-01",
    "createdAt": "2025-01-07T10:00:00.000Z",
    "state": {
      "machineId": "550e8400-e29b-41d4-a716-446655440000",
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

#### GET /api/machines/:site

Lista máquinas de un site específico.

```bash
curl https://testingiot.seiminteractive.io/api/machines/home
```

#### GET /api/machines/:site/:machineId

Obtiene una máquina específica.

```bash
curl https://testingiot.seiminteractive.io/api/machines/home/plc-01
```

**Response 200:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "site": "home",
  "machineId": "plc-01",
  "name": "plc-01",
  "createdAt": "2025-01-07T10:00:00.000Z",
  "state": {
    "machineId": "550e8400-e29b-41d4-a716-446655440000",
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
  "error": "Machine not found"
}
```

#### GET /api/machines/:site/:machineId/state

Obtiene el estado actual de una máquina.

```bash
curl https://testingiot.seiminteractive.io/api/machines/home/plc-01/state
```

**Response 200:**
```json
{
  "machineId": "550e8400-e29b-41d4-a716-446655440000",
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

#### GET /api/telemetry/:site/:machineId

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
    "machineId": "550e8400-e29b-41d4-a716-446655440000",
    "ts": "2025-01-07T15:25:00.000Z",
    "topic": "factory/home/plc-01/telemetry",
    "valuesJson": {
      "temperature": 22.6,
      "pressure": 101.3,
      "motorOn": true
    },
    "rawJson": {
      "Temperature": 22.6,
      "Pressure": 101.3,
      "MotorOn": true
    },
    "createdAt": "2025-01-07T15:25:00.100Z"
  }
]
```

#### GET /api/telemetry/latest

Obtiene los últimos eventos de telemetría de todas las máquinas.

**Query Parameters:**
- `limit` (opcional): Número máximo de resultados (default: 100)

```bash
curl "https://testingiot.seiminteractive.io/api/telemetry/latest?limit=50"
```

**Response 200:**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "machineId": "550e8400-e29b-41d4-a716-446655440000",
    "ts": "2025-01-07T15:25:00.000Z",
    "topic": "factory/home/plc-01/telemetry",
    "valuesJson": {
      "temperature": 22.6
    },
    "rawJson": {
      "Temperature": 22.6
    },
    "createdAt": "2025-01-07T15:25:00.100Z",
    "machine": {
      "site": "home",
      "machineId": "plc-01",
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
    "machineId": "550e8400-e29b-41d4-a716-446655440000",
    "ts": "2025-01-07T15:20:00.000Z",
    "type": "temperature_high",
    "message": "Temperature above threshold (25°C)",
    "severity": "high",
    "acknowledged": false,
    "createdAt": "2025-01-07T15:20:00.100Z",
    "machine": {
      "site": "home",
      "machineId": "plc-01",
      "name": "plc-01"
    }
  }
]
```

#### GET /api/alarms/:site/:machineId

Lista alarmas de una máquina específica.

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
const ws = new WebSocket('wss://testingiot.seiminteractive.io/ws?site=home&machineId=plc-01');

// Todos los eventos (wildcard)
const ws = new WebSocket('wss://testingiot.seiminteractive.io/ws?site=*&machineId=*');
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
  "site": "home",
  "machineId": "plc-01",
  "ts": 1704639000000,
  "values": {
    "temperature": 22.6,
    "pressure": 101.3,
    "motorOn": true
  }
}
```

#### Evento de status
```json
{
  "type": "status",
  "site": "home",
  "machineId": "plc-01",
  "ts": 1704639000000,
  "values": {
    "online": true,
    "uptime": 3600000
  }
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
async function getMachines() {
  const response = await fetch('https://testingiot.seiminteractive.io/api/machines');
  const machines = await response.json();
  console.log(machines);
}

// GET con query params
async function getTelemetry(site, machineId, limit = 100) {
  const url = new URL(`https://testingiot.seiminteractive.io/api/telemetry/${site}/${machineId}`);
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

// GET machines
const machines = await api.get('/api/machines');

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

## 🧪 Testing con curl

### Health check
```bash
curl -i https://testingiot.seiminteractive.io/health
```

### GET con headers
```bash
curl -H "Accept: application/json" \
     https://testingiot.seiminteractive.io/api/machines
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
curl -s https://testingiot.seiminteractive.io/api/machines | jq '.'
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
