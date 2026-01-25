import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { allowedPlants, requireRole } from '../utils/authz.js';
import { getTenantContext } from '../utils/tenant.js';

const aiRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/ai/insights/:plantId
   * Returns the latest plant insight for a plant UUID (if user has access).
   */
  fastify.get<{ Params: { plantId: string } }>('/ai/insights/:plantId', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const tenant = await getTenantContext(request);
    if (!tenant) return reply.code(403).send({ error: 'Invalid tenant' });
    const tenantAI = (tenant.aiConfig as any) || {};
    if (tenantAI.enabled !== true) {
      return reply.send({ status: 'disabled', message: 'IA no está habilitada para este tenant.' });
    }

    const { plantId } = request.params;
    const plants = allowedPlants(request);
    if (!plants.includes('*') && !plants.includes(plantId)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const plant = await prisma.plant.findUnique({
      where: { id: plantId },
      select: { id: true, tenantId: true, aiConfig: true },
    });
    if (!plant || plant.tenantId !== tenant.id) {
      return reply.code(404).send({ error: 'Plant not found' });
    }
    const plantAI = (plant.aiConfig as any) || {};
    if (plantAI.enabled !== true) {
      return reply.send({ status: 'disabled', message: 'IA no está activa para esta planta.' });
    }

    const latest = await prisma.aIInsight.findFirst({
      where: { tenantId: tenant.id, plantId, type: 'plant', status: 'success', stale: false },
      orderBy: { generatedAt: 'desc' },
    });

    if (!latest) {
      return reply.send({ status: 'pending', message: 'No hay insight generado todavía.' });
    }
    return reply.send(latest);
  });

  /**
   * GET /api/ai/insights/company
   * Returns the latest company overview insight if user's email is allowed for this tenant.
   */
  fastify.get('/ai/insights/company', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const tenant = await getTenantContext(request);
    if (!tenant) return reply.code(403).send({ error: 'Invalid tenant' });
    const tenantAIFromCtx = (tenant.aiConfig as any) || {};
    if (tenantAIFromCtx.enabled !== true) {
      return reply.send({ status: 'disabled', message: 'IA no está habilitada para este tenant.' });
    }

    const email = request.user?.email?.toLowerCase();
    if (!email) return reply.code(403).send({ error: 'Missing email' });

    const allowed = await prisma.tenantCompanyOverviewAccess.findUnique({
      where: { tenantId_emailLower: { tenantId: tenant.id, emailLower: email } },
      select: { id: true },
    });
    if (!allowed) {
      return reply.code(403).send({ error: 'Company overview not allowed' });
    }

    const tenantRow = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { aiConfig: true },
    });
    const tenantAI = (tenantRow?.aiConfig as any) || {};
    if (tenantAI.companyEnabled !== true) {
      return reply.send({ status: 'disabled', message: 'El resumen de compañía no está habilitado para este tenant.' });
    }

    const latest = await prisma.aIInsight.findFirst({
      where: { tenantId: tenant.id, plantId: null, type: 'company', status: 'success', stale: false },
      orderBy: { generatedAt: 'desc' },
    });

    if (!latest) {
      return reply.send({ status: 'pending', message: 'No hay resumen de compañía generado todavía.' });
    }
    return reply.send(latest);
  });
};

export default aiRoutes;

