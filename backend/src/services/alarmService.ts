import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';

export interface AlarmData {
  machineId: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Create an alarm for a machine
 */
export async function createAlarm(data: AlarmData): Promise<void> {
  try {
    // Find machine by machineId (assuming it's the internal UUID)
    const alarm = await prisma.alarm.create({
      data: {
        machineId: data.machineId,
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
export async function acknowledgeAlarm(alarmId: string): Promise<void> {
  try {
    await prisma.alarm.update({
      where: { id: alarmId },
      data: { acknowledged: true },
    });

    logger.info({ alarmId }, 'Alarm acknowledged');
  } catch (error) {
    logger.error({ error, alarmId }, 'Failed to acknowledge alarm');
    throw error;
  }
}

/**
 * Get alarms for a machine
 */
export async function getAlarms(machineId: string, acknowledged?: boolean) {
  return prisma.alarm.findMany({
    where: {
      machineId,
      ...(acknowledged !== undefined && { acknowledged }),
    },
    orderBy: {
      ts: 'desc',
    },
  });
}
