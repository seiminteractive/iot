import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { acknowledgeAlarm } from '../../services/alarmService.js';
import { allowedPlants, requireRole } from '../utils/authz.js';

const alarmsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get alarms for a specific machine
  fastify.get<{
    Params: { plant: string; machineId: string };
    Querystring: { acknowledged?: string };
  }>('/alarms/:plant/:machineId', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { plant, machineId } = request.params;
    const { acknowledged } = request.query;
    const tenantId = request.user!.tenantId;
    const plants = allowedPlants(request);

    if (!plants.includes('*') && !plants.includes(plant)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Find machine
    const plantRecord = await prisma.plant.findFirst({
      where: { tenantId, plantId: plant },
      select: { id: true },
    });

    if (!plantRecord) {
      return reply.code(404).send({ error: 'Plant not found' });
    }

    const machine = await prisma.machine.findUnique({
      where: {
        tenantId_plantId_machineId: { tenantId, plantId: plantRecord.id, machineId },
      },
    });

    if (!machine) {
      return reply.code(404).send({ error: 'Machine not found' });
    }

    // Build where clause
    const where: any = {
      tenantId,
      plantId: plantRecord.id,
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
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { acknowledged, severity, limit = '100' } = request.query;
    const tenantId = request.user!.tenantId;
    const plants = allowedPlants(request);

    const where: any = {
      tenantId,
      ...(plants.includes('*') ? {} : { plant: { plantId: { in: plants } } }),
    };

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
            machineId: true,
            name: true,
              plant: {
                select: {
                  plantId: true,
                },
              },
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
    if (!requireRole(request, 'plant_operator')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { id } = request.params;

    try {
      await acknowledgeAlarm(id, request.user!.tenantId);
      return reply.send({ success: true, message: 'Alarm acknowledged' });
    } catch (error) {
      return reply.code(400).send({ error: 'Failed to acknowledge alarm' });
    }
  });
};

export default alarmsRoutes;
