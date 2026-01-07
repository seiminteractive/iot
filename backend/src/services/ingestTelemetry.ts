import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { parseTopic } from '../mqtt/parseTopic.js';
import { NormalizedMessage } from '../types/index.js';
import { broadcastToClients } from '../ws/connectionManager.js';

/**
 * Normalize incoming message to standard format
 */
function normalizeMessage(topic: string, rawPayload: any): NormalizedMessage {
  const parsed = parseTopic(topic);

  // Check if already normalized (schema field present)
  if (rawPayload.schema && rawPayload.machineId && rawPayload.site && rawPayload.values) {
    return {
      schema: rawPayload.schema,
      machineId: rawPayload.machineId,
      site: rawPayload.site,
      ts: rawPayload.ts || Date.now(),
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
        // id: "Simulation Examples.Functions.Ramp1" → "Ramp1"
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
      machineId: parsed.machineId,
      site: parsed.site,
      ts: rawPayload.timestamp,
      values: convertedValues,
      topic,
      raw: rawPayload,
    };
  }

  // Convert simple key-value format (fallback)
  return {
    schema: 1,
    machineId: parsed.machineId,
    site: parsed.site,
    ts: Date.now(),
    values: rawPayload,
    topic,
    raw: rawPayload,
  };
}

/**
 * Main ingestion function - handles all incoming telemetry
 */
export async function ingestTelemetry(topic: string, rawPayload: any): Promise<void> {
  try {
    // Normalize message
    const normalized = normalizeMessage(topic, rawPayload);

    logger.debug({ normalized }, 'Normalized message');

    // Upsert machine
    const machine = await prisma.machine.upsert({
      where: {
        site_machineId: {
          site: normalized.site,
          machineId: normalized.machineId,
        },
      },
      create: {
        site: normalized.site,
        machineId: normalized.machineId,
        name: normalized.machineId, // Default name
      },
      update: {},
    });

    // Insert telemetry event
    await prisma.telemetryEvent.create({
      data: {
        machineId: machine.id,
        ts: new Date(normalized.ts),
        topic: normalized.topic,
        valuesJson: normalized.values,
        rawJson: normalized.raw,
      },
    });

    // Update machine state
    await prisma.machineState.upsert({
      where: {
        machineId: machine.id,
      },
      create: {
        machineId: machine.id,
        lastTs: new Date(normalized.ts),
        lastValuesJson: normalized.values,
      },
      update: {
        lastTs: new Date(normalized.ts),
        lastValuesJson: normalized.values,
      },
    });

    logger.info(
      { site: normalized.site, machineId: normalized.machineId },
      'Telemetry ingested successfully'
    );

    // Broadcast to WebSocket clients
    const msgType = parseTopic(topic).type;
    const wsType = msgType === 'status' ? 'status' : 'telemetry';
    broadcastToClients({
      type: wsType,
      site: normalized.site,
      machineId: normalized.machineId,
      ts: normalized.ts,
      values: normalized.values,
    });

  } catch (error) {
    logger.error({ error, topic, rawPayload }, 'Failed to ingest telemetry');
    throw error;
  }
}
