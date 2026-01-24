import { prisma } from '../db/prisma.js';
import { PersistAggregate } from '@prisma/client';
import { broadcastAggregatedUpdate } from '../ws/broadcast.js';

/**
 * Calcula el bucket (inicio del intervalo) para un timestamp dado
 * @param timestamp - Timestamp en milisegundos
 * @param intervalMinutes - Duración del intervalo en minutos
 * @returns Date del inicio del bucket
 */
export function getBucket(timestamp: number, intervalMinutes: number): Date {
  const date = new Date(timestamp);
  const totalMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const bucketMinutes = Math.floor(totalMinutes / intervalMinutes) * intervalMinutes;
  const bucketHours = Math.floor(bucketMinutes / 60);
  const bucketMins = bucketMinutes % 60;
  
  date.setUTCHours(bucketHours, bucketMins, 0, 0);
  return date;
}

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function upsertTelemetryAggregated(params: {
  tenantId: string;
  plantId: string;
  gatewayId: string;
  plcId: string;
  metricId: string;
  timestamp: number;
  value: unknown;
  intervalMinutes: number;
  aggregate?: PersistAggregate;
}): Promise<void> {
  const {
    tenantId,
    plantId,
    gatewayId,
    plcId,
    metricId,
    timestamp,
    value,
    intervalMinutes,
    aggregate,
  } = params;
  void aggregate; // Se usa al consultar, no al guardar
  
  const bucket = getBucket(timestamp, intervalMinutes);
  const numericValue = isNumeric(value) ? value : null;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.telemetryAggregated.findUnique({
      where: {
        tenantId_plantId_gatewayId_plcId_metricId_bucket_intervalMinutes: {
          tenantId,
          plantId,
          gatewayId,
          plcId,
          metricId,
          bucket,
          intervalMinutes,
        },
      },
    });

    if (!existing) {
      await tx.telemetryAggregated.create({
        data: {
          tenantId,
          plantId,
          gatewayId,
          plcId,
          metricId,
          bucket,
          intervalMinutes,
          count: 1,
          sum: numericValue ?? undefined,
          min: numericValue ?? undefined,
          max: numericValue ?? undefined,
          lastValueJson: value as any,
          lastTs: new Date(timestamp),
        },
      });
      return;
    }

    const nextCount = existing.count + 1;
    const nextSum = numericValue !== null
      ? (existing.sum ?? 0) + numericValue
      : existing.sum ?? undefined;
    const nextMin = numericValue !== null
      ? Math.min(existing.min ?? numericValue, numericValue)
      : existing.min ?? undefined;
    const nextMax = numericValue !== null
      ? Math.max(existing.max ?? numericValue, numericValue)
      : existing.max ?? undefined;

    await tx.telemetryAggregated.update({
      where: { id: existing.id },
      data: {
        count: nextCount,
        sum: nextSum,
        min: nextMin,
        max: nextMax,
        lastValueJson: value as any,
        lastTs: new Date(timestamp),
      },
    });
  });

  // Notificar a los clientes que hay nuevos datos agregados
  await broadcastAggregatedUpdate({
    tenantId,
    plantId,
    plcId,
    metricId,
    bucket: bucket.toISOString(),
    intervalMinutes,
  });
}
