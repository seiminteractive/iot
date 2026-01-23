import { PersistAggregate, PersistMode } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { config } from '../config/env.js';

export interface PersistDecision {
  mode: PersistMode;
  aggregate?: PersistAggregate;
  retentionDays: number;
  storeRaw: boolean;
  storeHourly: boolean;
}

export async function resolvePersistRule(
  tenantId: string,
  plantId: string,
  gatewayId: string,
  plcId: string,
  metricId: string
): Promise<{ mode: PersistMode; aggregate?: PersistAggregate; retentionDays: number } | null> {
  const rules = await prisma.persistRule.findMany({
    where: {
      tenantId,
      metricId,
      AND: [
        { OR: [{ plantId: null }, { plantId }] },
        { OR: [{ gatewayId: null }, { gatewayId }] },
        { OR: [{ plcId: null }, { plcId }] },
      ],
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  if (rules.length === 0) return null;

  const scored = rules.map((rule) => {
    const level = rule.plcId ? 2 : rule.plantId ? 1 : 0;
    const gatewaySpecific = rule.gatewayId ? 1 : 0;
    return { rule, level, gatewaySpecific };
  });

  scored.sort((a, b) => {
    if (b.level !== a.level) return b.level - a.level;
    return b.gatewaySpecific - a.gatewaySpecific;
  });
  const selected = scored[0]?.rule;
  if (!selected) return null;

  return {
    mode: selected.mode,
    aggregate: selected.aggregate ?? undefined,
    retentionDays: selected.retentionDays,
  };
}

export function getPersistDecision(
  rule: { mode: PersistMode; aggregate?: PersistAggregate; retentionDays: number } | null
): PersistDecision {
  const mode = rule?.mode ?? (config.PERSIST_DEFAULT_MODE as PersistMode);
  const aggregate = rule?.aggregate ?? (mode === 'hourly' || mode === 'both' ? 'last' : undefined);
  const retentionDays = rule?.retentionDays ?? 7;
  const storeRaw = mode === 'raw' || mode === 'both';
  const storeHourly = mode === 'hourly' || mode === 'both';

  return { mode, aggregate: aggregate as PersistAggregate | undefined, retentionDays, storeRaw, storeHourly };
}
