# 🧠 Especificación Técnica: Módulo de IA Insights

> **Estado:** Lista para implementación (spec v1.2)  
> **Última actualización:** 24 de enero de 2026  
> **Versión:** 1.2 (Exacta, Escalable, Jerárquica por PLC, UUIDs internos)

---

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Alcance / No Alcance](#alcance--no-alcance)
3. [Principios (Reglas de Oro)](#principios-reglas-de-oro)
4. [Arquitectura General](#arquitectura-general)
5. [Configuración (Global / Tenant / Planta)](#configuración-global--tenant--planta)
6. [Metric Catalog + Report Profiles (Option B)](#metric-catalog--report-profiles-option-b)
7. [Fuente de Verdad: Stats Determinísticas](#fuente-de-verdad-stats-determinísticas)
8. [Contrato de Salida IA: `contentJson`](#contrato-de-salida-ia-contentjson)
9. [Modelo de Datos](#modelo-de-datos)
10. [Flujo de Generación (Jobs + Locks)](#flujo-de-generación-jobs--locks)
11. [API Endpoints](#api-endpoints)
12. [UI / UX](#ui--ux)
13. [Costos y Control](#costos-y-control)
14. [Fases de Implementación](#fases-de-implementación)
15. [Preguntas Abiertas](#preguntas-abiertas)
16. [Changelog](#changelog)

---

## Resumen Ejecutivo

### Objetivo
Agregar un módulo de IA con insights **pre-calculados** para:
- **Operarios de planta:** Resumen operativo, anomalías, tendencias y acciones recomendadas.
- **CEO del tenant:** Vista macro multi-planta (ranking, alertas críticas, riesgos, acciones).

### Idea central
El backend genera un **snapshot determinístico (fuente de verdad)** con stats reales; la IA **solo redacta / prioriza** y devuelve una **salida estructurada (JSON)** que el frontend renderiza.

---

## Alcance / No Alcance

### ✅ Alcance (v1.x)
- Insights **programados** (cada X horas/días), no on-demand para usuarios finales.
- Configuración desde **Admin Supremo** (ustedes) en Admin Panel:
  - System prompt global (editable)
  - Prompt CEO por tenant
  - Prompt por planta
  - Selección de métricas por tenant/planta mediante catálogo + perfiles (Option B)
- Almacenamiento de insights con auditoría (hash, versiones, estado, errores).
- UI de lectura para usuario final (operario/CEO).

### ❌ No alcance (por ahora)
- Chat interactivo / preguntas libres.
- Alerts automáticas creadas por IA.
- Envío por email/whatsapp.
- A/B testing automático de prompts.

---

## Principios (Reglas de Oro)

1. **La IA nunca calcula, estima ni inventa KPIs.**  
   Todo número (promedios, deltas, rankings) proviene del backend.

2. **IA = redacción / priorización / recomendaciones** sobre datos exactos.

3. **UUIDs internos + Labels para UI (regla crítica):**
   - Backend usa: UUIDs para tenant, plant, plc, metricId técnico
   - Frontend renderiza: nombres legibles (labels desde MetricCatalog)
   - Usuario final NUNCA ve UUIDs ni keys técnicas (`temp_secadora_1`, etc.)

4. **Auditable y reproducible:** cada insight guarda:
   - snapshot exacto enviado a la IA
   - hash del snapshot
   - versiones de prompts (system + tenant + planta)
   - estado y errores

5. **Escalable:** el cron **no llama a IA**; solo encola jobs.  
   Un worker procesa jobs con **locks distribuidos**.

6. **Desglose jerárquico por PLC:**
   - **Plant Insight:** resumen general + por cada PLC (máquina) desglose de métricas
   - **CEO Insight:** macro cross-plant (rankings, alertas globales, SIN desglose por máquina)

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADMIN PANEL (Supremo)                          │
│  - System Prompt (Global)                                                   │
│  - CEO Prompt por Tenant                                                    │
│  - Plant Prompt por Planta                                                  │
│  - Metric Catalog por Tenant (labels/units + flags)                          │
│  - Report Profiles (topN / flagged + overrides)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND API                                    │
│   Scheduler (cron)  ->  Queue (Redis/SQS)  ->  Workers (IA)                 │
│                                                                              │
│  Scheduler: decide qué generar, encola jobs                                  │
│  Worker: lock + snapshot determinístico + OpenAI + persist AIInsight         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE                                        │
│  - TelemetryAggregated / TelemetryEvent / PlcState / Alarm (ya existen)      │
│  - GlobalConfig (system prompt)                                              │
│  - Tenant.aiConfig / Plant.aiConfig (configs)                                │
│  - MetricCatalog (labels + selección)                                        │
│  - AIInsight (salida estructurada + auditoría + estado)                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                       │
│  - Tab IA (operario): renderiza contentJson de AIInsight                     │
│  - Vista CEO: renderiza contentJson de AIInsight (type=ceo)                  │
│  - Admin Panel: edita prompts + catálogo + perfiles                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuración (Global / Tenant / Planta)

### Global (para todo el sistema)
- `ai_enabled`
- `ai_system_prompt`
- `ai_system_prompt_v` (versión incremental)

### Tenant (por empresa)
Configura el reporte ejecutivo y reglas default:
- `ceoEnabled`
- `ceoPrompt`
- `ceoRefreshInterval` (enum: `weekly`, `biweekly`, `daily`, etc.)
- `defaultModel` (ej `gpt-4o-mini`)
- `language` (ej `es`)
- `strictLabels` (si faltan labels, ¿error o data_gap?)
- `profiles` (plant y ceo)

### Plant (por planta)
Override del comportamiento:
- `enabled`
- `prompt`
- `refreshInterval` (enum: `every6h`, `every12h`, `weekly`, etc.)
- `model` (override)
- `reportProfileOverride` (override de profile plant)
- `metricOverrides` (include/exclude/topN)

---

## Metric Catalog + Report Profiles (Option B)

### Problema a resolver
Cada tenant/planta/plc quiere mirar cosas distintas, pero:
- la UI debe mostrar **labels** siempre (nunca keys técnicas)
- la selección de métricas debe ser configurable sin listas infinitas
- **el metricId es relativo al contexto** (tenant/plant/plc), no global

### Solución (Option B): Scope jerárquico

#### 1) **MetricCatalog** (tabla con scope jerárquico)

Vea sección "Modelo de Datos" para el schema completo.

**Concepto clave:** Cada entrada define metadatos para un `metricId` en un contexto específico (scope):

- **Scope Tenant:** `(tenantId, NULL, NULL, metricId)` → aplica a TODAS las plantas/PLCs del tenant
- **Scope Plant:** `(tenantId, plantId, NULL, metricId)` → aplica a TODOS los PLCs de esa planta
- **Scope PLC:** `(tenantId, plantId, plcId, metricId)` → aplica solo a ese PLC específico

**El unique constraint `@@unique([tenantId, plantId, plcId, metricId])` garantiza:**
- ✅ No hay duplicados
- ✅ Cada métrica tiene ONE label en cada scope
- ✅ Imposible inconsistencias

**Bootstrap desde PersistRule + PlcDashboardWidget (proceso completo):**

```
PASO 1: Identificar todas las métricas guardadas (por scope)
  SELECT DISTINCT tenantId, plantId, plcId, metricId FROM PersistRule

PASO 2: Por cada (tenantId, plantId, plcId, metricId):
  Buscar label en PlcDashboardWidget:
    SELECT label, unit FROM PlcDashboardWidget 
    WHERE metricId=X 
    LIMIT 1 (usar el primer dashboard que tenga el widget)

PASO 3: Crear entrada en MetricCatalog
  Si encontró label en widget:
    → label = widget.label
    → unit = widget.unit
    → enabledForAI = true
    → aiPriority = 0 (admin debe ajustar)
  
  Si NO encontró label:
    → label = metricId (placeholder)
    → unit = null
    → enabledForAI = false (requiere revisión)
    → aiPriority = -1

PASO 4: Admin supremo revisa y completa
  - Editar label placeholders
  - Cambiar enabledForAI a true
  - Asignar aiPriority (0-100)
  - Marcar keyForCEO / keyForPlant si aplica
```

**Endpoint de admin para bootstrap:**
```
POST /api/admin/ai/tenant/:tenantId/metric-catalog/bootstrap
→ Ejecuta los 4 pasos arriba
→ Retorna: "X nuevas métricas importadas, Y requieren revisión"
```

**Regla crítica:** si falta `label`, esa métrica **no puede** entrar en reportes (enabledForAI=false automáticamente).

#### 2) Report Profiles (por tenant, con override por planta)
Define cómo se eligen métricas sin "hardcode":

- **Profile Plant (default):**
  - `mode=topN`
  - `topN=12` (configurable)
  - `onlyEnabledForAI=true`
  - Orden: `aiPriority desc`

- **Profile CEO (tenant):**
  - `mode=flagged`
  - `flag=keyForCEO`
  - `maxPerPlant=5` (configurable)

#### 3) Overrides por planta (opcional)
- `includeMetricIds`: fuerza inclusión (siempre que tengan label)
- `excludeMetricIds`: fuerza exclusión
- `topN`: override del topN

---

## Resolución Jerárquica de MetricCatalog (Scope)

### Concepto: "Buscar en cascada"

Cuando el backend necesita obtener los metadatos de una métrica (label, aiPriority, flags), busca en **orden jerárquico**:

```
Contexto: Necesito info de metricId="temp_sec1" 
en tenantId=granix, plantId=cordoba, plcId=silo1

BÚSQUEDA EN CASCADA:
  1️⃣ Buscar exacto (PLC-level):
     SELECT * FROM MetricCatalog 
     WHERE tenantId=granix AND plantId=cordoba AND plcId=silo1 
       AND metricId="temp_sec1"
     ✅ Si encuentra → usar ese
     ❌ Si no encuentra → ir a paso 2
  
  2️⃣ Buscar plant-level:
     SELECT * FROM MetricCatalog 
     WHERE tenantId=granix AND plantId=cordoba AND plcId=NULL 
       AND metricId="temp_sec1"
     ✅ Si encuentra → usar ese
     ❌ Si no encuentra → ir a paso 3
  
  3️⃣ Buscar tenant-level:
     SELECT * FROM MetricCatalog 
     WHERE tenantId=granix AND plantId=NULL AND plcId=NULL 
       AND metricId="temp_sec1"
     ✅ Si encuentra → usar ese
     ❌ Si no encuentra → ir a paso 4
  
  4️⃣ Fallback (SEGURIDAD):
     Si TODAVÍA no encuentra:
       → ERROR: metric "temp_sec1" not configured for (granix, cordoba, silo1)
       → No usar metricId como label (incorrecto)
```

### Ejemplo Real: Tres niveles de configuración

**Setup:**
```
Entry A: (granix, NULL, NULL, "temp_sec1")
  label: "Temperatura Secadora 1" (default global)
  aiPriority: 90

Entry B: (granix, cordoba, NULL, "temp_sec1")
  label: "Temperatura SEC-1 (Córdoba)" (override para Córdoba)
  aiPriority: 85

Entry C: (granix, cordoba, silo1, "temp_sec1")
  label: "Temp SEC-1 Silo-1 específica" (override para Silo 1)
  aiPriority: 75
```

**Queries según contexto:**

```
Query en Buenos Aires (BA-01):
  WHERE tenantId=granix AND plantId=ba, plcId=X AND metricId=temp_sec1
  → No encuentra en paso 1 (PLC-level)
  → No encuentra en paso 2 (Plant-level)
  → Encuentra en paso 3 (Tenant-level) → Entry A
  → Resultado: "Temperatura Secadora 1" (aiPriority=90)

Query en Córdoba (general):
  WHERE tenantId=granix AND plantId=cordoba, plcId=X AND metricId=temp_sec1
  → No encuentra en paso 1 (PLC-level)
  → Encuentra en paso 2 (Plant-level) → Entry B
  → Resultado: "Temperatura SEC-1 (Córdoba)" (aiPriority=85)

Query en Silo 1 de Córdoba:
  WHERE tenantId=granix AND plantId=cordoba, plcId=silo1 AND metricId=temp_sec1
  → Encuentra en paso 1 (PLC-level) → Entry C
  → Resultado: "Temp SEC-1 Silo-1 específica" (aiPriority=75)
```

### Ventajas de la resolución jerárquica

| Caso de uso | Ventaja |
|-------------|---------|
| **Label uniforme** | Define 1 entry tenant-level, aplica a todas las plantas |
| **Override por planta** | Una planta tiene equipamiento diferente → override el label |
| **Override por PLC** | Un PLC específico necesita nomenclatura especial → override |
| **Sin duplicación** | No repites "Temperatura Secadora 1" en 100 PLCs |
| **Mantenibilidad** | Cambias 1 entry → impacta donde aplique automáticamente |

---

## Fuente de Verdad: Stats Determinísticas

### Entrada real disponible hoy (aplicación actual)
En el backend ya existen fuentes:
- `TelemetryAggregated` (histórico agregado por intervalos, con `plcId`)
- `TelemetryEvent` (raw, si aplica)
- `PlcState` (último estado)
- `Alarm` (histórico de alarmas)
- `PlcDashboardWidget` (labels/units, útil para bootstrap)
- `Plc` (información de máquinas: id, name, plcThingName)

### Estructura jerárquica: Tenant → Plant → PLCs → Métricas

El snapshot determinístico respeta la jerarquía natural de la aplicación:

```
Tenant (Granix)
 └─ Plant (Córdoba-01)
    ├─ PLC 1 (Secadora 1, id=uuid-1)
    │  ├─ Métrica: Temperatura (id=temp_sec1, label="Temperatura Secadora 1")
    │  ├─ Métrica: Vibración (id=vibr_sec1, label="Vibración Secadora 1")
    │  └─ Métrica: Potencia (id=power_sec1, label="Potencia Consumida")
    │
    ├─ PLC 2 (Secadora 2, id=uuid-2)
    │  ├─ Métrica: Temperatura
    │  ├─ Métrica: Vibración
    │  └─ Métrica: Potencia
    │
    ├─ PLC 3 (Compresor Central, id=uuid-3)
    │  ├─ Métrica: Presión
    │  └─ Métrica: Consumo
    │
    └─ PLC 4 (Silo Almacén, id=uuid-4)
       ├─ Métrica: Nivel
       └─ Métrica: Humedad
```

### Snapshot Input para Plant (jerarquía explícita)

```json
{
  "plant": { "id": "uuid-plant", "name": "Córdoba-01", "province": "Córdoba" },
  "period": { "start": "2026-01-23T12:00Z", "end": "2026-01-24T12:00Z" },
  "plcs": [
    {
      "id": "uuid-plc-secadora1",
      "name": "Secadora 1",
      "type": "dryer",
      "metrics": [
        {
          "label": "Temperatura Secadora 1",
          "id": "temp_sec1",
          "unit": "°C",
          "stats": { "avg": 52.1, "min": 48.2, "max": 55.8, "last": 52.3 },
          "trend": "+2.3%"
        },
        {
          "label": "Vibración Secadora 1",
          "id": "vibr_sec1",
          "unit": "mm/s",
          "stats": { "avg": 3.2, "min": 2.8, "max": 4.1, "last": 3.5 },
          "trend": "-1.5%"
        }
      ],
      "alarms": [
        { "ts": "2026-01-24T10:32Z", "severity": "warning", "message": "Temperatura elevada" }
      ]
    },
    {
      "id": "uuid-plc-secadora2",
      "name": "Secadora 2",
      "type": "dryer",
      "metrics": [ /* ... */ ],
      "alarms": [ /* ... */ ]
    },
    { /* Compresor, Silo, etc. */ }
  ],
  "dataQuality": {
    "totalExpectedPoints": 2880,
    "actualPoints": 2856,
    "completeness": "99.2%"
  }
}
```

### Output para Plant: contentJson (jerárquico byPlc)

```json
{
  "summary": "Planta Córdoba-01 operó con normalidad en las últimas 24h. Producción 845 ton/día, 3 máquinas en rango óptimo, 1 requiere revisión.",
  "byPlc": [
    {
      "plcId": "uuid-plc-secadora1",
      "plcName": "Secadora 1",
      "type": "dryer",
      "status": "ok",
      "highlights": [
        {
          "label": "Temperatura",
          "value": "52.3 °C",
          "trend": "↗️ +2.3%",
          "status": "ok"
        },
        {
          "label": "Vibración",
          "value": "3.5 mm/s",
          "trend": "↘️ -1.5%",
          "status": "ok"
        }
      ],
      "alerts": [],
      "actions": ["Continuar monitoreo normal"]
    },
    {
      "plcId": "uuid-plc-secadora2",
      "plcName": "Secadora 2",
      "type": "dryer",
      "status": "warning",
      "highlights": [
        {
          "label": "Temperatura",
          "value": "58.5 °C",
          "trend": "↗️ +2.8%",
          "status": "warning"
        }
      ],
      "alerts": [
        {
          "severity": "warning",
          "description": "Temperatura elevada (ideal <55°C, actual 58.5°C)"
        }
      ],
      "actions": ["Revisar sistema de ventilación"]
    }
  ],
  "risks": [
    "Si los picos de temperatura en Secadora 2 persisten, considerar mantenimiento preventivo"
  ],
  "actions": [
    "Revisar Secadora 2 en próximas horas",
    "Continuar monitoreo normal de otras máquinas"
  ],
  "dataQuality": {
    "completeness": "99.2%",
    "gaps": []
  },
  "confidence": 95
}
```

### Output para CEO: contentJson (rankings, sin byPlc)

```json
{
  "summary": "5 plantas en operación. Producción total +3% vs semana anterior. 1 planta con alertas críticas.",
  "ranking": [
    {
      "plantId": "uuid-plant-cba",
      "plantName": "Córdoba-01",
      "position": 1,
      "status": "ok",
      "highlights": [
        { "label": "Eficiencia", "value": "95%", "trend": "↗️ +2%" },
        { "label": "Producción", "value": "845 ton/día", "trend": "→ estable" }
      ]
    },
    {
      "plantId": "uuid-plant-sfe",
      "plantName": "Santa Fe-02",
      "position": 2,
      "status": "ok",
      "highlights": [
        { "label": "Eficiencia", "value": "92%", "trend": "↘️ -1%" }
      ]
    },
    {
      "plantId": "uuid-plant-ba",
      "plantName": "Buenos Aires-01",
      "position": 3,
      "status": "critical",
      "highlights": [],
      "alerts": [
        { "severity": "critical", "description": "Sensor presión offline (2 horas)" }
      ]
    }
  ],
  "criticalAlerts": [
    {
      "plantName": "Buenos Aires-01",
      "severity": "critical",
      "description": "Sensor de presión sin datos desde 10:32"
    }
  ],
  "trends": [
    "Producción total: +3% vs semana anterior",
    "Consumo energético: +5% (revisar tendencia)"
  ],
  "actions": [
    "Revisar conectividad Buenos Aires-01 inmediatamente",
    "Mantenimiento preventivo planificado en Santa Fe-02",
    "Auditar consumo energético (aumento del 5%)"
  ],
  "dataQuality": { "completeness": "98%" },
  "confidence": 92
}
```

> **Nota:** En Plant, cada PLC tiene su propio set de metrics/alerts/actions. En CEO, se usan rankings y alertas globales sin desglose por máquina.


---

## Contrato de Salida IA: `contentJson`

### Regla
El frontend renderiza desde `AIInsight.contentJson`.  
El markdown es opcional (para debug / compat / export).

### Schema v1 Plant (con desglose por PLC)

```json
{
  "summary": "string",  // resumen general de la planta
  "byPlc": [
    {
      "plcId": "uuid",
      "plcName": "string",  // ej: "Secadora 1"
      "status": "ok|warning|critical",
      "highlights": [
        { "label": "string", "value": "string (con unidad)", "trend": "string" }
      ],
      "alerts": [
        { "severity": "critical|warning|info", "description": "string" }
      ],
      "actions": ["string"]
    }
  ],
  "risks": ["string"],  // cross-machine, global
  "actions": ["string"],  // prioritized, global
  "data_gaps": ["string"],
  "confidence": 0
}
```

### Schema v1 CEO (sin desglose PLC, vista macro)

```json
{
  "summary": "string",  // resumen ejecutivo multi-planta
  "ranking": [
    {
      "plantId": "uuid",
      "plantName": "string",
      "status": "ok|warning|critical",
      "position": 1,
      "highlights": [
        { "label": "string", "value": "string", "trend": "string" }
      ],
      "alerts": [
        { "severity": "critical|warning|info", "description": "string" }
      ]
    }
  ],
  "criticalAlerts": [
    { "plantName": "string", "severity": "critical", "description": "string" }
  ],
  "trends": ["string"],  // tendencias globales
  "actions": ["string"],  // acciones estratégicas
  "data_gaps": ["string"],
  "confidence": 0
}
```

### Reglas del contrato
- `label` debe ser **humano** (nunca `metricId` o key técnica).
- `value` debe venir formateado con unidad si aplica (ej `52.3 °C`).
- `trend` debe venir formateado (ej `↗️ +5%`, `→ estable`).
- `confidence` es 0..100 y debe bajar si hay data gaps / baja calidad.
- **Plant**: cada PLC tiene su propio array de highlights/alerts
- **CEO**: no hay desglose por máquina, solo rankings agregados y alertas críticas

---

## Modelo de Datos

> Nota: esto es spec; la implementación en Prisma puede variar, pero estas entidades/campos deben existir.

### `GlobalConfig`
Guarda system prompt global y versiones.

```prisma
model GlobalConfig {
  key       String   @id
  value     String   @db.Text
  updatedAt DateTime @updatedAt @map("updated_at")
  updatedBy String?  @map("updated_by")

  @@map("global_config")
}
```

Keys recomendadas:
- `ai_enabled`
- `ai_system_prompt`
- `ai_system_prompt_v`

### `Tenant.aiConfig` (JSONB)
Debe incluir `ceoPrompt`, `profiles`, etc.

### `Plant.aiConfig` (JSONB)
Debe incluir `prompt`, overrides de métricas/perfil, etc.

### `MetricCatalog` (tabla con scope jerárquico)

**Propósito:** Catálogo centralizado de metadatos de métricas, con resolución jerárquica por scope (tenant/plant/plc).

```prisma
model MetricCatalog {
  id                String   @id @default(uuid()) @db.Uuid
  
  // SCOPE: Dónde aplica esta definición de métrica
  tenantId          String   @map("tenant_id") @db.Uuid
  plantId           String?  @map("plant_id") @db.Uuid      // null = aplica a TODO el tenant
  plcId             String?  @map("plc_id") @db.Uuid        // null = aplica a planta/tenant
  
  // LA MÉTRICA (relativo al scope)
  metricId          String   @map("metric_id")              // ej: "temp_sec1", "pressure_comp"
  
  // METADATA PARA UI
  label             String                                   // ej: "Temperatura Secadora 1" (OBLIGATORIO)
  unit              String?  @map("unit")                    // ej: "°C"
  description       String?  @map("description") @db.Text    // contexto adicional
  
  // FLAGS PARA IA
  enabledForAI      Boolean  @default(true) @map("enabled_for_ai")
  aiPriority        Int      @default(0) @map("ai_priority")  // 0-100, para ranking topN
  keyForCEO         Boolean  @default(false) @map("key_for_ceo")
  keyForPlant       Boolean  @default(false) @map("key_for_plant")
  
  // AUDITORÍA
  catalogVersion    Int      @default(1) @map("catalog_version")
  updatedBy         String? @map("updated_by")               // email del admin
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz
  
  // RELACIONES
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  plant  Plant? @relation(fields: [plantId], references: [id], onDelete: Cascade)
  plc    Plc?   @relation(fields: [plcId], references: [id], onDelete: Cascade)
  
  // ✅ UNIQUE CONSTRAINT: Garantiza unicidad por scope
  // Imposible tener 2 entries con (tenantId, plantId, plcId, metricId) igual
  @@unique([tenantId, plantId, plcId, metricId])
  
  // Índices para queries rápidas
  @@index([tenantId, metricId])
  @@index([tenantId, plantId, metricId])
  @@index([tenantId, plantId, plcId, metricId])
  @@map("metric_catalog")
}
```

**Resolución jerárquica (cuando se consulta un metricId):**

```
Query: dame label de metricId="temp_sec1" en tenantId=granix, plantId=cordoba, plcId=silo1

Búsqueda en cascada:
  1. Buscar exacto: (granix, cordoba, silo1, temp_sec1) ← ESPECÍFICO
  2. Si no encuentra: (granix, cordoba, NULL, temp_sec1) ← PLANT-LEVEL
  3. Si no encuentra: (granix, NULL, NULL, temp_sec1) ← TENANT-LEVEL
  4. Si no encuentra: ERROR (metric no configurada)
  
Resultado: Devuelve el label del nivel más específico disponible
```

**Ejemplos de datos:**

```
Entry 1 (Tenant-level, aplica a TODAS las plantas):
  tenantId: granix-uuid, plantId: NULL, plcId: NULL
  metricId: "temp_sec1"
  label: "Temperatura Secadora 1"
  aiPriority: 90
  keyForCEO: true

Entry 2 (Plant-level, solo para Córdoba):
  tenantId: granix-uuid, plantId: cordoba-uuid, plcId: NULL
  metricId: "pressure_comp"
  label: "Presión Compresor Central"
  aiPriority: 70
  keyForCEO: false

Entry 3 (PLC-level, solo para Silo 1 de Córdoba):
  tenantId: granix-uuid, plantId: cordoba-uuid, plcId: silo1-uuid
  metricId: "humidity"
  label: "Humedad Interior Silo 1"
  aiPriority: 60
  keyForPlant: true
```

### `AIInsight` (tabla, auditable)

```prisma
model AIInsight {
  id               String   @id @default(uuid()) @db.Uuid
  tenantId         String   @map("tenant_id") @db.Uuid
  plantId          String?  @map("plant_id") @db.Uuid  // null = insight CEO
  type             String   // 'plant' | 'ceo'

  status           String   @default("pending") // pending | running | success | error

  // Output para UI (obligatorio)
  contentJson      Json     @map("content_json") @db.JsonB
  // Opcional/derivado
  contentMarkdown  String?  @map("content_markdown") @db.Text

  // Auditoría: reproducibilidad total
  inputSnapshotJson Json    @map("input_snapshot_json") @db.JsonB
  inputHash         String  @map("input_hash")
  promptVersion     String  @map("prompt_version")
  systemPromptVer   String  @map("system_prompt_ver")

  modelUsed        String   @map("model_used")
  promptTokens     Int      @map("prompt_tokens")
  completionTokens Int      @map("completion_tokens")
  totalTokens      Int      @map("total_tokens")

  periodStart      DateTime @map("period_start") @db.Timestamptz
  periodEnd        DateTime @map("period_end") @db.Timestamptz
  expiresAt        DateTime @map("expires_at") @db.Timestamptz

  errorCode        String?  @map("error_code")
  errorMessage     String?  @map("error_message") @db.Text

  generatedAt      DateTime? @map("generated_at") @db.Timestamptz
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  @@index([tenantId, plantId, type])
  @@index([tenantId, type, generatedAt(sort: Desc)])
  @@map("ai_insights")
}
```

---

## Flujo de Generación (Jobs + Locks)

### 1) Scheduler (cron)
Corre cada X minutos/hora:
1. Decide qué generar por tenant/planta según:
   - enabled flags
   - última ejecución
   - expiración (`expiresAt`)
2. Encola jobs:
   - `type=plant`: (tenantId, plantId, period)
   - `type=ceo`: (tenantId, period)

> Regla: el scheduler **no** llama a OpenAI.

### 2) Queue + Worker
El worker procesa jobs:
1. Adquiere lock distribuido: `tenantId + plantId? + type + periodStart + periodEnd`
2. Construye `inputSnapshotJson` (stats determinísticas):
   - **Para Plant:** jerarquía tenant → plant → [PLC1, PLC2, ...] con métricas por PLC
   - **Para CEO:** agregado cross-plant (KPIs por planta, rankings)
3. Construye prompts:
   - **system**: `GlobalConfig.ai_system_prompt` (editable) + version `ai_system_prompt_v`
   - **user**: prompt tenant/planta (según type) + snapshot (en formato compacto)
4. Llama OpenAI (solo redacción/estructura)
5. Valida que el output cumpla schema (`contentJson` con estructura jerárquica)
6. Persiste `AIInsight` (success/error)

### 3) Selección de métricas (determinística)
Para cada job:
- Resolver profile (tenant default + override planta si aplica)
- **Para Plant (por PLC):**
  - Armar set de métricas desde `MetricCatalog`:
    - topN por `aiPriority` (y enabledForAI) para cada PLC
  - Aplicar overrides include/exclude
  - Enforzar labels
- **Para CEO (cross-plant):**
  - topN por `aiPriority` agregado o flagged `keyForCEO` por planta
  - Enforzar labels

### 4) Construcción del Snapshot (ejemplo Plant)
```json
{
  "plant": { "id": "uuid", "name": "Córdoba-01" },
  "plcs": [
    {
      "id": "uuid",
      "name": "Secadora 1",
      "metrics": [
        {
          "label": "Temperatura",
          "id": "temp_secadora_1",
          "value": 52.1,
          "unit": "°C",
          "trend": "+2.3%",
          "avg": 52.1,
          "min": 48.2,
          "max": 55.8
        }
      ]
    },
    { /* Secadora 2, Compresor, Silo, etc. */ }
  ],
  "alarms": { /* resumen */ },
  "period": { "start": "...", "end": "..." }
}
```

La IA recibe esto y genera `contentJson` con `byPlc[]` jerárquico.

---

## Versionado de Prompts y Regeneración de Insights

### Problema
Cuando un Admin edita un prompt (System, CEO o Plant), ¿qué pasa con los insights generados anteriormente?

### Solución: Versionado explícito

Cada prompt tiene una **versión incremental**:

```
GlobalConfig.ai_system_prompt_v = 1  (incrementa cuando admin edita)
Tenant.aiConfig.ceoPromptVersion = 1 (incrementa cuando admin edita)
Plant.aiConfig.promptVersion = 1     (incrementa cuando admin edita)
```

Cada `AIInsight` guarda las versiones con las que fue generado:

```prisma
AIInsight {
  ...
  systemPromptVer   String  // ej: "v1"
  ceoPromptVer      String? // ej: "v2" (solo si type=ceo)
  plantPromptVer    String? // ej: "v1" (solo si type=plant)
  catalogVersion    Int     // versión de MetricCatalog usada
  stale             Boolean @default(false)  // si quedó obsoleto
}
```

### Flujo cuando Admin edita un Prompt

**1. Admin edita System Prompt:**
```
GlobalConfig.ai_system_prompt = "nuevo texto"
GlobalConfig.ai_system_prompt_v = 2  // incrementar
↓
Marcar todos los AIInsight.stale = true
↓
Próximo cron: regenerar TODO (plant + ceo) porque systemPromptVer cambió
```

**2. Admin edita CEO Prompt de un Tenant:**
```
Tenant.aiConfig.ceoPrompt = "nuevo texto"
Tenant.aiConfig.ceoPromptVersion = 2  // incrementar
↓
Marcar todos los AIInsight type=ceo de ese tenant con .stale = true
↓
Próximo cron: regenerar solo los type=ceo de ese tenant
```

**3. Admin edita Plant Prompt de una Planta:**
```
Plant.aiConfig.prompt = "nuevo texto"
Plant.aiConfig.promptVersion = 2  // incrementar
↓
Marcar AIInsight de esa planta con .stale = true
↓
Próximo cron: regenerar solo type=plant de esa planta
```

**4. Admin edita MetricCatalog (ej: cambia label o aiPriority):**
```
MetricCatalog.catalogVersion = 2  // incrementar
↓
Marcar todos AIInsight.stale = true (porque snapshot incluye catalogVersion)
↓
Próximo cron: regenerar TODO (porque métricas cambiaron)
```

### API para Regeneración Manual

Admin supremo puede forzar regeneración sin esperar cron:

```
POST /api/admin/ai/regenerate/plant/:plantId
  → Encola job de tipo plant
  → Marca .stale = false (será regenerado inmediatamente)
  → Respuesta: "Job encolado. Resultado en ~15s"

POST /api/admin/ai/regenerate/ceo/:tenantId
  → Encola job de tipo ceo
  → Marca .stale = false
  → Respuesta: "Job encolado. Resultado en ~15s"
```

### Auditoría: Comparar versiones

El versionado permite comparar:
- "¿Por qué el reporte de hoy es distinto al de ayer?"
  → Revisar: systemPromptVer, ceoPromptVer, catalogVersion, inputSnapshotJson

---

## API Endpoints

### Usuarios finales (solo lectura)
- `GET /api/ai/insights/:plantId`  
  Devuelve último insight `type=plant` para esa planta (si enabled).
- `GET /api/ai/insights/ceo`  
  Devuelve último insight `type=ceo` del tenant del usuario (si ceoEnabled).

**Respuesta mínima (plant/ceo):**
```json
{
  "id": "uuid",
  "type": "plant",
  "contentJson": { },
  "generatedAt": "2026-01-24T12:00:00Z",
  "expiresAt": "2026-01-25T00:00:00Z",
  "periodStart": "2026-01-23T12:00:00Z",
  "periodEnd": "2026-01-24T12:00:00Z"
}
```

### Admin supremo (configuración)
- `GET/PUT /api/admin/ai/global-config` (system prompt + version)
- `GET/PUT /api/admin/ai/tenant/:tenantId` (ceo config + profiles defaults)
- `GET/PUT /api/admin/ai/plant/:plantId` (plant config + overrides)
- `GET/PUT /api/admin/ai/tenant/:tenantId/metric-catalog` (CRUD catálogo)
- `POST /api/admin/ai/regenerate/:plantId` (forzar job plant)
- `POST /api/admin/ai/regenerate/ceo/:tenantId` (forzar job ceo)
- `GET /api/admin/ai/stats/:tenantId` (tokens/costos/volumen)
- `GET /api/admin/ai/insights/:tenantId` (historial y errores)

---

## UI / UX

### Admin Panel (Supremo) — Tab “IA”
Debe incluir 4 áreas:

1) **Global**
- Editor de system prompt (textarea)
- Mostrar `system_prompt_version`
- Botón “Guardar” (incrementa version)

2) **Tenant (CEO)**
- Toggle “Habilitar reporte CEO”
- Frecuencia
- Modelo default
- Prompt CEO
- Profile CEO (flagged + maxPerPlant)

3) **Metric Catalog (por tenant)**
- Tabla editable:
  - metricId (read-only)
  - label (editable, obligatorio)
  - unit (editable)
  - enabledForAI
  - aiPriority
  - keyForCEO / keyForPlant
- Acción “Importar desde dashboards” (bootstrap)

4) **Plantas**
- Lista de plantas con estado IA
- Modal de edición por planta:
  - enabled
  - refreshHours
  - model override
  - prompt de planta
  - overrides include/exclude/topN (opcional)

### Usuario final — Tab "IA" (Operario de Planta)
Renderizar desde `contentJson` (type=plant, con byPlc):
- **Summary:** resumen general de la planta
- **Por cada PLC:**
  - Nombre del PLC (ej: "Secadora 1")
  - Highlights: métricas clave con valores/tendencias (SIEMPRE con labels, NUNCA con keys)
  - Alerts: alertas específicas de ese PLC
  - Actions: acciones para ese PLC
- **Global (cross-machine):**
  - Risks: riesgos identificados
  - Actions: acciones prioritarias
  - Data gaps: si existen
- Mostrar fecha/periodo analizado.
- Si disabled: mensaje "módulo no disponible".

**UX durante generación:**
- Mientras `AIInsight.status = pending` o `running`:
  - Mostrar último insight disponible (si existe) con badge **"⏳ Actualizando..."**
  - O spinner si es primera generación: **"🔄 Analizando datos..."**
  - No bloquear la UI, permitir navegar
  - Cuando finalice (status=success), actualizar automáticamente via WebSocket
- Si status=error:
  - Mostrar último insight válido (si existe)
  - Mostrar error claramente: **"❌ No se pudo generar análisis. Razón: Datos insuficientes (< 30% completeness)"**
  - Botón "Reintentar" (dispara regeneración manual)

### Usuario final — Tab "IA" (CEO)
Renderizar desde `contentJson` (type=ceo):
- **Summary:** resumen ejecutivo multi-planta
- **Ranking:** plantas ordenadas (🥇🥈🥉), con status y KPIs clave
- **Alertas críticas:** solo las de severity=critical
- **Tendencias:** evolución global (producción, eficiencia, etc.)
- **Acciones:** recomendaciones estratégicas
- **Data gaps:** si existen
- SIN desglose por máquina
- Mostrar fecha/periodo analizado.

**UX durante generación (igual que operario):**
- Badge "⏳ Actualizando..." si está en progress
- Error claro si falla
- Auto-update via WebSocket cuando finalice

---

## Costos y Control

### Controles para evitar costos sorpresa
- Concurrency limit (global y por tenant)
- RetentionDays configurable
- TopN y maxPerPlant acotan input tokens
- Strict labels evita reportes “mal formateados”
- Registro de tokens por insight (prompt/completion/total)

### Modelos recomendados
- Default: `gpt-4o-mini`
- Premium (opcional por tenant/planta): `gpt-4o`

---

## Fases de Implementación

### Fase 1 (MVP productivo)
- MetricCatalog (CRUD + bootstrap)
- GlobalConfig (system prompt editable + version)
- Tenant/Plant aiConfig (profiles + overrides)
- AIInsight con auditoría (contentJson + snapshot + hash + status)
- Scheduler + Queue + Worker + locks
- Endpoints lectura (usuario) + endpoints admin (config)
- UI Admin Tab IA (mínimo viable)
- UI Usuario Tab IA (render contentJson)

### Fase 2 (Polish)
- Estadísticas por tenant (costo mensual, insights, errores)
- Historial y compare de prompts (auditoría)
- Preview de prompt/snapshot (sin llamar IA o con “dry run”)

---

## Preguntas Abiertas

1. **¿Queue technology?** (Redis queue vs SQS) — depende del despliegue actual.
2. **¿StrictLabels default?** recomendado: `true` para tenants premium, `false` para pilotos.
3. **¿Cuántos PLCs muestra por planta?** Todos los que haya (mejor desglose detallado).
4. **¿Cuántas plantas en ranking CEO?** Todas (si son <10) o top 10 + bottom 5 (si son muchas).
5. **¿Formato/locale por tenant?** idioma `es` ahora; dejar el campo para futuro.
6. **¿Qué hacemos si no hay suficientes datos?**
   - `contentJson.data_gaps` + `confidence` bajo, y mensaje claro.
7. **¿Los PLCs deben tener nombre/label?** Sí. El campo `Plc.name` es obligatorio o inferirse de `plcThingName`.

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 Draft | 23/01/2026 | Versión inicial (sin producción) |
| 1.1 | 24/01/2026 | Fuente de verdad determinística, MetricCatalog + profiles (option B), `contentJson` obligatorio, auditoría (snapshot/hash/version/status), jobs+locks |
| 1.2 | 24/01/2026 | Enum `RefreshInterval`, UUIDs internos + labels legibles en UI, estructura jerárquica **byPlc** para Plant insights, CEO sin desglose por máquina, actualización del Admin Panel (tab "IA" separada) |
| 1.2.1 | 24/01/2026 | Bootstrap detallado de MetricCatalog desde PersistRule, versionado de prompts con regeneración automática (stale), UX durante generación (badges "Actualizando", error handling, WebSocket updates) |
| 1.2.2 | 24/01/2026 | MetricCatalog con scope jerárquico (tenantId, plantId, plcId, metricId), unique constraint multi-columna, resolución en cascada, elimina ambigüedades y garantiza consistencia |

