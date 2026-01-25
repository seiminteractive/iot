import { prisma } from '../../db/prisma.js';
import { config } from '../../config/env.js';

type MetricStats = {
  avg: number | null;
  min: number | null;
  max: number | null;
  last: number | null;
  lastTs: string | null;
  count: number;
  sum: number;
};

type MetricMeta = {
  metricId: string;
  label: string;
  unit: string | null;
  aiPriority: number;
  enabledForAI: boolean;
  keyForCEO: boolean;
  keyForPlant: boolean;
};

function iso(d: Date): string {
  return d.toISOString();
}

function isNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function mergeAggregated(records: Array<{ count: number; sum: number | null; min: number | null; max: number | null; lastValueJson: any; lastTs: Date | null }>): MetricStats {
  let count = 0;
  let sum = 0;
  let min: number | null = null;
  let max: number | null = null;
  let last: number | null = null;
  let lastTs: Date | null = null;

  for (const r of records) {
    count += r.count ?? 0;
    if (isNumber(r.sum)) sum += r.sum;
    if (isNumber(r.min)) min = min === null ? r.min : Math.min(min, r.min);
    if (isNumber(r.max)) max = max === null ? r.max : Math.max(max, r.max);
    if (r.lastTs && (!lastTs || r.lastTs > lastTs)) {
      lastTs = r.lastTs;
      last = isNumber(r.lastValueJson) ? r.lastValueJson : null;
    }
  }

  return {
    avg: count > 0 ? sum / count : null,
    min,
    max,
    last,
    lastTs: lastTs ? iso(lastTs) : null,
    count,
    sum,
  };
}

async function fetchMetricCatalogForContext(params: {
  tenantId: string;
  plantId: string;
  plcIds: string[];
}): Promise<{
  byPlc: Map<string, Map<string, MetricMeta>>;
  byPlant: Map<string, MetricMeta>;
  byTenant: Map<string, MetricMeta>;
  maxCatalogVersion: number;
}> {
  const { tenantId, plantId, plcIds } = params;

  const rows = await prisma.metricCatalog.findMany({
    where: {
      tenantId,
      OR: [
        { plantId: null, plcId: null },
        { plantId, plcId: null },
        { plantId, plcId: { in: plcIds } },
      ],
    },
    orderBy: { catalogVersion: 'desc' },
  });

  const byPlc = new Map<string, Map<string, MetricMeta>>();
  const byPlant = new Map<string, MetricMeta>();
  const byTenant = new Map<string, MetricMeta>();
  let maxCatalogVersion = 1;

  for (const r of rows) {
    maxCatalogVersion = Math.max(maxCatalogVersion, r.catalogVersion);
    const meta: MetricMeta = {
      metricId: r.metricId,
      label: r.label,
      unit: r.unit ?? null,
      aiPriority: r.aiPriority,
      enabledForAI: r.enabledForAI,
      keyForCEO: r.keyForCEO,
      keyForPlant: r.keyForPlant,
    };
    if (r.plcId) {
      const map = byPlc.get(r.plcId) ?? new Map<string, MetricMeta>();
      if (!byPlc.has(r.plcId)) byPlc.set(r.plcId, map);
      // only set first (highest version due to orderBy desc)
      if (!map.has(r.metricId)) map.set(r.metricId, meta);
      continue;
    }
    if (r.plantId) {
      if (!byPlant.has(r.metricId)) byPlant.set(r.metricId, meta);
      continue;
    }
    if (!byTenant.has(r.metricId)) byTenant.set(r.metricId, meta);
  }

  return { byPlc, byPlant, byTenant, maxCatalogVersion };
}

function resolveMetricMeta(
  plcId: string,
  metricId: string,
  catalogs: { byPlc: Map<string, Map<string, MetricMeta>>; byPlant: Map<string, MetricMeta>; byTenant: Map<string, MetricMeta> }
): MetricMeta | null {
  const plcMap = catalogs.byPlc.get(plcId);
  if (plcMap?.has(metricId)) return plcMap.get(metricId)!;
  if (catalogs.byPlant.has(metricId)) return catalogs.byPlant.get(metricId)!;
  if (catalogs.byTenant.has(metricId)) return catalogs.byTenant.get(metricId)!;
  return null;
}

export async function buildPlantSnapshot(params: {
  tenantId: string;
  plantId: string;
  periodStart: Date;
  periodEnd: Date;
  topN: number;
}): Promise<{ snapshot: any; catalogVersion: number; dataGaps: string[] }> {
  const { tenantId, plantId, periodStart, periodEnd, topN } = params;

  const plant = await prisma.plant.findUnique({
    where: { id: plantId },
    select: { id: true, name: true, province: true, plantId: true },
  });
  if (!plant) throw new Error('Plant not found');

  const plcs = await prisma.plc.findMany({
    where: { tenantId, plantId },
    select: { id: true, name: true, plcThingName: true },
    orderBy: { createdAt: 'asc' },
  });
  const plcIds = plcs.map((p) => p.id);

  const catalogs = await fetchMetricCatalogForContext({ tenantId, plantId, plcIds });

  // Fetch persist rules for this plant (tenant-level + plant-level + plc-level)
  const rules = await prisma.persistRule.findMany({
    where: {
      tenantId,
      OR: [
        { plantId: null, plcId: null },
        { plantId, plcId: null },
        { plantId, plcId: { in: plcIds } },
        { plantId: null, plcId: { in: plcIds } },
      ],
    },
    select: { plantId: true, plcId: true, metricId: true, intervalMinutes: true },
  });

  // Build metric candidates per PLC
  const metricCandidatesByPlc = new Map<string, Set<string>>();
  const intervalByPlcMetric = new Map<string, number>();

  for (const plc of plcIds) metricCandidatesByPlc.set(plc, new Set<string>());

  for (const r of rules) {
    const interval = r.intervalMinutes ?? 60;
    if (r.plcId) {
      const set = metricCandidatesByPlc.get(r.plcId);
      if (set) {
        set.add(r.metricId);
        intervalByPlcMetric.set(`${r.plcId}:${r.metricId}`, interval);
      }
      continue;
    }
    // plcId null: applies to all PLCs in scope
    for (const plcId of plcIds) {
      metricCandidatesByPlc.get(plcId)!.add(r.metricId);
      intervalByPlcMetric.set(`${plcId}:${r.metricId}`, interval);
    }
  }

  // Choose topN enabled metrics per PLC based on resolved MetricCatalog priority
  const chosenByPlc = new Map<string, MetricMeta[]>();
  const dataGaps: string[] = [];
  const metricIdUnion = new Set<string>();

  for (const plc of plcs) {
    const candidates = Array.from(metricCandidatesByPlc.get(plc.id) ?? []);
    const metas: MetricMeta[] = [];
    for (const metricId of candidates) {
      const meta = resolveMetricMeta(plc.id, metricId, catalogs);
      if (!meta) {
        dataGaps.push(`Métrica sin catalogo: ${metricId} (PLC ${plc.name || plc.plcThingName})`);
        continue;
      }
      if (!meta.enabledForAI) continue;
      metas.push(meta);
    }
    metas.sort((a, b) => b.aiPriority - a.aiPriority || a.label.localeCompare(b.label));
    const selected = metas.slice(0, Math.max(1, topN));
    chosenByPlc.set(plc.id, selected);
    for (const m of selected) metricIdUnion.add(m.metricId);
  }

  // Load aggregated telemetry for current and previous window for trend
  const prevStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()));
  const prevEnd = new Date(periodStart.getTime());

  const aggNow = await prisma.telemetryAggregated.findMany({
    where: {
      tenantId,
      plantId,
      plcId: { in: plcIds },
      metricId: { in: Array.from(metricIdUnion) },
      bucket: { gte: periodStart, lte: periodEnd },
    },
    select: { plcId: true, metricId: true, count: true, sum: true, min: true, max: true, lastValueJson: true, lastTs: true },
  });

  const aggPrev = await prisma.telemetryAggregated.findMany({
    where: {
      tenantId,
      plantId,
      plcId: { in: plcIds },
      metricId: { in: Array.from(metricIdUnion) },
      bucket: { gte: prevStart, lte: prevEnd },
    },
    select: { plcId: true, metricId: true, count: true, sum: true, min: true, max: true, lastValueJson: true, lastTs: true },
  });

  const grouped = new Map<string, any[]>();
  const groupedPrev = new Map<string, any[]>();
  for (const r of aggNow) {
    const key = `${r.plcId}:${r.metricId}`;
    const arr = grouped.get(key) ?? [];
    if (!grouped.has(key)) grouped.set(key, arr);
    arr.push(r);
  }
  for (const r of aggPrev) {
    const key = `${r.plcId}:${r.metricId}`;
    const arr = groupedPrev.get(key) ?? [];
    if (!groupedPrev.has(key)) groupedPrev.set(key, arr);
    arr.push(r);
  }

  const alarms = await prisma.alarm.findMany({
    where: {
      tenantId,
      plantId,
      plcId: { in: plcIds },
      ts: { gte: periodStart, lte: periodEnd },
    },
    select: { plcId: true, ts: true, severity: true, message: true },
    orderBy: { ts: 'desc' },
  });
  const alarmsByPlc = new Map<string, Array<{ ts: string; severity: string; message: string }>>();
  for (const a of alarms) {
    const arr = alarmsByPlc.get(a.plcId) ?? [];
    if (!alarmsByPlc.has(a.plcId)) alarmsByPlc.set(a.plcId, arr);
    arr.push({ ts: iso(a.ts), severity: a.severity, message: a.message });
  }

  const plcSnapshots = plcs.map((plc) => {
    const metrics = (chosenByPlc.get(plc.id) ?? []).map((m) => {
      const key = `${plc.id}:${m.metricId}`;
      const nowStats = mergeAggregated(grouped.get(key) ?? []);
      const prevStats = mergeAggregated(groupedPrev.get(key) ?? []);
      const trend =
        nowStats.avg !== null && prevStats.avg !== null && prevStats.avg !== 0
          ? `${(((nowStats.avg - prevStats.avg) / prevStats.avg) * 100).toFixed(1)}%`
          : '';
      return {
        id: m.metricId,
        label: m.label,
        unit: m.unit,
        aiPriority: m.aiPriority,
        stats: {
          avg: nowStats.avg,
          min: nowStats.min,
          max: nowStats.max,
          last: nowStats.last,
          lastTs: nowStats.lastTs,
          count: nowStats.count,
        },
        trend,
      };
    });
    return {
      id: plc.id,
      name: plc.name || plc.plcThingName,
      metrics,
      alarms: alarmsByPlc.get(plc.id) ?? [],
    };
  });

  const snapshot = {
    plant: {
      id: plant.id,
      name: plant.name || plant.plantId,
      province: plant.province,
    },
    period: { start: iso(periodStart), end: iso(periodEnd) },
    plcs: plcSnapshots,
    dataGaps,
    meta: { redisPrefix: config.REDIS_PREFIX },
  };

  return { snapshot, catalogVersion: catalogs.maxCatalogVersion, dataGaps };
}

export async function buildCompanySnapshot(params: {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<{ snapshot: any; catalogVersion: number; dataGaps: string[] }> {
  const { tenantId, periodStart, periodEnd } = params;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) throw new Error('Tenant not found');

  const plants = await prisma.plant.findMany({
    where: { tenantId },
    select: { id: true, name: true, plantId: true, province: true },
    orderBy: { createdAt: 'asc' },
  });
  const plantIds = plants.map((p) => p.id);

  // Company uses tenant-level MetricCatalog flags keyForCEO
  const metricRows = await prisma.metricCatalog.findMany({
    where: { tenantId, plantId: null, plcId: null, keyForCEO: true, enabledForAI: true },
    orderBy: [{ aiPriority: 'desc' }, { label: 'asc' }],
  });
  const keyMetrics = metricRows.map((m) => ({ metricId: m.metricId, label: m.label, unit: m.unit ?? null, aiPriority: m.aiPriority }));
  const metricIds = keyMetrics.map((m) => m.metricId);
  const maxCatalogVersion = metricRows.reduce((acc, r) => Math.max(acc, r.catalogVersion), 1);

  const alarms = await prisma.alarm.findMany({
    where: { tenantId, plantId: { in: plantIds }, ts: { gte: periodStart, lte: periodEnd } },
    select: { plantId: true, severity: true },
  });
  const alarmsByPlant = new Map<string, { critical: number; warning: number; info: number; total: number }>();
  for (const p of plantIds) alarmsByPlant.set(p, { critical: 0, warning: 0, info: 0, total: 0 });
  for (const a of alarms) {
    const c = alarmsByPlant.get(a.plantId)!;
    c.total += 1;
    if (a.severity === 'critical') c.critical += 1;
    else if (a.severity === 'warning') c.warning += 1;
    else c.info += 1;
  }

  // Compute plant-level values for key metrics by aggregating across all PLCs in plant
  const agg = metricIds.length
    ? await prisma.telemetryAggregated.findMany({
        where: { tenantId, plantId: { in: plantIds }, metricId: { in: metricIds }, bucket: { gte: periodStart, lte: periodEnd } },
        select: { plantId: true, metricId: true, count: true, sum: true, min: true, max: true, lastValueJson: true, lastTs: true },
      })
    : [];
  const grouped = new Map<string, any[]>();
  for (const r of agg) {
    const key = `${r.plantId}:${r.metricId}`;
    const arr = grouped.get(key) ?? [];
    if (!grouped.has(key)) grouped.set(key, arr);
    arr.push(r);
  }

  const plantRows = plants.map((p) => {
    const alarms = alarmsByPlant.get(p.id)!;
    const highlights = keyMetrics.map((m) => {
      const stats = mergeAggregated(grouped.get(`${p.id}:${m.metricId}`) ?? []);
      return {
        label: m.label,
        value: stats.last !== null ? `${stats.last}${m.unit ? ` ${m.unit}` : ''}` : '—',
        avg: stats.avg,
      };
    });
    return {
      plantId: p.id,
      plantName: p.name || p.plantId,
      province: p.province,
      alarms,
      highlights,
    };
  });

  // Deterministic ranking: fewer critical alarms first, then fewer warnings, then name
  const ranked = [...plantRows].sort((a, b) => {
    const ac = a.alarms.critical - b.alarms.critical;
    if (ac !== 0) return ac;
    const aw = a.alarms.warning - b.alarms.warning;
    if (aw !== 0) return aw;
    return a.plantName.localeCompare(b.plantName);
  });

  const snapshot = {
    tenant: { id: tenant.id, name: tenant.name },
    period: { start: iso(periodStart), end: iso(periodEnd) },
    plants: ranked.map((p, idx) => ({ ...p, position: idx + 1 })),
    meta: { keyMetricsCount: keyMetrics.length },
  };

  const dataGaps: string[] = [];
  if (keyMetrics.length === 0) dataGaps.push('No hay métricas marcadas como keyForCEO en MetricCatalog (tenant-level)');

  return { snapshot, catalogVersion: maxCatalogVersion, dataGaps };
}

