import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { allowedPlants, requireRole } from '../utils/authz.js';

const telemetryRoutes: FastifyPluginAsync = async (fastify) => {
  // Get telemetry for a specific machine
  fastify.get<{
    Params: { plant: string; machineId: string };
    Querystring: { from?: string; to?: string; limit?: string };
  }>('/telemetry/:plant/:machineId', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { plant, machineId } = request.params;
    const { from, to, limit = '1000' } = request.query;
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

    if (from || to) {
      where.ts = {};
      if (from) where.ts.gte = new Date(from);
      if (to) where.ts.lte = new Date(to);
    }

    // Query telemetry
    const telemetry = await prisma.telemetryEvent.findMany({
      where,
      orderBy: {
        ts: 'desc',
      },
      take: parseInt(limit, 10),
    });

    return reply.send(telemetry);
  });

  // Get latest telemetry across all machines
  fastify.get<{
    Querystring: { limit?: string };
  }>('/telemetry/latest', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { limit = '100' } = request.query;
    const tenantId = request.user!.tenantId;
    const plants = allowedPlants(request);

    const telemetry = await prisma.telemetryEvent.findMany({
      where: {
        tenantId,
        ...(plants.includes('*') ? {} : { plant: { plantId: { in: plants } } }),
      },
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

    return reply.send(telemetry);
  });
};

export default telemetryRoutes;
