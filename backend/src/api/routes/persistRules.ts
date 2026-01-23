import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { requireInternal } from '../utils/authz.js';
import { getTenantContext } from '../utils/tenant.js';
import { logger } from '../../utils/logger.js';

const persistRulesRoutes: FastifyPluginAsync = async (fastify) => {
  // Resuelve el tenant: admins internos usan query param, usuarios normales usan su tenant asignado
  const resolveTenant = async (request: any, reply: any) => {
    const userTenant = request.user?.tenantId;
    const query = request.query as { tenant?: string };
    const tenantSlug = query?.tenant?.trim();

    logger.info({ userTenant, tenantSlug, user: request.user }, 'resolveTenant called');

    // Si es admin interno, usar query param (puede ver todos los tenants)
    if (userTenant === '__internal__') {
      if (!tenantSlug) {
        reply.code(400).send({ error: 'Missing tenant query param (required for admin)' });
        return null;
      }
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        reply.code(404).send({ error: 'Tenant not found' });
        return null;
      }
      return tenant;
    }

    // Para usuarios normales, usar su tenant asignado (ignora query param)
    if (userTenant) {
      const tenant = await getTenantContext(request);
      if (!tenant) {
        reply.code(403).send({ error: 'Invalid tenant' });
        return null;
      }
      return tenant;
    }

    reply.code(403).send({ error: 'No tenant context' });
    return null;
  };

  // Validadores simples: solo aceptan UUIDs
  const validatePlantId = async (tenantId: string, plantId?: string | null) => {
    if (!plantId) return null;
    const plant = await prisma.plant.findFirst({
      where: { id: plantId, tenantId },
      select: { id: true },
    });
    return plant?.id || null;
  };

  const validateGatewayId = async (tenantId: string, gatewayId?: string | null) => {
    if (!gatewayId) return null;
    const gateway = await prisma.gateway.findFirst({
      where: { id: gatewayId, tenantId },
      select: { id: true },
    });
    return gateway?.id || null;
  };

  const validatePlcId = async (tenantId: string, plcId?: string | null) => {
    if (!plcId) return null;
    const plc = await prisma.plc.findFirst({
      where: { id: plcId, tenantId },
      select: { id: true },
    });
    return plc?.id || null;
  };

  fastify.get('/persist-rules', async (request, reply) => {
    const isAdmin = requireInternal(request);
    const query = request.query as { tenant?: string };
    const tenantSlug = query?.tenant?.trim();

    // Admin sin filtro de tenant: devuelve TODAS las reglas de todos los tenants
    if (isAdmin && !tenantSlug) {
      const rules = await prisma.persistRule.findMany({
        include: {
          tenant: { select: { slug: true, name: true } },
          plant: { select: { plantId: true, name: true } },
          gateway: { select: { gatewayId: true } },
          plc: { select: { plcThingName: true, name: true } },
        },
        orderBy: [{ metricId: 'asc' }, { updatedAt: 'desc' }],
      });
      return reply.send(rules);
    }

    // Admin con filtro o usuario normal: requiere tenant específico
    if (!isAdmin) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenant = await resolveTenant(request, reply);
    if (!tenant) return;

    const rules = await prisma.persistRule.findMany({
      where: { tenantId: tenant.id },
      include: {
        tenant: { select: { slug: true, name: true } },
        plant: { select: { plantId: true, name: true } },
        gateway: { select: { gatewayId: true } },
        plc: { select: { plcThingName: true, name: true } },
      },
      orderBy: [{ metricId: 'asc' }, { updatedAt: 'desc' }],
    });

    return reply.send(rules);
  });

  fastify.post('/persist-rules', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenant = await resolveTenant(request, reply);
    if (!tenant) return;
    const body = request.body as {
      plantId?: string | null;
      gatewayId?: string | null;
      plcId?: string | null;
      metricId?: string | null;
      mode?: string | null;
      aggregate?: string | null;
      retentionDays?: number | null;
    };

    if (!body?.metricId || !body?.mode) {
      return reply.code(400).send({ error: 'Missing metricId or mode' });
    }
    const allowedModes = ['raw', 'hourly', 'both', 'none'];
    const allowedAggregates = ['sum', 'avg', 'min', 'max', 'last'];
    if (!allowedModes.includes(body.mode)) {
      return reply.code(400).send({ error: 'Invalid mode' });
    }
    if (body.aggregate && !allowedAggregates.includes(body.aggregate)) {
      return reply.code(400).send({ error: 'Invalid aggregate' });
    }
    if (body.retentionDays !== undefined && (body.retentionDays as number) < 1) {
      return reply.code(400).send({ error: 'Invalid retentionDays' });
    }

    const plantId = await validatePlantId(tenant.id, body.plantId);
    const gatewayId = await validateGatewayId(tenant.id, body.gatewayId);
    const plcId = await validatePlcId(tenant.id, body.plcId);
    if (body.plantId && !plantId) {
      return reply.code(404).send({ error: 'Plant not found' });
    }
    if (body.gatewayId && !gatewayId) {
      return reply.code(404).send({ error: 'Gateway not found' });
    }
    if (body.plcId && !plcId) {
      return reply.code(404).send({ error: 'PLC not found' });
    }

    const rule = await prisma.persistRule.create({
      data: {
        tenantId: tenant.id,
        plantId,
        gatewayId,
        plcId,
        metricId: body.metricId.trim(),
        mode: body.mode as any,
        aggregate: body.aggregate ? (body.aggregate as any) : null,
        retentionDays: typeof body.retentionDays === 'number' ? body.retentionDays : 7,
      },
    });

    return reply.send(rule);
  });

  fastify.put<{ Params: { id: string } }>('/persist-rules/:id', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenant = await resolveTenant(request, reply);
    if (!tenant) return;
    const { id } = request.params;
    const body = request.body as {
      plantId?: string | null;
      gatewayId?: string | null;
      plcId?: string | null;
      metricId?: string | null;
      mode?: string | null;
      aggregate?: string | null;
      retentionDays?: number | null;
    };

    const existing = await prisma.persistRule.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) {
      return reply.code(404).send({ error: 'Rule not found' });
    }

    if (body.mode && !['raw', 'hourly', 'both', 'none'].includes(body.mode)) {
      return reply.code(400).send({ error: 'Invalid mode' });
    }
    if (body.aggregate && !['sum', 'avg', 'min', 'max', 'last'].includes(body.aggregate)) {
      return reply.code(400).send({ error: 'Invalid aggregate' });
    }
    if (body.retentionDays !== undefined && (body.retentionDays as number) < 1) {
      return reply.code(400).send({ error: 'Invalid retentionDays' });
    }

    const plantId = await validatePlantId(tenant.id, body.plantId ?? existing.plantId);
    const gatewayId = await validateGatewayId(tenant.id, body.gatewayId ?? existing.gatewayId);
    const plcId = await validatePlcId(tenant.id, body.plcId ?? existing.plcId);
    if (body.plantId && !plantId) {
      return reply.code(404).send({ error: 'Plant not found' });
    }
    if (body.gatewayId && !gatewayId) {
      return reply.code(404).send({ error: 'Gateway not found' });
    }
    if (body.plcId && !plcId) {
      return reply.code(404).send({ error: 'PLC not found' });
    }

    const rule = await prisma.persistRule.update({
      where: { id },
      data: {
        plantId,
        gatewayId,
        plcId,
        metricId: body.metricId?.trim() || existing.metricId,
        mode: (body.mode as any) || existing.mode,
        aggregate: body.aggregate ? (body.aggregate as any) : null,
        retentionDays: typeof body.retentionDays === 'number' ? body.retentionDays : existing.retentionDays,
      },
    });

    return reply.send(rule);
  });

  fastify.delete<{ Params: { id: string } }>('/persist-rules/:id', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenant = await resolveTenant(request, reply);
    if (!tenant) return;
    const { id } = request.params;

    const existing = await prisma.persistRule.findFirst({
      where: { id, tenantId: tenant.id },
    });
    if (!existing) {
      return reply.code(404).send({ error: 'Rule not found' });
    }

    await prisma.persistRule.delete({ where: { id } });
    return reply.send({ success: true });
  });
};

export default persistRulesRoutes;
