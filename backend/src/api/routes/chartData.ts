import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { requireRole, allowedPlants } from '../utils/authz.js';
import { getTenantContext } from '../utils/tenant.js';

interface ChartDataQuery {
  plcId?: string;
  metricId: string;
  source?: 'raw' | 'aggregated';
  from?: string;
  to?: string;
  groupBy?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  aggregate?: 'avg' | 'sum' | 'min' | 'max' | 'last' | 'count';
  limit?: string;
}

interface ChartDataPoint {
  timestamp: string;
  label: string;
  value: number | null;
}

interface ChartDataResponse {
  categories: string[];
  values: (number | null)[];
  data: ChartDataPoint[];
  meta: {
    from: string;
    to: string;
    groupBy: string;
    aggregate: string;
    count: number;
  };
}

/**
 * Agrupa datos por el intervalo especificado
 */
function getGroupByFormat(groupBy: string): string {
  switch (groupBy) {
    case 'minute': return 'YYYY-MM-DD HH24:MI';
    case 'hour': return 'YYYY-MM-DD HH24:00';
    case 'day': return 'YYYY-MM-DD';
    case 'week': return 'IYYY-IW'; // ISO week
    case 'month': return 'YYYY-MM';
    default: return 'YYYY-MM-DD HH24:00';
  }
}

/**
 * Formatea label para mostrar en el gráfico
 */
function formatLabel(timestamp: Date, groupBy: string): string {
  const d = new Date(timestamp);
  switch (groupBy) {
    case 'minute':
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    case 'hour':
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    case 'day':
      return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
    case 'week':
      return `Sem ${getWeekNumber(d)}`;
    case 'month':
      return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
    default:
      return d.toISOString();
  }
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const chartDataRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/telemetry/chart-data
   * 
   * Devuelve datos formateados para gráficos (barras, líneas, etc.)
   * 
   * Query params:
   * - plcId: UUID del PLC (opcional, si no se pasa usa todos los PLCs permitidos)
   * - metricId: ID de la métrica (requerido)
   * - source: 'raw' | 'aggregated' (default: 'aggregated')
   * - from: ISO date string (default: últimas 24h)
   * - to: ISO date string (default: ahora)
   * - groupBy: 'minute' | 'hour' | 'day' | 'week' | 'month' (default: 'hour')
   * - aggregate: 'avg' | 'sum' | 'min' | 'max' | 'last' | 'count' (default: 'avg')
   * - limit: número máximo de puntos (default: 100)
   */
  fastify.get<{ Querystring: ChartDataQuery }>('/telemetry/chart-data', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const tenant = await getTenantContext(request);
    if (!tenant) {
      return reply.code(403).send({ error: 'Invalid tenant' });
    }

    const {
      plcId,
      metricId,
      source = 'aggregated',
      from,
      to,
      groupBy = 'hour',
      aggregate = 'avg',
      limit = '100',
    } = request.query;

    if (!metricId) {
      return reply.code(400).send({ error: 'metricId is required' });
    }

    // Validar que el PLC pertenece a plantas permitidas
    const plants = allowedPlants(request);
    
    // Calcular rango de tiempo
    const now = new Date();
    const toDate = to ? new Date(to) : now;
    const fromDate = from ? new Date(from) : new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default: 24h

    // Validar fechas
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return reply.code(400).send({ error: 'Invalid date format' });
    }

    const maxLimit = Math.min(parseInt(limit, 10) || 100, 1000);

    try {
      let data: ChartDataPoint[] = [];

      if (source === 'aggregated') {
        // Consultar TelemetryAggregated
        const where: any = {
          tenantId: tenant.id,
          metricId,
          bucket: {
            gte: fromDate,
            lte: toDate,
          },
        };

        // Filtrar por PLC si se especifica
        if (plcId) {
          where.plcId = plcId;
        }

        // Filtrar por plantas permitidas
        if (!plants.includes('*')) {
          where.plantId = { in: plants };
        }

        const records = await prisma.telemetryAggregated.findMany({
          where,
          orderBy: { bucket: 'asc' },
          take: maxLimit,
        });

        // Agrupar por el intervalo solicitado
        const grouped = new Map<string, { sum: number; count: number; min: number; max: number; last: number | null; bucket: Date }>();

        for (const record of records) {
          const key = formatGroupKey(record.bucket, groupBy);
          const existing = grouped.get(key);

          const recordValue = calculateAggregateValue(record, aggregate);
          
          if (!existing) {
            grouped.set(key, {
              sum: record.sum ?? 0,
              count: record.count,
              min: record.min ?? Infinity,
              max: record.max ?? -Infinity,
              last: typeof record.lastValueJson === 'number' ? record.lastValueJson : null,
              bucket: record.bucket,
            });
          } else {
            existing.sum += record.sum ?? 0;
            existing.count += record.count;
            existing.min = Math.min(existing.min, record.min ?? Infinity);
            existing.max = Math.max(existing.max, record.max ?? -Infinity);
            existing.last = typeof record.lastValueJson === 'number' ? record.lastValueJson : existing.last;
          }
        }

        // Convertir a formato de respuesta
        for (const [key, agg] of grouped) {
          let value: number | null = null;

          switch (aggregate) {
            case 'avg':
              value = agg.count > 0 ? agg.sum / agg.count : null;
              break;
            case 'sum':
              value = agg.sum;
              break;
            case 'min':
              value = agg.min === Infinity ? null : agg.min;
              break;
            case 'max':
              value = agg.max === -Infinity ? null : agg.max;
              break;
            case 'last':
              value = agg.last;
              break;
            case 'count':
              value = agg.count;
              break;
          }

          data.push({
            timestamp: agg.bucket.toISOString(),
            label: formatLabel(agg.bucket, groupBy),
            value: value !== null ? Math.round(value * 100) / 100 : null,
          });
        }

      } else {
        // source === 'raw': Consultar TelemetryEvent
        const where: any = {
          tenantId: tenant.id,
          metricId,
          ts: {
            gte: fromDate,
            lte: toDate,
          },
        };

        if (plcId) {
          where.plcId = plcId;
        }

        if (!plants.includes('*')) {
          where.plantId = { in: plants };
        }

        const records = await prisma.telemetryEvent.findMany({
          where,
          orderBy: { ts: 'asc' },
          take: maxLimit,
        });

        // Agrupar por el intervalo solicitado
        const grouped = new Map<string, { values: number[]; ts: Date }>();

        for (const record of records) {
          const key = formatGroupKey(record.ts, groupBy);
          const existing = grouped.get(key);

          // Extraer valor de valuesJson
          const valuesJson = record.valuesJson as Record<string, any>;
          const metricValue = valuesJson?.[metricId]?.value;
          const numericValue = typeof metricValue === 'number' ? metricValue : null;

          if (numericValue !== null) {
            if (!existing) {
              grouped.set(key, { values: [numericValue], ts: record.ts });
            } else {
              existing.values.push(numericValue);
            }
          }
        }

        // Convertir a formato de respuesta
        for (const [key, agg] of grouped) {
          let value: number | null = null;
          const values = agg.values;

          if (values.length > 0) {
            switch (aggregate) {
              case 'avg':
                value = values.reduce((a, b) => a + b, 0) / values.length;
                break;
              case 'sum':
                value = values.reduce((a, b) => a + b, 0);
                break;
              case 'min':
                value = Math.min(...values);
                break;
              case 'max':
                value = Math.max(...values);
                break;
              case 'last':
                value = values[values.length - 1];
                break;
              case 'count':
                value = values.length;
                break;
            }
          }

          data.push({
            timestamp: agg.ts.toISOString(),
            label: formatLabel(agg.ts, groupBy),
            value: value !== null ? Math.round(value * 100) / 100 : null,
          });
        }
      }

      // Ordenar por timestamp
      data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Construir respuesta
      const response: ChartDataResponse = {
        categories: data.map(d => d.label),
        values: data.map(d => d.value),
        data,
        meta: {
          from: fromDate.toISOString(),
          to: toDate.toISOString(),
          groupBy,
          aggregate,
          count: data.length,
        },
      };

      return reply.send(response);

    } catch (error) {
      fastify.log.error(error, 'Error fetching chart data');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};

/**
 * Genera una clave de agrupación basada en el timestamp y el intervalo
 */
function formatGroupKey(date: Date, groupBy: string): string {
  const d = new Date(date);
  
  switch (groupBy) {
    case 'minute':
      d.setSeconds(0, 0);
      break;
    case 'hour':
      d.setMinutes(0, 0, 0);
      break;
    case 'day':
      d.setHours(0, 0, 0, 0);
      break;
    case 'week':
      // Ir al lunes de la semana
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      break;
    case 'month':
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  
  return d.toISOString();
}

/**
 * Calcula el valor agregado de un registro según el tipo de agregación
 */
function calculateAggregateValue(record: any, aggregate: string): number | null {
  switch (aggregate) {
    case 'avg':
      return record.count > 0 && record.sum !== null ? record.sum / record.count : null;
    case 'sum':
      return record.sum;
    case 'min':
      return record.min;
    case 'max':
      return record.max;
    case 'last':
      return typeof record.lastValueJson === 'number' ? record.lastValueJson : null;
    case 'count':
      return record.count;
    default:
      return null;
  }
}

export default chartDataRoutes;
