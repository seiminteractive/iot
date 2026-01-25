import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../db/prisma.js';
import { enqueueJob } from './queue.js';
import { intervalToMs, type RefreshInterval } from './intervals.js';
// (reuse prisma import above)

function parseInterval(value: any, fallback: RefreshInterval): RefreshInterval {
  const allowed: RefreshInterval[] = ['every6h', 'every12h', 'every24h', 'every2d', 'weekly', 'biweekly', 'custom'];
  return allowed.includes(value) ? value : fallback;
}

function now(): Date {
  return new Date();
}

export async function runSchedulerTick(): Promise<void> {
  // Global kill-switch (DB)
  const globalEnabledRow = await prisma.globalConfig.findUnique({ where: { key: 'ai_enabled' }, select: { value: true } });
  if ((globalEnabledRow?.value || 'false') !== 'true') {
    return;
  }

  // Company overview: if tenant has allowlist entries OR explicit enable, schedule company insight.
  const tenants = await prisma.tenant.findMany({
    select: { id: true, aiConfig: true },
  });

  const tNow = now();
  const tenantEnabled = new Map<string, boolean>();

  for (const tenant of tenants) {
    const ai = (tenant.aiConfig as any) || {};
    const enabled = ai.enabled === true;
    tenantEnabled.set(tenant.id, enabled);
    if (!enabled) continue;
    const companyEnabled = ai.companyEnabled === true || ai.ceoEnabled === true;
    const accessCount = await prisma.tenantCompanyOverviewAccess.count({ where: { tenantId: tenant.id } });
    const shouldCompany = companyEnabled && accessCount > 0;
    if (shouldCompany) {
      const interval = parseInterval(ai.companyRefreshInterval ?? ai.ceoRefreshInterval, 'weekly');
      const ms = intervalToMs(interval, ai.companyRefreshCustomHours);
      const periodEnd = tNow;
      const periodStart = new Date(tNow.getTime() - ms);
      const last = await prisma.aIInsight.findFirst({
        where: { tenantId: tenant.id, plantId: null, type: 'company', status: 'success', stale: false },
        orderBy: { generatedAt: 'desc' },
        select: { generatedAt: true },
      });
      const due = !last?.generatedAt || tNow.getTime() - last.generatedAt.getTime() >= ms;
      if (due) {
        await enqueueJob({
          type: 'company',
          tenantId: tenant.id,
          plantId: null,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          reason: 'scheduled',
        });
      }
    }
  }

  // Plant insights
  const plants = await prisma.plant.findMany({
    select: { id: true, tenantId: true, aiConfig: true },
  });

  for (const plant of plants) {
    if (!tenantEnabled.get(plant.tenantId)) continue;
    const ai = (plant.aiConfig as any) || {};
    if (ai.enabled !== true) continue;
    const interval = parseInterval(ai.refreshInterval, 'every12h');
    const ms = intervalToMs(interval, ai.refreshCustomHours);
    const periodEnd = tNow;
    const periodStart = new Date(tNow.getTime() - ms);
    const last = await prisma.aIInsight.findFirst({
      where: { tenantId: plant.tenantId, plantId: plant.id, type: 'plant', status: 'success', stale: false },
      orderBy: { generatedAt: 'desc' },
      select: { generatedAt: true },
    });
    const due = !last?.generatedAt || tNow.getTime() - last.generatedAt.getTime() >= ms;
    if (!due) continue;
    await enqueueJob({
      type: 'plant',
      tenantId: plant.tenantId,
      plantId: plant.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      reason: 'scheduled',
    });
  }
}

export function startAIScheduler(): void {
  if (!config.AI_SCHEDULER_ENABLED) {
    logger.info('AI scheduler disabled');
    return;
  }
  logger.info('AI scheduler starting');
  const tick = async () => {
    try {
      await runSchedulerTick();
    } catch (error) {
      logger.error({ error }, 'AI scheduler tick failed');
    }
  };
  void tick();
  setInterval(() => void tick(), 60_000);
}

