# Cursor Rule — IoT Telemetry System

## Production Architecture — FINAL v3 (PLC-centric, Minimal Payload, Gateway in Topic)

> ⚠️ **THIS DOCUMENT IS THE SINGLE SOURCE OF TRUTH**  
> ALL previous documentation, rules, assumptions, code paths, schemas, and UI logic are **DEPRECATED** and MUST be removed or updated.

Everything described here MUST be applied globally:

- Backend
- MQTT ingestion
- Consumers
- Database schema
- Admin panel
- Public frontend
- Tests
- Internal documentation

---

## Context

| Field   | Value          |
|---------|----------------|
| Date    | January 2026   |
| Status  | DEFINITIVE     |
| Version | 3.0            |

---

## 0. FINAL ARCHITECTURAL DECISION (SOURCE OF TRUTH)

### 0.1 MQTT Topic Structure

The system is **PLC-centric** with Gateway identification in the topic.

**Hierarchy:**

- 1 Tenant → N Plants
- 1 Plant → N Gateways
- 1 Gateway → N PLCs
- 1 PLC = 1 AWS IoT Thing
- 1 PLC = 1 MQTT topic

#### ❌ OLD TOPIC (DEPRECATED)

```
factory/{tenant}/{province}/{plant}/gateway/{thingName}/telemetry
```

#### ✅ NEW TOPIC (FINAL)

```
factory/{tenant}/{province}/{plant}/{gatewayId}/{plcThingName}/telemetry
```

**Topic Segments:**

| Position | Segment          | Description                              |
|----------|------------------|------------------------------------------|
| 0        | `factory`        | Literal prefix (fixed)                   |
| 1        | `{tenant}`       | Tenant slug                              |
| 2        | `{province}`     | Province/region identifier               |
| 3        | `{plant}`        | Plant identifier                         |
| 4        | `{gatewayId}`    | Gateway identifier (replaces literal `gateway/`) |
| 5        | `{plcThingName}` | PLC AWS IoT ThingName (unique per tenant+plant) |
| 6        | `telemetry`      | Literal suffix (fixed)                   |

**Rules:**

- The literal segment `gateway/` is REMOVED and replaced by `{gatewayId}`
- `{plcThingName}` is the PLC ThingName (AWS IoT Thing identity)
- `{gatewayId}` identifies which gateway the PLC is connected to
- ALL context is derived from the topic — payload contains ONLY telemetry data
- Backend MUST treat `{plcThingName}` as the PLC identity

---

### 0.2 MQTT Wildcards & Subscriptions

#### Backend Subscription Pattern

```
factory/+/+/+/+/+/telemetry
```

This subscribes to ALL telemetry from ALL tenants/plants/gateways/PLCs.

#### Per-Tenant Subscription (if needed)

```
factory/{tenant}/+/+/+/+/telemetry
```

#### Per-Plant Subscription (if needed)

```
factory/{tenant}/{province}/{plant}/+/+/telemetry
```

#### Per-Gateway Subscription (if needed)

```
factory/{tenant}/{province}/{plant}/{gatewayId}/+/telemetry
```

#### Single PLC Subscription

```
factory/{tenant}/{province}/{plant}/{gatewayId}/{plcThingName}/telemetry
```

---

### 0.3 Telemetry Payload — MINIMAL (FINAL)

All telemetry payloads are **minimal and flat**.

#### FINAL PAYLOAD FORMAT

```json
{
  "id": "Simulacion.Envasadora-1.Detenida",
  "v": false,
  "q": true,
  "t": 1768915369511
}
```

#### Field Meaning

| Field | Description                                 |
|-------|---------------------------------------------|
| `id`  | metric identifier (string)                  |
| `v`   | value (boolean \| number \| string \| null) |
| `q`   | quality (boolean or raw Kepware value)      |
| `t`   | timestamp (epoch milliseconds)              |

#### Payload Rules

- Payload MUST contain ONLY: `id`, `v`, `q`, `t`
- Payload MUST be flat (no nested objects)
- Payload MUST NOT include:
  - `tenant`
  - `province`
  - `plant`
  - `gatewayId`
  - `plcId`
  - `type`
  - `schemaVersion`
  - heartbeat/status fields
  - any metadata
- ALL context is derived from the MQTT topic

---

### 0.4 Heartbeat / Status — REMOVED COMPLETELY

The system does **NOT** use:

- heartbeat messages
- status payloads
- secondary topics
- `type = heartbeat`
- gateway or plc status messages

#### Online / Offline Detection (FINAL)

- A PLC is considered **ONLINE** if telemetry is received
- A PLC is considered **OFFLINE** if NO telemetry is received for X seconds
- Timeout is configurable

**Example:**

```env
PLC_OFFLINE_TIMEOUT_SECONDS=30
```

> ⚠️ No heartbeat tables, logic, endpoints, or UI components are allowed.

---

## 1. HIGH-LEVEL ARCHITECTURE

```
PLC / Robot
  → MQTT Client (embedded or Kepware)
  → MQTT (TLS, X.509)
  → AWS IoT Core (single broker)
  → IoT Rule
  → SQS (main queue) + DLQ
  → Consumers (Node.js / Fastify)
  → PostgreSQL (hot) + Redis
  → WebSocket (realtime)
  → Frontend (Vue 3)
```

---

## 2. MQTT & CONSUMER LOGIC (FINAL)

### 2.1 Topic Parsing

From topic:

```
factory/{tenant}/{province}/{plant}/{gatewayId}/{plcThingName}/telemetry
```

Extract:

| Variable        | Source           |
|-----------------|------------------|
| `tenant`        | segment[1]       |
| `province`      | segment[2]       |
| `plant`         | segment[3]       |
| `gatewayId`     | segment[4]       |
| `plcThingName`  | segment[5]       |

### 2.2 Payload Parsing

From payload:

| Variable    | Source        |
|-------------|---------------|
| `metricId`  | `payload.id`  |
| `value`     | `payload.v`   |
| `quality`   | `payload.q`   |
| `timestamp` | `payload.t`   |

### 2.3 Consumer Rules

1. Validate topic structure (7 segments, starts with `factory`, ends with `telemetry`)
2. Extract `tenant`, `province`, `plant`, `gatewayId`, `plcThingName` from topic
3. Validate payload contains `id`, `v`, `t` (minimum required fields)
4. Resolve Tenant by slug (MUST exist — do NOT auto-create)
5. Resolve Plant by `tenantId` + `province` + `plantId` (MUST exist — do NOT auto-create)
6. Resolve or auto-create Gateway by `tenantId` + `gatewayId`
7. Resolve or auto-create PLC by `tenantId` + `plantId` + `plcThingName`
8. Update `plc.last_seen_at` on ANY telemetry message
9. No heartbeat logic exists

---

## 3. DEDUPLICATION & PERSISTENCE (FINAL)

### 3.1 Deduplication

If deduplication is enabled, use:

```
tenant + plant + gatewayId + plcThingName + metricId + timestamp
```

- No `seq`
- No idempotency keys based on `seq`

### 3.2 Persistence Rules

- Backend decides persistence via `persist_rules`
- Payload NEVER encodes business rules

**Rule priority:**

1. PLC-specific
2. Plant-specific
3. Tenant-global

**Modes:**

| Mode     | Target Table        |
|----------|---------------------|
| `raw`    | `telemetry_events`  |
| `hourly` | `telemetry_hourly`  |
| `both`   | Both tables         |
| `none`   | No persistence      |

**Retention:**

- `persist_rules.retention_days` defines retention
- Old data is deleted by scheduled job

---

## 4. DATABASE REQUIREMENTS (MANDATORY)

### 4.1 Entity Identity

| Entity  | Identity Field | Unique Constraint                    |
|---------|----------------|--------------------------------------|
| Tenant  | `slug`         | Global unique                        |
| Plant   | `plant_id`     | Unique per `tenant_id`               |
| Gateway | `gateway_id`   | Unique per `tenant_id`               |
| PLC     | `thing_name`   | Unique per `tenant_id` + `plant_id`  |

### 4.2 Gateway Table

The Gateway table tracks gateway metadata:

**Required fields:**

- `id` (UUID, PK)
- `tenant_id` (FK)
- `plant_id` (FK)
- `gateway_id` (string, from topic)
- `last_seen_at` (timestamp)
- `created_at`
- `updated_at`

### 4.3 PLC Table

**Required fields:**

- `id` (UUID, PK)
- `tenant_id` (FK)
- `plant_id` (FK)
- `gateway_id` (FK)
- `thing_name` (string, from topic — AWS IoT ThingName)
- `last_seen_at` (timestamp)
- `created_at`

### 4.4 telemetry_events

**Required fields:**

- `tenant_id`
- `plant_id`
- `gateway_id`
- `plc_id`
- `metric_id`
- `value` (JSONB)
- `quality`
- `timestamp`

**Remove deprecated columns:**

- `seq`
- `idempotency_key` (if seq-based)

### 4.5 State Tracking

- `plc.last_seen_at` updated on any telemetry
- `gateway.last_seen_at` updated on any telemetry from any of its PLCs
- No heartbeat or status tables exist

---

## 5. DASHBOARDS (FINAL)

- Exactly **ONE** dashboard per PLC
- Dashboards are fully customized per PLC
- Widgets map directly to `metric_id` (`payload.id`)
- Tenant branding icon is stored in `tenants.icon_url`

### Public Read Endpoint

```http
GET /tenants/:tenantSlug/plants/:plantId/plcs/:plcId/dashboard
```

### Admin Endpoints (internal only)

```http
GET    /api/admin/tenants/:tenantId/plants/:plantId/plcs
GET    /api/admin/plcs/:plcId/dashboard
POST   /api/admin/plcs/:plcId/dashboard
PUT    /api/admin/dashboards/:dashboardId
DELETE /api/admin/dashboards/:dashboardId
POST   /api/admin/dashboards/:dashboardId/widgets
PUT    /api/admin/widgets/:widgetId
DELETE /api/admin/widgets/:widgetId
POST   /api/admin/dashboards/:dashboardId/widgets/reorder
POST   /api/admin/plcs/:targetPlcId/dashboard/clone-from/:sourcePlcId
```

---

## 6. ADMIN PANEL RULES

- PLC online/offline derived ONLY from `last_seen_at`
- Offline if `now − last_seen_at > PLC_OFFLINE_TIMEOUT_SECONDS`
- Gateway online/offline derived from its PLCs' activity
- Remove all heartbeat/status UI
- Display Gateway → PLC hierarchy in admin panel

---

## 7. GLOBAL CLEANUP (MANDATORY)

**Remove ALL legacy assumptions:**

- literal `gateway/` segment in topic
- heartbeat/status logic
- `seq`
- nested payload parsing
- payload containing context (tenant, plant, etc.)
- machine naming where it means PLC

**Global search & fix for:**

- `heartbeat`
- `status`
- `seq`
- `schemaVersion`
- `type:`
- `rawPayload.tenant`
- `rawPayload.plant`

> ⚠️ No legacy references may remain.

---

## 8. ACCEPTANCE CRITERIA

- [ ] System ingests telemetry using the NEW topic format
- [ ] Topic parsing extracts: tenant, province, plant, gatewayId, plcThingName
- [ ] Payload parsing works with ONLY `id`/`v`/`q`/`t`
- [ ] No context fields in payload (tenant, plant, etc.)
- [ ] No heartbeat logic exists
- [ ] PLC online/offline works via inactivity timeout
- [ ] Gateway auto-created from topic if missing
- [ ] PLC auto-created from topic if missing
- [ ] Dashboards render correctly using `metric_id`
- [ ] Codebase builds cleanly
- [ ] Tests pass
- [ ] No deprecated fields, topics, or assumptions remain

---

## APPENDIX A — CONFIGURATION (FINAL)

### Required Environment Variables

```env
PLC_OFFLINE_TIMEOUT_SECONDS=30
```

### Optional (tuning)

```env
MQTT_MAX_INFLIGHT_MESSAGES=100
SQS_BATCH_SIZE=10
```

---

## APPENDIX B — AWS IoT POLICIES (PLC-THING)

Each PLC Thing MUST have a restrictive policy:

- Can ONLY publish to its specific topic:

```
factory/{tenant}/{province}/{plant}/{gatewayId}/{plcThingName}/telemetry
```

- Must NOT subscribe
- Must NOT publish to wildcard topics
- Must NOT publish to other PLC topics

**Example IoT Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:topic/factory/acme/cordoba/planta-1/gw-001/plc-envasadora-1/telemetry"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:REGION:ACCOUNT:client/${iot:Connection.Thing.ThingName}"
    }
  ]
}
```

---

## APPENDIX C — SECURITY RULES (NON-NEGOTIABLE)

- PLCs authenticate ONLY via X.509 certificates
- PLCs NEVER know:
  - users
  - roles
  - tenants beyond their own topic
- Authorization happens ONLY in backend
- Admin logic is NEVER embedded in PLCs

---

## APPENDIX D — OPERATIONAL NOTES

- Gateway auto-creation is allowed if tenant and plant exist
- PLC auto-creation is allowed if tenant, plant, and gateway exist (or are auto-created)
- Metric definitions are dynamic
- Unknown `metric_id` is allowed but:
  - persisted ONLY if `persist_rules` allow it
  - dashboard widgets decide visualization

---

## APPENDIX E — MIGRATION CHECKLIST

Before deploying this version:

- [ ] Update topic parsing to extract gatewayId from segment[4]
- [ ] Update topic parsing to extract plcThingName from segment[5]
- [ ] Remove payload context validation (tenant, plant, gatewayId from payload)
- [ ] Update payload parsing to use `id`, `v`, `q`, `t`
- [ ] Add Gateway auto-creation logic
- [ ] Update PLC to reference gateway
- [ ] Remove heartbeat/status columns and logic
- [ ] Remove seq/idempotency logic
- [ ] Update telemetry_events schema
- [ ] Update MQTT subscription wildcards
- [ ] Update admin UI labels
- [ ] Update dashboards metric bindings
- [ ] Update tests
- [ ] Verify IoT policies per PLC
- [ ] Verify offline detection via last_seen_at

---

## APPENDIX F — TOPIC EXAMPLES

### Valid Topics

```
factory/acme/cordoba/planta-1/gw-001/plc-envasadora-1/telemetry
factory/acme/buenos-aires/planta-2/gateway-principal/robot-arm-01/telemetry
factory/cliente-xyz/mendoza/bodega-norte/kepware-01/plc-llenadora/telemetry
```

### Invalid Topics (will be rejected)

```
factory/acme/cordoba/planta-1/gateway/plc-001/telemetry     # ❌ literal "gateway"
factory/acme/cordoba/planta-1/plc-001/telemetry             # ❌ missing gatewayId
acme/cordoba/planta-1/gw-001/plc-001/telemetry              # ❌ missing "factory" prefix
factory/acme/cordoba/planta-1/gw-001/plc-001/status         # ❌ wrong suffix
```

---

## APPENDIX G — FINAL REMINDER

> **This document overrides EVERYTHING else.**
>
> If any code, table, endpoint, UI, test, or document contradicts this file:  
> → **THIS FILE WINS**

---

## END OF DOCUMENT
