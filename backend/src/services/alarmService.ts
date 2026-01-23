import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

export interface AlarmData {
  plcId: string;
  tenantId: string;
  plantId: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Create an alarm for a PLC
 */
export async function createAlarm(data: AlarmData): Promise<void> {
  try {
    const alarm = await prisma.alarm.create({
      data: {
        tenantId: data.tenantId,
        plantId: data.plantId,
        plcId: data.plcId,
        ts: new Date(),
        type: data.type,
        message: data.message,
        severity: data.severity,
      },
    });

    logger.info({ alarm }, 'Alarm created');
  } catch (error) {
    logger.error({ error, data }, 'Failed to create alarm');
    throw error;
  }
}

/**
 * Acknowledge an alarm
 */
export async function acknowledgeAlarm(alarmId: string, tenantId: string): Promise<void> {
  try {
    await prisma.alarm.updateMany({
      where: { id: alarmId, tenantId },
      data: { acknowledged: true },
    });

    logger.info({ alarmId }, 'Alarm acknowledged');
  } catch (error) {
    logger.error({ error, alarmId }, 'Failed to acknowledge alarm');
    throw error;
  }
}

/**
 * Get alarms for a PLC
 */
export async function getAlarms(plcId: string, acknowledged?: boolean) {
  return prisma.alarm.findMany({
    where: {
      plcId,
      ...(acknowledged !== undefined && { acknowledged }),
    },
    orderBy: {
      ts: 'desc',
    },
  });
}
