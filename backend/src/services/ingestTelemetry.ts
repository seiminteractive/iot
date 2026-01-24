import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { parseTopic } from '../mqtt/parseTopic.js';
import { NormalizedTelemetryMessage } from '../types/index.js';
import { broadcastToClients } from '../ws/broadcast.js';
import { getPersistDecision, resolvePersistRule } from './persistRules.js';
import { upsertTelemetryAggregated } from './hourlyAggregation.js';
import { updatePLCState } from './plcStateTracker.js';

interface MetricValue {
  id: string;
  v: any;
  q?: boolean;
  t: number;
}

interface ArrayPayload {
  timestamp?: number;
  values: MetricValue[];
}

/**
 * Normalize incoming message to standard format
 * Expects payload format: { timestamp?: number, values: [{ id, v, q, t }, ...] }
 */
function normalizeTelemetryMessage(topic: string, rawPayload: any): NormalizedTelemetryMessage {
  const parsed = parseTopic(topic);

  if (!parsed.tenant || !parsed.province || !parsed.plant || !parsed.gatewayId || !parsed.plcThingName) {
    throw new Error('Invalid telemetry topic format');
  }

  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new Error('Invalid telemetry payload');
  }

  // Expect array format: { values: [...] }
  const payload = rawPayload as ArrayPayload;
  
  if (!payload.values || !Array.isArray(payload.values) || payload.values.length === 0) {
    throw new Error('Telemetry payload missing values array');
  }

  // Build values object from all metrics in array
  const values: Record<string, { value: any; quality?: boolean }> = {};
  let latestTimestamp = 0;

  for (const metric of payload.values) {
    if (!metric.id || !Object.prototype.hasOwnProperty.call(metric, 'v') || !metric.t) {
      logger.warn({ metric }, 'Skipping invalid metric in array');
      continue;
    }

    values[metric.id] = {
      value: metric.v,
      quality: metric.q,
    };

    if (metric.t > latestTimestamp) {
      latestTimestamp = metric.t;
    }
  }

  if (Object.keys(values).length === 0) {
    throw new Error('No valid metrics in payload');
  }

  // Use payload timestamp or latest metric timestamp
  const timestamp = payload.timestamp || latestTimestamp;

  return {
    tenant: parsed.tenant,
    province: parsed.province,
    plant: parsed.plant,
    gatewayId: parsed.gatewayId,
    plcThingName: parsed.plcThingName,
    metricId: Object.keys(values)[0], // Primary metric for logging
    timestamp,
    value: null, // Multiple values, use 'values' instead
    quality: true,
    values,
    topic,
    raw: rawPayload,
    metrics: payload.values, // Keep original array for individual processing
  };
}

/**
 * Main ingestion function - handles all incoming telemetry
 */
export async function ingestTelemetry(topic: string, rawPayload: any): Promise<void> {
  try {
    const parsed = parseTopic(topic);

    if (parsed.type !== 'telemetry') {
      logger.warn({ topic }, 'Unknown topic type, skipping');
      return;
    }

    // Normalize message
    const normalized = normalizeTelemetryMessage(topic, rawPayload);
    logger.debug({ metricsCount: Object.keys(normalized.values).length }, 'Normalized message');

    const tenant = await prisma.tenant.findUnique({
      where: { slug: normalized.tenant },
    });

    if (!tenant) {
      logger.warn({ topic, tenant: normalized.tenant }, 'Tenant not found for telemetry');
      return;
    }

    const plant = await prisma.plant.findFirst({
      where: {
        tenantId: tenant.id,
        plantId: normalized.plant,
        province: normalized.province,
      },
    });

    if (!plant) {
      logger.warn({ topic, plant: normalized.plant }, 'Plant not found for telemetry');
      return;
    }

    // Ensure gateway exists for this telemetry
    const gateway = await prisma.gateway.upsert({
      where: {
        tenantId_gatewayId: {
          tenantId: tenant.id,
          gatewayId: normalized.gatewayId,
        },
      },
      create: {
        tenantId: tenant.id,
        plantId: plant.id,
        gatewayId: normalized.gatewayId,
        state: 'online',
        lastSeenAt: new Date(normalized.timestamp),
      },
      update: {
        plantId: plant.id,
        lastSeenAt: new Date(normalized.timestamp),
      },
    });

    // Upsert PLC
    const plc = await prisma.plc.upsert({
      where: {
        tenantId_plantId_plcThingName: {
          tenantId: tenant.id,
          plantId: plant.id,
          plcThingName: normalized.plcThingName,
        },
      },
      create: {
        tenantId: tenant.id,
        plantId: plant.id,
        gatewayId: gateway.id,
        plcThingName: normalized.plcThingName,
        name: normalized.plcThingName,
      },
      update: {
        gatewayId: gateway.id,
      },
    });

    // Process each metric individually for persistence rules
    const metrics = normalized.metrics || [];
    for (const metric of metrics) {
      const metricId = metric.id;
      const metricTs = metric.t;
      const metricValue = metric.v;

      const rule = await resolvePersistRule(
        tenant.id,
        plant.id,
        gateway.id,
        plc.id,
        metricId
      );
      const decision = getPersistDecision(rule);
      const retentionCutoff = new Date(Date.now() - decision.retentionDays * 24 * 60 * 60 * 1000);

      if (decision.storeRaw) {
        // Insert telemetry event per metric
        try {
          await prisma.telemetryEvent.create({
            data: {
              tenantId: tenant.id,
              plantId: plant.id,
              gatewayId: gateway.id,
              plcId: plc.id,
              metricId,
              ts: new Date(metricTs),
              topic: normalized.topic,
              valuesJson: { [metricId]: { value: metricValue, quality: metric.q } },
              rawJson: { id: metric.id, v: metric.v, q: metric.q, t: metric.t },
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            logger.debug({ tenantId: tenant.id, plcId: plc.id, metricId }, 'Duplicate telemetry ignored');
          } else {
            throw error;
          }
        }

        // Cleanup old events for this metric
        await prisma.telemetryEvent.deleteMany({
          where: {
            tenantId: tenant.id,
            plantId: plant.id,
            gatewayId: gateway.id,
            plcId: plc.id,
            metricId,
            ts: { lt: retentionCutoff },
          },
        });
      }

      if (decision.storeAggregated && decision.intervalMinutes) {
        await upsertTelemetryAggregated({
          tenantId: tenant.id,
          plantId: plant.id,
          gatewayId: gateway.id,
          plcId: plc.id,
          metricId,
          timestamp: metricTs,
          value: metricValue,
          intervalMinutes: decision.intervalMinutes,
          aggregate: decision.aggregate,
        });

        await prisma.telemetryAggregated.deleteMany({
          where: {
            tenantId: tenant.id,
            plantId: plant.id,
            gatewayId: gateway.id,
            plcId: plc.id,
            metricId,
            bucket: { lt: retentionCutoff },
          },
        });
      }
    }

    // Update PLC state with ALL metrics (merge with existing)
    const existingState = await prisma.plcState.findUnique({
      where: { plcId: plc.id },
    });

    const mergedValues = {
      ...(existingState?.lastValuesJson as Record<string, any> || {}),
      ...normalized.values,
    };

    await prisma.plcState.upsert({
      where: {
        plcId: plc.id,
      },
      create: {
        plcId: plc.id,
        tenantId: tenant.id,
        plantId: plant.id,
        lastTs: new Date(normalized.timestamp),
        lastValuesJson: mergedValues,
      },
      update: {
        lastTs: new Date(normalized.timestamp),
        lastValuesJson: mergedValues,
      },
    });

    // Update PLC state tracker and emit state change events
    // Usamos la hora actual del servidor (cuando llegó el mensaje), no el timestamp del PLC
    await updatePLCState(
      plc.id,
      normalized.plcThingName,
      tenant.id,
      plant.id,
      new Date() // Hora del servidor cuando se recibe el mensaje
    );

    logger.info(
      { 
        tenant: normalized.tenant, 
        plant: normalized.plant, 
        plcThingName: normalized.plcThingName,
        metricsCount: metrics.length,
      },
      'Telemetry ingested successfully'
    );

    // Broadcast to WebSocket clients
    await broadcastToClients({
      type: 'telemetry',
      // Internal routing fields
      tenantId: tenant.id,
      plantId: plant.id,
      plcId: plc.id,
      plcThingName: normalized.plcThingName,
      gatewayId: normalized.gatewayId,
      ts: normalized.timestamp,
      values: normalized.values,
    });
  } catch (error) {
    logger.error({ error, topic, rawPayload }, 'Failed to ingest telemetry');
    throw error;
  }
}
