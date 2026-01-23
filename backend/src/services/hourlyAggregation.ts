import { prisma } from '../db/prisma.js';
import { PersistAggregate } from '@prisma/client';

export function getHourBucket(timestamp: number): Date {
  const date = new Date(timestamp);
  date.setUTCMinutes(0, 0, 0);
  return date;
}

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function upsertTelemetryHourly(params: {
  tenantId: string;
  plantId: string;
  gatewayId: string;
  plcId: string;
  metricId: string;
  timestamp: number;
  value: unknown;
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
    aggregate,
  } = params;
  void aggregate;
  const hour = getHourBucket(timestamp);
  const numericValue = isNumeric(value) ? value : null;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.telemetryHourly.findUnique({
      where: {
        tenantId_plantId_gatewayId_plcId_metricId_hour: {
          tenantId,
          plantId,
          gatewayId,
          plcId,
          metricId,
          hour,
        },
      },
    });

    if (!existing) {
      await tx.telemetryHourly.create({
        data: {
          tenantId,
          plantId,
          gatewayId,
          plcId,
          metricId,
          hour,
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

    await tx.telemetryHourly.update({
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
}
