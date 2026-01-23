import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { allowedPlants, requireRole } from '../utils/authz.js';
import { getTenantContext } from '../utils/tenant.js';

const telemetryRoutes: FastifyPluginAsync = async (fastify) => {
  // Get telemetry for a specific PLC
  fastify.get<{
    Params: { plant: string; plcThingName: string };
    Querystring: { from?: string; to?: string; limit?: string };
  }>('/telemetry/:plant/:plcThingName', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { plant, plcThingName } = request.params;
    const { from, to, limit = '1000' } = request.query;
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

  // Get latest telemetry across all PLCs
  fastify.get<{
    Querystring: { limit?: string };
  }>('/telemetry/latest', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const { limit = '100' } = request.query;
    const tenant = await getTenantContext(request);
    if (!tenant) {
      return reply.code(403).send({ error: 'Invalid tenant' });
    }
    const plants = allowedPlants(request);

    const telemetry = await prisma.telemetryEvent.findMany({
      where: {
        tenantId: tenant.id,
        ...(plants.includes('*') ? {} : { plant: { plantId: { in: plants } } }),
      },
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

    return reply.send(telemetry);
  });

  // Get hourly aggregated telemetry
  fastify.get<{
    Querystring: {
      plant?: string;
      gatewayId?: string;
      plcThingName?: string;
      metricId?: string;
      from?: string;
      to?: string;
      limit?: string;
    };
  }>('/telemetry/hourly', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const {
      plant,
      gatewayId,
      plcThingName,
      metricId,
      from,
      to,
      limit = '500',
    } = request.query;
    const tenant = await getTenantContext(request);
    if (!tenant) {
      return reply.code(403).send({ error: 'Invalid tenant' });
    }
    const plants = allowedPlants(request);

    if (plant && !plants.includes('*') && !plants.includes(plant)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const where: any = {
      tenantId: tenant.id,
      ...(metricId ? { metricId } : {}),
      ...(plants.includes('*') ? {} : { plant: { plantId: { in: plants } } }),
    };

    if (from || to) {
      where.hour = {};
      if (from) where.hour.gte = new Date(from);
      if (to) where.hour.lte = new Date(to);
    }

    if (plant) {
      const plantRecord = await prisma.plant.findFirst({
        where: { tenantId: tenant.id, plantId: plant },
        select: { id: true },
      });
      if (!plantRecord) {
        return reply.code(404).send({ error: 'Plant not found' });
      }
      where.plantId = plantRecord.id;
    }

    if (plcThingName) {
      const plcRecord = await prisma.plc.findFirst({
        where: {
          tenantId: tenant.id,
          plcThingName,
          ...(plant ? { plant: { plantId: plant } } : {}),
        },
        select: { id: true },
      });
      if (!plcRecord) {
        return reply.code(404).send({ error: 'PLC not found' });
      }
      where.plcId = plcRecord.id;
    }

    if (gatewayId) {
      const gatewayRecord = await prisma.gateway.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [{ id: gatewayId }, { gatewayId }],
        },
        select: { id: true },
      });
      if (!gatewayRecord) {
        return reply.code(404).send({ error: 'Gateway not found' });
      }
      where.gatewayId = gatewayRecord.id;
    }

    const results = await prisma.telemetryHourly.findMany({
      where,
      orderBy: { hour: 'desc' },
      take: parseInt(limit, 10),
    });

    return reply.send(results);
  });
};

export default telemetryRoutes;
