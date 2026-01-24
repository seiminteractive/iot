import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { allowedPlants, requireRole } from '../utils/authz.js';
import { getTenantContext } from '../utils/tenant.js';

const plcsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all PLCs (tenant-scoped)
  fastify.get('/plcs', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenant = await getTenantContext(request);
    if (!tenant) {
      return reply.code(403).send({ error: 'Invalid tenant' });
    }
    const plants = allowedPlants(request);

    const plcs = await prisma.plc.findMany({
      where: {
        tenantId: tenant.id,
        ...(plants.includes('*') ? {} : { plantId: { in: plants } }),
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

    return reply.send(plcs);
  });

  // Get PLCs by plant (using plant UUID)
  fastify.get<{ Params: { plantId: string } }>(
    '/plcs/by-plant/:plantId',
    async (request, reply) => {
      if (!requireRole(request, 'viewer')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { plantId } = request.params;
      const tenant = await getTenantContext(request);
      if (!tenant) {
        return reply.code(403).send({ error: 'Invalid tenant' });
      }

      // Verify plant exists and belongs to tenant
      const plant = await prisma.plant.findFirst({
        where: { id: plantId, tenantId: tenant.id },
        select: { id: true, plantId: true },
      });
      if (!plant) {
        return reply.code(404).send({ error: 'Plant not found' });
      }

      const plants = allowedPlants(request);
      if (!plants.includes('*') && !plants.includes(plant.id)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const plcs = await prisma.plc.findMany({
        where: {
          tenantId: tenant.id,
          plantId: plant.id,
        },
        include: {
          state: true,
          plant: {
            select: { plantId: true, province: true, name: true },
          },
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

      return reply.send(plcs);
    }
  );

  // Get PLCs by plant (legacy: using plantId string)
  fastify.get<{ Params: { plant: string } }>(
    '/plcs/:plant',
    async (request, reply) => {
      if (!requireRole(request, 'viewer')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { plant } = request.params;
      const tenant = await getTenantContext(request);
      if (!tenant) {
        return reply.code(403).send({ error: 'Invalid tenant' });
      }
      
      // Resolve plantId string to UUID
      const plantRecord = await prisma.plant.findFirst({
        where: { tenantId: tenant.id, plantId: plant },
        select: { id: true },
      });
      
      if (!plantRecord) {
        return reply.code(404).send({ error: 'Plant not found' });
      }
      
      const plants = allowedPlants(request);

      if (!plants.includes('*') && !plants.includes(plantRecord.id)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const plcs = await prisma.plc.findMany({
        where: {
          tenantId: tenant.id,
          plantId: plantRecord.id,
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

      return reply.send(plcs);
    }
  );

  // Get specific PLC
  fastify.get<{ Params: { plant: string; plcThingName: string } }>(
    '/plcs/:plant/:plcThingName',
    async (request, reply) => {
      if (!requireRole(request, 'viewer')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { plant, plcThingName } = request.params;
      const tenant = await getTenantContext(request);
      if (!tenant) {
        return reply.code(403).send({ error: 'Invalid tenant' });
      }
      
      // Resolve plantId string to UUID
      const plantRecord = await prisma.plant.findFirst({
        where: { tenantId: tenant.id, plantId: plant },
        select: { id: true },
      });

      if (!plantRecord) {
        return reply.code(404).send({ error: 'Plant not found' });
      }
      
      const plants = allowedPlants(request);

      if (!plants.includes('*') && !plants.includes(plantRecord.id)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const plc = await prisma.plc.findUnique({
        where: {
          tenantId_plantId_plcThingName: {
            tenantId: tenant.id,
            plantId: plantRecord.id,
            plcThingName,
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

      if (!plc) {
        return reply.code(404).send({ error: 'PLC not found' });
      }

      return reply.send(plc);
    }
  );

  // Get PLC state
  fastify.get<{ Params: { plant: string; plcThingName: string } }>(
    '/plcs/:plant/:plcThingName/state',
    async (request, reply) => {
      if (!requireRole(request, 'viewer')) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const { plant, plcThingName } = request.params;
      const tenant = await getTenantContext(request);
      if (!tenant) {
        return reply.code(403).send({ error: 'Invalid tenant' });
      }
      
      // Resolve plantId string to UUID
      const plantRecord = await prisma.plant.findFirst({
        where: { tenantId: tenant.id, plantId: plant },
        select: { id: true },
      });

      if (!plantRecord) {
        return reply.code(404).send({ error: 'Plant not found' });
      }
      
      const plants = allowedPlants(request);

      if (!plants.includes('*') && !plants.includes(plantRecord.id)) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const plc = await prisma.plc.findUnique({
        where: {
          tenantId_plantId_plcThingName: {
            tenantId: tenant.id,
            plantId: plantRecord.id,
            plcThingName,
          },
        },
        include: {
          state: true,
        },
      });

      if (!plc) {
        return reply.code(404).send({ error: 'PLC not found' });
      }

      return reply.send(plc.state);
    }
  );

  // Get all plants for user (returns full objects with id, plantId, province, name)
  fastify.get('/sites', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenant = await getTenantContext(request);
    if (!tenant) {
      return reply.code(403).send({ error: 'Invalid tenant' });
    }
    const plants = allowedPlants(request);

    const plantRecords = await prisma.plant.findMany({
      where: {
        tenantId: tenant.id,
        ...(plants.includes('*') ? {} : { id: { in: plants } }),
      },
      select: {
        id: true,
        plantId: true,
        province: true,
        name: true,
      },
      orderBy: [
        { province: 'asc' },
        { plantId: 'asc' },
      ],
    });

    return reply.send(plantRecords);
  });
};

export default plcsRoutes;
