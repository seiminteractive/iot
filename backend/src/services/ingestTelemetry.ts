import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { parseTopic } from '../mqtt/parseTopic.js';
import { GatewayStatusMessage, NormalizedMessage } from '../types/index.js';
import { broadcastToClients } from '../ws/broadcast.js';

/**
 * Normalize incoming message to standard format
 */
function normalizeMessage(topic: string, rawPayload: any): NormalizedMessage {
  const parsed = parseTopic(topic);

  if (!parsed.tenant || !parsed.province || !parsed.plant || !parsed.machineId) {
    throw new Error('Invalid telemetry topic format');
  }

  // Check if already normalized (schema field present)
  if (rawPayload.schema && rawPayload.machineId && rawPayload.values && rawPayload.ts) {
    return {
      schema: rawPayload.schema,
      tenant: parsed.tenant,
      province: parsed.province,
      plant: parsed.plant,
      machineId: rawPayload.machineId,
      ts: rawPayload.ts,
      seq: typeof rawPayload.seq === 'number' ? rawPayload.seq : undefined,
      values: rawPayload.values,
      topic,
      raw: rawPayload,
    };
  }

  // Handle KepServer/OPC format: { timestamp, values: [{ id, v, q, t }] }
  if (rawPayload.timestamp && Array.isArray(rawPayload.values)) {
    const convertedValues: Record<string, any> = {};

    for (const item of rawPayload.values) {
      if (item.id && item.v !== undefined) {
        // Convert OPC format to simple key-value
        const key = item.id.split('.').pop() || item.id;
        convertedValues[key] = {
          value: item.v,
          quality: item.q,
          timestamp: item.t,
        };
      }
    }

    return {
      schema: 1,
      tenant: parsed.tenant,
      province: parsed.province,
      plant: parsed.plant,
      machineId: parsed.machineId,
      ts: rawPayload.timestamp,
      seq: typeof rawPayload.seq === 'number' ? rawPayload.seq : undefined,
      values: convertedValues,
      topic,
      raw: rawPayload,
    };
  }

  // Convert simple key-value format (fallback)
  return {
    schema: 1,
    tenant: parsed.tenant,
    province: parsed.province,
    plant: parsed.plant,
    machineId: parsed.machineId,
    ts: Date.now(),
    seq: typeof rawPayload.seq === 'number' ? rawPayload.seq : undefined,
    values: rawPayload,
    topic,
    raw: rawPayload,
  };
}

function normalizeGatewayStatus(topic: string, rawPayload: any): GatewayStatusMessage {
  const parsed = parseTopic(topic);

  if (!parsed.tenant || !parsed.province || !parsed.plant || !parsed.thingName) {
    throw new Error('Invalid gateway status topic format');
  }

  const timestamp = rawPayload.timestamp || Date.now();
  const state = rawPayload.state === 'offline' ? 'offline' : 'online';

  return {
    tenant: parsed.tenant,
    province: parsed.province,
    plant: parsed.plant,
    thingName: parsed.thingName,
    ts: timestamp,
    state,
    version: rawPayload.gateway?.version,
    uptimeSec: rawPayload.gateway?.uptimeSec,
    raw: rawPayload,
  };
}

/**
 * Main ingestion function - handles all incoming telemetry
 */
export async function ingestTelemetry(topic: string, rawPayload: any): Promise<void> {
  try {
    const parsed = parseTopic(topic);

    if (parsed.type === 'gateway_status') {
      const status = normalizeGatewayStatus(topic, rawPayload);

      const tenant = await prisma.tenant.findUnique({
        where: { slug: status.tenant },
      });

      if (!tenant) {
        logger.warn({ topic, tenant: status.tenant }, 'Tenant not found for gateway status');
        return;
      }

      const plant = await prisma.plant.findFirst({
        where: {
          tenantId: tenant.id,
          plantId: status.plant,
          province: status.province,
        },
      });

      if (!plant) {
        logger.warn({ topic, plant: status.plant }, 'Plant not found for gateway status');
        return;
      }

      await prisma.gateway.upsert({
        where: {
          tenantId_thingName: {
            tenantId: tenant.id,
            thingName: status.thingName,
          },
        },
        create: {
          tenantId: tenant.id,
          plantId: plant.id,
          thingName: status.thingName,
          state: status.state,
          version: status.version,
          uptimeSec: status.uptimeSec,
          lastSeenAt: new Date(status.ts),
        },
        update: {
          plantId: plant.id,
          state: status.state,
          version: status.version,
          uptimeSec: status.uptimeSec,
          lastSeenAt: new Date(status.ts),
        },
      });

      await broadcastToClients({
        type: 'gateway_status',
        tenant: status.tenant,
        plant: status.plant,
        thingName: status.thingName,
        ts: status.ts,
      });

      return;
    }

    if (parsed.type !== 'telemetry') {
      logger.warn({ topic }, 'Unknown topic type, skipping');
      return;
    }

    // Normalize message
    const normalized = normalizeMessage(topic, rawPayload);
    logger.debug({ normalized }, 'Normalized message');

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

    // Upsert machine
    const machine = await prisma.machine.upsert({
      where: {
        tenantId_plantId_machineId: {
          tenantId: tenant.id,
          plantId: plant.id,
          machineId: normalized.machineId,
        },
      },
      create: {
        tenantId: tenant.id,
        plantId: plant.id,
        machineId: normalized.machineId,
        name: normalized.machineId,
      },
      update: {},
    });

    const idempotencyKey = typeof normalized.seq === 'number'
      ? `${normalized.tenant}|${normalized.province}|${normalized.plant}|${normalized.machineId}|${normalized.seq}`
      : null;

    // Insert telemetry event (idempotent when seq is present)
    try {
      await prisma.telemetryEvent.create({
        data: {
          tenantId: tenant.id,
          plantId: plant.id,
          machineId: machine.id,
          ts: new Date(normalized.ts),
          topic: normalized.topic,
          seq: normalized.seq,
          idempotencyKey,
          valuesJson: normalized.values,
          rawJson: normalized.raw,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        logger.warn({ idempotencyKey }, 'Duplicate telemetry ignored');
        return;
      }
      throw error;
    }

    // Update machine state
    await prisma.machineState.upsert({
      where: {
        machineId: machine.id,
      },
      create: {
        machineId: machine.id,
        tenantId: tenant.id,
        plantId: plant.id,
        lastTs: new Date(normalized.ts),
        lastValuesJson: normalized.values,
      },
      update: {
        lastTs: new Date(normalized.ts),
        lastValuesJson: normalized.values,
      },
    });

    logger.info(
      { tenant: normalized.tenant, plant: normalized.plant, machineId: normalized.machineId },
      'Telemetry ingested successfully'
    );

    // Broadcast to WebSocket clients
    await broadcastToClients({
      type: 'telemetry',
      tenant: normalized.tenant,
      plant: normalized.plant,
      machineId: normalized.machineId,
      ts: normalized.ts,
      values: normalized.values,
    });
  } catch (error) {
    logger.error({ error, topic, rawPayload }, 'Failed to ingest telemetry');
    throw error;
  }
}
