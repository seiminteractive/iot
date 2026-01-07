import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';

const telemetryRoutes: FastifyPluginAsync = async (fastify) => {
  // Get telemetry for a specific machine
  fastify.get<{
    Params: { site: string; machineId: string };
    Querystring: { from?: string; to?: string; limit?: string };
  }>('/telemetry/:site/:machineId', async (request, reply) => {
    const { site, machineId } = request.params;
    const { from, to, limit = '1000' } = request.query;

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
    const { limit = '100' } = request.query;

    const telemetry = await prisma.telemetryEvent.findMany({
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

    return reply.send(telemetry);
  });
};

export default telemetryRoutes;
