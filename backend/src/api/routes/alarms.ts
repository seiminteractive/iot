import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { acknowledgeAlarm } from '../../services/alarmService.js';
import { allowedPlants, requireRole } from '../utils/authz.js';
import { getTenantContext } from '../utils/tenant.js';

const alarmsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get alarms for a specific PLC
  fastify.get<{
    Params: { plant: string; plcThingName: string };
    Querystring: { acknowledged?: string };
  }>('/alarms/:plant/:plcThingName', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { plant, plcThingName } = request.params;
    const { acknowledged } = request.query;
    const tenant = await getTenantContext(request);
    if (!tenant) {
      return reply.code(403).send({ error: 'Invalid tenant' });
    }
    const plants = allowedPlants(request);

    if (!plants.includes('*') && !plants.includes(plant)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Find PLC
    const plantRecord = await prisma.plant.findFirst({
      where: { tenantId: tenant.id, plantId: plant },
      select: { id: true },
    });

    if (!plantRecord) {
      return reply.code(404).send({ error: 'Plant not found' });
    }

    const plc = await prisma.plc.findUnique({
      where: {
        tenantId_plantId_plcThingName: {
          tenantId: tenant.id,
          plantId: plantRecord.id,
          plcThingName,
        },
      },
    });

    if (!plc) {
      return reply.code(404).send({ error: 'PLC not found' });
    }

    // Build where clause
    const where: any = {
      tenantId: tenant.id,
      plantId: plantRecord.id,
      plcId: plc.id,
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
    const tenant = await getTenantContext(request);
    if (!tenant) {
      return reply.code(403).send({ error: 'Invalid tenant' });
    }
    const plants = allowedPlants(request);

    const where: any = {
      tenantId: tenant.id,
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
        plc: {
          select: {
            plcThingName: true,
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
