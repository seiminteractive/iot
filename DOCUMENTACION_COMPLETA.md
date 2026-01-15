IoT Telemetry System
Documentación Técnica Final – Arquitectura de Producción
Estado: POSIBLE DEFINITIVO
Versión: 1.0
Fecha: Enero 2026

0. Objetivo del documento
Este documento unifica y reemplaza toda la documentación técnica previa (excepto la documentación original histórica) y define la arquitectura final de producción del sistema IoT Telemetry.
Incluye de forma coherente y sin duplicaciones:
Arquitectura MQTT + AWS IoT Core
Modelo Gateway-first (1 Thing por gateway)
Autenticación (Firebase)
Autorización (RBAC)
Ingest Pipeline desacoplado (SQS + DLQ)
Modelo de datos definitivo
Heartbeat por gateway
Idempotencia con seq
Realtime con Redis
Hot vs Cold storage
Este documento es la fuente de verdad del proyecto.

1. Principios no negociables
Multi-tenant end-to-end (MQTT, API, DB, WS).
El topic describe el dato, no el dispositivo.
El gateway es la unidad de conexión (1 Thing por gateway).
Seguridad basada en certificados + policies, no en código.
Backend centralizado, subscriber global.
Ingestión desacoplada desde el día 0.
El sistema debe tolerar duplicados, caídas y reconexiones.

2. Arquitectura general
PLC / Robots
     ↓
Gateway físico (PC fanless)
     ↓ MQTT (TLS, cert X.509)
AWS IoT Core (broker único)
     ↓ IoT Rule
SQS (cola principal) + DLQ
     ↓
Consumers (Fastify / Node)
     ↓
PostgreSQL (hot) + Redis
     ↓
WebSocket (realtime)
     ↓
Frontend (Vue 3)


3. MQTT & AWS IoT Core
3.1 Modelo Gateway-first
1 Thing por gateway físico.
1 certificado X.509 por Thing.
1 policy restrictiva por gateway.
ThingName = clientId MQTT.
3.2 Topics definitivos
Telemetría
factory/{tenant}/{province}/{plant}/{machine}/telemetry

Status por gateway (operativo)
ops/{tenant}/{province}/{plant}/gateway/{thingName}/status

3.3 Wildcards (backend)
factory/+/+/+/+/telemetry
ops/+/+/+/gateway/+/status

4. Heartbeat por gateway (DEFINITIVO)
4.1 Frecuencia
Cada 10 segundos por gateway.
4.2 Payload (online)
{
  "schemaVersion": 1,
  "timestamp": 1736359200000,
  "state": "online",
  "gateway": {
    "thingName": "granix-ba-gateway-1",
    "version": "1.0.0",
    "uptimeSec": 93212
  },
  "health": {
    "internet": "ok",
    "mqtt": "ok",
    "plcLink": "ok",
    "buffer": {
      "mode": "disk",
      "queuedMessages": 0
    }
  }
}

4.3 LWT (offline automático)
Mismo topic
retain: true
qos: 1
{
  "schemaVersion": 1,
  "timestamp": 1736359200000,
  "state": "offline",
  "reason": "unexpected_disconnect"
}




5. Autenticación (Firebase)
Login email/password.
Firebase Authentication.
Sesión persistente.
Flujo
Usuario → Firebase Auth → ID Token (JWT)
                     ↓
              API / WebSocket
                     ↓
          Backend verifica token

El backend es responsable de toda autorización.

6. Autorización (RBAC)
Roles
admin
manager
plant_operator
viewer
Reglas
Cada request tiene contexto: tenantId, role, plantAccess.
Todas las queries filtran por tenantId.
El frontend nunca decide permisos.

7. Ingest Pipeline (DEFINITIVO)
7.1 Flujo
Gateway → MQTT → AWS IoT Core
                    ↓ Rule
                 SQS + DLQ
                    ↓
                Consumers
                    ↓
      Postgres + Redis + PubSub

7.2 Paso a paso del consumer
Validar payload (schemaVersion, timestamp, seq, values).
Parsear topic y extraer tenant/province/plant/machine.
Resolver Tenant y Plant (NO autocrear).
Autocrear Machine en DB si no existe (estado pending).
Construir idempotencyKey con seq.
Insertar TelemetryEvent (unique key).
Actualizar MachineState (last-write-wins por timestamp).
Actualizar gateway.lastSeenAt.
Publicar evento normalizado a Redis Pub/Sub.
Errores → DLQ.

8. Idempotencia (QoS 1)
Cada gateway envía seq incremental por máquina.
Clave:
tenant|province|plant|machine|seq

Duplicados se ignoran automáticamente.

9. Almacenamiento
9.1 Hot (PostgreSQL)
telemetry_events (histórico corto)
machine_state (estado actual)
alarms
9.2 Cold (diseño listo)
S3 + Parquet (futuro)
Analítica / auditoría



10. Redis
Usos:
Pub/Sub para WebSocket (fanout)
Cache de estado actual
Base para escalado horizontal

11. Observabilidad mínima
Logs estructurados con tenant/plant/machine/gateway.
Métricas:
mensajes/seg por tenant
gateways offline
errores por consumer

12. Onboarding operativo
Crear Tenant
Crear Plant
Crear Machines (opcional, autocreate habilitado)
Crear Gateway:
Thing
Certificado
Policy
Instalar certs en gateway
Comenzar publicación MQTT

13. Tecnologías finales
AWS IoT Core
AWS SQS + DLQ
Node.js 20 + Fastify
Prisma ORM
PostgreSQL 16
Redis
Firebase Auth
Docker + Nginx

14. Estado final
Esta arquitectura:
es segura
es escalable
es tolerante a fallos
está lista para vender a múltiples empresas
no requiere rediseño al crecer

FIN – DOCUMENTACIÓN OFICIAL DEL SISTEMA

