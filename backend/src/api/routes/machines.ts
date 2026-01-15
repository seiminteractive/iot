import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { allowedPlants, requireRole } from '../utils/authz.js';

const machinesRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all machines (tenant-scoped)
  fastify.get('/machines', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenantId = request.user!.tenantId;
    const plants = allowedPlants(request);

    const machines = await prisma.machine.findMany({
      where: {
        tenantId,
        ...(plants.includes('*') ? {} : { plant: { plantId: { in: plants } } }),
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reply.send(machines);
  });

  // Get machines by plant
  fastify.get<{ Params: { plant: string } }>(
    '/machines/:plant',
    async (request, reply) => {
      if (!requireRole(request, 'viewer')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { plant } = request.params;
      const tenantId = request.user!.tenantId;
      const plants = allowedPlants(request);

      if (!plants.includes('*') && !plants.includes(plant)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const machines = await prisma.machine.findMany({
        where: {
          tenantId,
          plant: { plantId: plant },
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
        orderBy: {
          createdAt: 'desc',
        },
      });

      return reply.send(machines);
    }
  );

  // Get specific machine
  fastify.get<{ Params: { plant: string; machineId: string } }>(
    '/machines/:plant/:machineId',
    async (request, reply) => {
      if (!requireRole(request, 'viewer')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { plant, machineId } = request.params;
      const tenantId = request.user!.tenantId;
      const plants = allowedPlants(request);

      if (!plants.includes('*') && !plants.includes(plant)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const plantRecord = await prisma.plant.findFirst({
        where: { tenantId, plantId: plant },
        select: { id: true },
      });

      if (!plantRecord) {
        return reply.code(404).send({ error: 'Plant not found' });
      }

      const machine = await prisma.machine.findUnique({
        where: {
          tenantId_plantId_machineId: {
            tenantId,
            plantId: plantRecord.id,
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
  fastify.get<{ Params: { plant: string; machineId: string } }>(
    '/machines/:plant/:machineId/state',
    async (request, reply) => {
      if (!requireRole(request, 'viewer')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { plant, machineId } = request.params;
      const tenantId = request.user!.tenantId;
      const plants = allowedPlants(request);

      if (!plants.includes('*') && !plants.includes(plant)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const plantRecord = await prisma.plant.findFirst({
        where: { tenantId, plantId: plant },
        select: { id: true },
      });

      if (!plantRecord) {
        return reply.code(404).send({ error: 'Plant not found' });
      }

      const machine = await prisma.machine.findUnique({
        where: {
          tenantId_plantId_machineId: {
            tenantId,
            plantId: plantRecord.id,
            machineId,
          },
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

  // Get all plants (legacy: /sites)
  fastify.get('/sites', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenantId = request.user!.tenantId;
    const plants = allowedPlants(request);

    const plantRecords = await prisma.plant.findMany({
      where: {
        tenantId,
        ...(plants.includes('*') ? {} : { plantId: { in: plants } }),
      },
      select: {
        plantId: true,
      },
      orderBy: {
        plantId: 'asc',
      },
    });

    return reply.send(plantRecords.map(p => p.plantId));
  });
};

export default machinesRoutes;
