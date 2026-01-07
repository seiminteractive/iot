import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';

const machinesRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all machines
  fastify.get('/machines', async (request, reply) => {
    const machines = await prisma.machine.findMany({
      include: {
        state: true,
        _count: {
          select: {
            telemetryEvents: true,
            alarms: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reply.send(machines);
  });

  // Get machines by site
  fastify.get<{ Params: { site: string } }>(
    '/machines/:site',
    async (request, reply) => {
      const { site } = request.params;

      const machines = await prisma.machine.findMany({
        where: { site },
        include: {
          state: true,
          _count: {
            select: {
              telemetryEvents: true,
              alarms: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return reply.send(machines);
    }
  );

  // Get specific machine
  fastify.get<{ Params: { site: string; machineId: string } }>(
    '/machines/:site/:machineId',
    async (request, reply) => {
      const { site, machineId } = request.params;

      const machine = await prisma.machine.findUnique({
        where: {
          site_machineId: {
            site,
            machineId,
          },
        },
        include: {
          state: true,
          _count: {
            select: {
              telemetryEvents: true,
              alarms: true,
            },
          },
        },
      });

      if (!machine) {
        return reply.code(404).send({ error: 'Machine not found' });
      }

      return reply.send(machine);
    }
  );

  // Get machine state
  fastify.get<{ Params: { site: string; machineId: string } }>(
    '/machines/:site/:machineId/state',
    async (request, reply) => {
      const { site, machineId } = request.params;

      const machine = await prisma.machine.findUnique({
        where: {
          site_machineId: { site, machineId },
        },
        include: {
          state: true,
        },
      });

      if (!machine) {
        return reply.code(404).send({ error: 'Machine not found' });
      }

      return reply.send(machine.state);
    }
  );

  // Get all sites
  fastify.get('/sites', async (request, reply) => {
    const sites = await prisma.machine.findMany({
      select: {
        site: true,
      },
      distinct: ['site'],
      orderBy: {
        site: 'asc',
      },
    });

    return reply.send(sites.map(s => s.site));
  });
};

export default machinesRoutes;
