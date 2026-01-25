import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { requireInternal } from '../utils/authz.js';
import { enqueueJob } from '../../services/ai/queue.js';
import { intervalToMs, type RefreshInterval } from '../../services/ai/intervals.js';

function requireSupreme(request: any, reply: any): boolean {
  if (!requireInternal(request)) {
    void reply.code(403).send({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function parseInterval(value: any, fallback: RefreshInterval): RefreshInterval {
  const allowed: RefreshInterval[] = ['every6h', 'every12h', 'every24h', 'every2d', 'weekly', 'biweekly', 'custom'];
  return allowed.includes(value) ? value : fallback;
}

const aiAdminRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GLOBAL CONFIG
   */
  fastify.get('/admin/ai/global-config', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const keys = [
      'ai_enabled',
      'ai_system_prompt',
      'ai_system_prompt_v',
    ];
    const rows = await prisma.globalConfig.findMany({
      where: { key: { in: keys } },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    return reply.send(map);
  });

  fastify.put('/admin/ai/global-config', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const body = request.body as Partial<Record<string, string>>;
    const allowedKeys = new Set(['ai_enabled', 'ai_system_prompt', 'ai_system_prompt_v']);
    const updates = Object.entries(body || {}).filter(([k, v]) => allowedKeys.has(k) && typeof v === 'string');
    if (updates.length === 0) {
      return reply.code(400).send({ error: 'No valid keys to update' });
    }
    // Upsert each key
    const updatedBy = request.user?.email;
    await prisma.$transaction(
      updates.map(([key, value]) =>
        prisma.globalConfig.upsert({
          where: { key },
          create: { key, value, updatedBy: updatedBy as any } as any,
          update: { value, updatedBy: updatedBy as any } as any,
        })
      )
    );
    return reply.send({ success: true });
  });

  /**
   * TENANT / PLANT AI CONFIG (store JSONB)
   */
  fastify.get('/admin/ai/tenants/:tenantId/config', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { tenantId } = request.params as { tenantId: string };
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, aiConfig: true } });
    if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });
    return reply.send({ tenantId: tenant.id, aiConfig: tenant.aiConfig ?? null });
  });

  fastify.put('/admin/ai/tenants/:tenantId/config', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { tenantId } = request.params as { tenantId: string };
    const body = request.body as { aiConfig?: any };
    const tenant = await prisma.tenant.update({ where: { id: tenantId }, data: { aiConfig: body?.aiConfig ?? null } });
    return reply.send({ success: true, tenant });
  });

  fastify.get('/admin/ai/plants/:plantId/config', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { plantId } = request.params as { plantId: string };
    const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true, tenantId: true, aiConfig: true } });
    if (!plant) return reply.code(404).send({ error: 'Plant not found' });
    return reply.send({ plantId: plant.id, tenantId: plant.tenantId, aiConfig: plant.aiConfig ?? null });
  });

  fastify.put('/admin/ai/plants/:plantId/config', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { plantId } = request.params as { plantId: string };
    const body = request.body as { aiConfig?: any };
    const plant = await prisma.plant.update({ where: { id: plantId }, data: { aiConfig: body?.aiConfig ?? null } });
    return reply.send({ success: true, plant });
  });

  /**
   * COMPANY OVERVIEW ACCESS (by email allowlist)
   */
  fastify.get('/admin/ai/tenants/:tenantId/company-overview-access', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { tenantId } = request.params as { tenantId: string };
    const rows = await prisma.tenantCompanyOverviewAccess.findMany({
      where: { tenantId },
      orderBy: { emailLower: 'asc' },
    });
    return reply.send(rows);
  });

  fastify.post('/admin/ai/tenants/:tenantId/company-overview-access', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { tenantId } = request.params as { tenantId: string };
    const body = request.body as { email?: string };
    const email = body?.email?.trim().toLowerCase();
    if (!email) {
      return reply.code(400).send({ error: 'Missing email' });
    }
    const createdBy = request.user?.email || null;
    const row = await prisma.tenantCompanyOverviewAccess.upsert({
      where: { tenantId_emailLower: { tenantId, emailLower: email } },
      create: {
        tenantId,
        emailLower: email,
        createdBy: createdBy || undefined,
        updatedBy: createdBy || undefined,
      },
      update: {
        updatedBy: createdBy || undefined,
      },
    });
    return reply.send(row);
  });

  fastify.delete('/admin/ai/tenants/:tenantId/company-overview-access/:emailLower', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { tenantId, emailLower } = request.params as { tenantId: string; emailLower: string };
    await prisma.tenantCompanyOverviewAccess.delete({
      where: { tenantId_emailLower: { tenantId, emailLower: emailLower.trim().toLowerCase() } },
    });
    return reply.send({ success: true });
  });

  /**
   * METRIC CATALOG (CRUD)
   */
  fastify.get('/admin/ai/tenants/:tenantId/metric-catalog', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { tenantId } = request.params as { tenantId: string };
    const query = request.query as { plantId?: string; plcId?: string };
    const rows = await prisma.metricCatalog.findMany({
      where: {
        tenantId,
        plantId: query?.plantId ?? undefined,
        plcId: query?.plcId ?? undefined,
      },
      orderBy: [{ aiPriority: 'desc' }, { label: 'asc' }],
    });
    return reply.send(rows);
  });

  fastify.put('/admin/ai/metric-catalog/:id', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      label: string;
      unit: string | null;
      description: string | null;
      enabledForAI: boolean;
      aiPriority: number;
      keyForCEO: boolean;
      keyForPlant: boolean;
    }>;
    const updatedBy = request.user?.email || null;
    const row = await prisma.metricCatalog.update({
      where: { id },
      data: {
        ...(typeof body.label === 'string' ? { label: body.label.trim() } : {}),
        ...(body.unit !== undefined ? { unit: body.unit ? body.unit.trim() : null } : {}),
        ...(body.description !== undefined ? { description: body.description ? body.description.trim() : null } : {}),
        ...(typeof body.enabledForAI === 'boolean' ? { enabledForAI: body.enabledForAI } : {}),
        ...(typeof body.aiPriority === 'number' ? { aiPriority: Math.trunc(body.aiPriority) } : {}),
        ...(typeof body.keyForCEO === 'boolean' ? { keyForCEO: body.keyForCEO } : {}),
        ...(typeof body.keyForPlant === 'boolean' ? { keyForPlant: body.keyForPlant } : {}),
        updatedBy: updatedBy || undefined,
        catalogVersion: { increment: 1 },
      },
    });
    return reply.send(row);
  });

  /**
   * BOOTSTRAP METRIC CATALOG FROM PERSIST RULES + DASHBOARD WIDGETS
   * Creates scoped MetricCatalog entries from PersistRule scope (tenant/plant/plc).
   */
  fastify.post('/admin/ai/tenants/:tenantId/metric-catalog/bootstrap', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { tenantId } = request.params as { tenantId: string };
    const adminEmail = request.user?.email || null;

    const rules = await prisma.persistRule.findMany({
      where: { tenantId },
      select: { metricId: true, plantId: true, plcId: true },
      distinct: ['metricId', 'plantId', 'plcId'],
    });

    let imported = 0;
    let needsReview = 0;

    for (const r of rules) {
      const metricId = r.metricId;
      const plantId = r.plantId ?? null;
      const plcId = r.plcId ?? null;
      // Try find a label/unit from any widget that uses the metricId
      const widget = await prisma.plcDashboardWidget.findFirst({
        where: { metricId },
        select: { label: true, unit: true },
      });

      const label = widget?.label?.trim();
      const unit = widget?.unit?.trim();
      const hasLabel = !!label;

      const row = await prisma.metricCatalog.upsert({
        where: {
          tenantId_plantId_plcId_metricId: {
            tenantId,
            plantId: (plantId ?? undefined) as any,
            plcId: (plcId ?? undefined) as any,
            metricId,
          } as any,
        } as any,
        create: {
          tenantId,
          plantId,
          plcId,
          metricId,
          label: hasLabel ? label! : metricId,
          unit: unit || null,
          enabledForAI: hasLabel,
          aiPriority: hasLabel ? 0 : -1,
          keyForCEO: false,
          keyForPlant: false,
          updatedBy: adminEmail || undefined,
        },
        update: {
          // do not overwrite admin edits; only fill missing unit/label if placeholder
          ...(hasLabel ? { label: label! } : {}),
          ...(unit ? { unit } : {}),
          updatedBy: adminEmail || undefined,
        },
      });

      if (!hasLabel) needsReview += 1;
      imported += 1;
    }

    return reply.send({
      success: true,
      imported,
      needsReview,
    });
  });

  /**
   * REGENERATE (enqueue jobs)
   */
  fastify.post('/admin/ai/regenerate/plant/:plantId', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { plantId } = request.params as { plantId: string };
    const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true, tenantId: true, aiConfig: true } });
    if (!plant) return reply.code(404).send({ error: 'Plant not found' });

    const tenant = await prisma.tenant.findUnique({ where: { id: plant.tenantId }, select: { aiConfig: true } });
    const tenantAI = (tenant?.aiConfig as any) || {};
    if (tenantAI.enabled !== true) {
      return reply.code(400).send({ error: 'AI disabled for tenant' });
    }

    const ai = (plant.aiConfig as any) || {};
    if (ai.enabled !== true) {
      return reply.code(400).send({ error: 'AI disabled for plant' });
    }
    const interval = parseInterval(ai.refreshInterval, 'every12h');
    const ms = intervalToMs(interval, ai.refreshCustomHours);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - ms);

    await enqueueJob({
      type: 'plant',
      tenantId: plant.tenantId,
      plantId: plant.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      requestedBy: request.user?.email ?? null,
      reason: 'manual',
    });
    return reply.send({ success: true });
  });

  fastify.post('/admin/ai/regenerate/company/:tenantId', async (request, reply) => {
    if (!requireSupreme(request, reply)) return;
    const { tenantId } = request.params as { tenantId: string };
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, aiConfig: true } });
    if (!tenant) return reply.code(404).send({ error: 'Tenant not found' });

    const ai = (tenant.aiConfig as any) || {};
    if (ai.enabled !== true) {
      return reply.code(400).send({ error: 'AI disabled for tenant' });
    }
    if (ai.companyEnabled !== true && ai.ceoEnabled !== true) {
      return reply.code(400).send({ error: 'Company overview disabled for tenant' });
    }
    const interval = parseInterval(ai.companyRefreshInterval ?? ai.ceoRefreshInterval, 'weekly');
    const ms = intervalToMs(interval, ai.companyRefreshCustomHours);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - ms);

    await enqueueJob({
      type: 'company',
      tenantId: tenant.id,
      plantId: null,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      requestedBy: request.user?.email ?? null,
      reason: 'manual',
    });
    return reply.send({ success: true });
  });
};

export default aiAdminRoutes;

