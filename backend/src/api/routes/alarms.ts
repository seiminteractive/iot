import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { acknowledgeAlarm } from '../../services/alarmService.js';

const alarmsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get alarms for a specific machine
  fastify.get<{
    Params: { site: string; machineId: string };
    Querystring: { acknowledged?: string };
  }>('/alarms/:site/:machineId', async (request, reply) => {
    const { site, machineId } = request.params;
    const { acknowledged } = request.query;

    // Find machine
    const machine = await prisma.machine.findUnique({
      where: {
        site_machineId: { site, machineId },
      },
    });

    if (!machine) {
      return reply.code(404).send({ error: 'Machine not found' });
    }

    // Build where clause
    const where: any = {
      machineId: machine.id,
    };

    if (acknowledged !== undefined) {
      where.acknowledged = acknowledged === 'true';
    }

    // Query alarms
    const alarms = await prisma.alarm.findMany({
      where,
      orderBy: {
        ts: 'desc',
      },
    });

    return reply.send(alarms);
  });

  // Get all alarms
  fastify.get<{
    Querystring: { acknowledged?: string; severity?: string; limit?: string };
  }>('/alarms', async (request, reply) => {
    const { acknowledged, severity, limit = '100' } = request.query;

    const where: any = {};

    if (acknowledged !== undefined) {
      where.acknowledged = acknowledged === 'true';
    }

    if (severity) {
      where.severity = severity;
    }

    const alarms = await prisma.alarm.findMany({
      where,
      orderBy: {
        ts: 'desc',
      },
      take: parseInt(limit, 10),
      include: {
        machine: {
          select: {
            site: true,
            machineId: true,
            name: true,
          },
        },
      },
    });

    return reply.send(alarms);
  });

  // Acknowledge an alarm
  fastify.post<{
    Params: { id: string };
  }>('/alarms/:id/acknowledge', async (request, reply) => {
    const { id } = request.params;

    try {
      await acknowledgeAlarm(id);
      return reply.send({ success: true, message: 'Alarm acknowledged' });
    } catch (error) {
      return reply.code(400).send({ error: 'Failed to acknowledge alarm' });
    }
  });
};

export default alarmsRoutes;
