import { PersistAggregate, PersistMode } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { config } from '../config/env.js';

export interface PersistDecision {
  mode: PersistMode;
  intervalMinutes?: number; // Solo para mode=interval
  aggregate?: PersistAggregate;
  retentionDays: number;
  storeRaw: boolean;
  storeAggregated: boolean;
}

export interface ResolvedRule {
  mode: PersistMode;
  intervalMinutes?: number;
  aggregate?: PersistAggregate;
  retentionDays: number;
}

export async function resolvePersistRule(
  tenantId: string,
  plantId: string,
  gatewayId: string,
  plcId: string,
  metricId: string
): Promise<ResolvedRule | null> {
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
    intervalMinutes: selected.intervalMinutes ?? undefined,
    aggregate: selected.aggregate ?? undefined,
    retentionDays: selected.retentionDays,
  };
}

export function getPersistDecision(rule: ResolvedRule | null): PersistDecision {
  // Default: raw si no hay regla
  const mode = rule?.mode ?? (config.PERSIST_DEFAULT_MODE as PersistMode) ?? 'raw';
  const intervalMinutes = rule?.intervalMinutes;
  const aggregate = rule?.aggregate ?? (mode === 'interval' ? 'last' : undefined);
  const retentionDays = rule?.retentionDays ?? 7;
  
  // storeRaw solo si mode es 'raw'
  const storeRaw = mode === 'raw';
  // storeAggregated solo si mode es 'interval'
  const storeAggregated = mode === 'interval';

  return { 
    mode, 
    intervalMinutes,
    aggregate: aggregate as PersistAggregate | undefined, 
    retentionDays, 
    storeRaw, 
    storeAggregated 
  };
}
