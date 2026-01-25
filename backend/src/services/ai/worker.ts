import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../db/prisma.js';
import { dequeueJob } from './queue.js';
import { withLock } from './locks.js';
import { callOpenAIJson } from './openai.js';
import { buildCompanySnapshot, buildPlantSnapshot } from './snapshot.js';
import { companyInsightSchema, plantInsightSchema } from './schemas.js';
import type { AIJob } from './types.js';

function jobKey(job: AIJob): string {
  const plantPart = job.plantId ? job.plantId : 'company';
  return `${job.type}:${job.tenantId}:${plantPart}:${job.periodStart}:${job.periodEnd}`;
}

async function getSystemPrompt(): Promise<{ prompt: string; ver: string }> {
  const rows = await prisma.globalConfig.findMany({
    where: { key: { in: ['ai_system_prompt', 'ai_system_prompt_v'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const prompt =
    map.get('ai_system_prompt') ||
    [
      'Eres un asistente experto en análisis industrial e IoT.',
      'Tu rol es generar reportes claros y accionables basados SOLO en datos provistos.',
      'REGLAS:',
      '- Responde SIEMPRE en español',
      '- No inventes métricas, no calcules KPIs que no existan en el input',
      '- Si faltan datos, indícalo en data_gaps y baja confidence',
      '- Devuelve ÚNICAMENTE JSON válido (sin markdown)',
    ].join('\n');
  const ver = map.get('ai_system_prompt_v') || '1';
  return { prompt, ver };
}

function getPlantTopN(tenantAiConfig: any, plantAiConfig: any): number {
  const override = plantAiConfig?.metricOverrides?.topN;
  if (typeof override === 'number') return Math.max(1, Math.trunc(override));
  const profileTopN = tenantAiConfig?.profiles?.plant?.topN;
  if (typeof profileTopN === 'number') return Math.max(1, Math.trunc(profileTopN));
  return 12;
}

async function processJob(job: AIJob): Promise<void> {
  const lockName = jobKey(job);
  const locked = await withLock(lockName, async () => {
    const periodStart = new Date(job.periodStart);
    const periodEnd = new Date(job.periodEnd);

    // Global kill-switch (DB)
    const globalEnabledRow = await prisma.globalConfig.findUnique({ where: { key: 'ai_enabled' }, select: { value: true } });
    if ((globalEnabledRow?.value || 'false') !== 'true') {
      logger.info({ job }, 'AI job skipped (global ai_enabled=false)');
      return;
    }

    // Resolve prompts/models from DB JSON configs
    const tenant = await prisma.tenant.findUnique({ where: { id: job.tenantId }, select: { id: true, aiConfig: true, name: true } });
    if (!tenant) throw new Error('Tenant not found');

    const tenantAi = (tenant.aiConfig as any) || {};
    if (tenantAi.enabled !== true) {
      logger.info({ job }, 'AI job skipped (tenant aiConfig.enabled=false)');
      return;
    }
    const model = (tenantAi.defaultModel as string) || config.OPENAI_DEFAULT_MODEL;

    const system = await getSystemPrompt();

    if (job.type === 'plant') {
      if (!job.plantId) throw new Error('plantId is required for plant job');
      const plant = await prisma.plant.findUnique({ where: { id: job.plantId }, select: { id: true, aiConfig: true } });
      if (!plant) throw new Error('Plant not found');
      const plantAi = (plant.aiConfig as any) || {};
      if (plantAi.enabled !== true) {
        logger.info({ job }, 'AI job skipped (plant aiConfig.enabled=false)');
        return;
      }
      const topN = getPlantTopN(tenantAi, plantAi);
      const prompt = (plantAi.prompt as string) || (tenantAi.plantPrompt as string) || '';

      const { snapshot, catalogVersion, dataGaps } = await buildPlantSnapshot({
        tenantId: tenant.id,
        plantId: plant.id,
        periodStart,
        periodEnd,
        topN,
      });

      const promptVersion = `system:v${system.ver}|tenant:${tenant.id}|plant:${plant.id}`;

      const insight = await prisma.aIInsight.create({
        data: {
          tenantId: tenant.id,
          plantId: plant.id,
          type: 'plant',
          status: 'running',
          inputSnapshotJson: snapshot,
          inputHash: hashString(JSON.stringify(snapshot)),
          promptVersion,
          systemPromptVer: `v${system.ver}`,
          catalogVersion,
          modelUsed: model,
          periodStart,
          periodEnd,
          expiresAt: new Date(periodEnd.getTime() + (periodEnd.getTime() - periodStart.getTime())),
        },
      });

      try {
        const userContent = [
          prompt || 'Genera un reporte operativo por PLC para la planta.',
          '',
          'INPUT (JSON, fuente de verdad):',
          JSON.stringify(snapshot),
          '',
          'SCHEMA (Plant): Debes devolver JSON con estas claves:',
          '{"summary": "...", "byPlc": [{"plcId":"...","plcName":"...","status":"ok|warning|critical","highlights":[{"label":"...","value":"...","trend":"..."}],"alerts":[{"severity":"critical|warning|info","description":"..."}],"actions":["..."]}], "risks":["..."], "actions":["..."], "data_gaps":["..."], "confidence": 0}',
          '',
          'REGLAS:',
          '- Devuelve SOLO JSON válido (sin markdown)',
          '- Usa labels legibles (no metricId) en highlights/alerts',
          dataGaps.length ? `- data_gaps iniciales: ${dataGaps.join(' | ')}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        const result = await callWithRetries(async () =>
          callOpenAIJson({
            model,
            maxOutputTokens: config.AI_MAX_OUTPUT_TOKENS,
            messages: [
              { role: 'system', content: system.prompt },
              { role: 'user', content: userContent },
            ],
          })
        );

        const parsed = safeJsonParse(result.content);
        const validated = plantInsightSchema.parse(parsed);
        const mergedGaps = Array.from(new Set([...(validated.data_gaps ?? []), ...dataGaps]));
        const contentJson = { ...validated, data_gaps: mergedGaps };

        await prisma.aIInsight.update({
          where: { id: insight.id },
          data: {
            status: 'success',
            contentJson,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            totalTokens: result.totalTokens,
            generatedAt: new Date(),
          },
        });
      } catch (error: any) {
        await prisma.aIInsight.update({
          where: { id: insight.id },
          data: {
            status: 'error',
            errorCode: 'generation_failed',
            errorMessage: String(error?.message || error),
            generatedAt: new Date(),
          },
        });
        throw error;
      }

      return;
    }

    // Company overview
    if (tenantAi.companyEnabled !== true && tenantAi.ceoEnabled !== true) {
      logger.info({ job }, 'AI job skipped (company not enabled for tenant)');
      return;
    }
    const prompt = (tenantAi.companyPrompt as string) || (tenantAi.ceoPrompt as string) || '';
    const { snapshot, catalogVersion, dataGaps } = await buildCompanySnapshot({
      tenantId: tenant.id,
      periodStart,
      periodEnd,
    });

    const promptVersion = `system:v${system.ver}|tenant:${tenant.id}|company`;

    const insight = await prisma.aIInsight.create({
      data: {
        tenantId: tenant.id,
        plantId: null,
        type: 'company',
        status: 'running',
        inputSnapshotJson: snapshot,
        inputHash: hashString(JSON.stringify(snapshot)),
        promptVersion,
        systemPromptVer: `v${system.ver}`,
        catalogVersion,
        modelUsed: model,
        periodStart,
        periodEnd,
        expiresAt: new Date(periodEnd.getTime() + (periodEnd.getTime() - periodStart.getTime())),
      },
    });

    try {
      const userContent = [
        prompt || 'Genera un resumen ejecutivo del tenant.',
        '',
        'INPUT (JSON, fuente de verdad):',
        JSON.stringify(snapshot),
        '',
        'SCHEMA (Company): Debes devolver JSON con estas claves:',
        '{"summary":"...","ranking":[{"plantId":"...","plantName":"...","position":1,"status":"ok|warning|critical","highlights":[{"label":"...","value":"...","trend":"..."}],"alerts":[{"severity":"critical|warning|info","description":"..."}]}],"criticalAlerts":[{"plantName":"...","severity":"critical","description":"..."}],"trends":["..."],"actions":["..."],"data_gaps":["..."],"confidence":0}',
        '',
        'REGLAS:',
        '- Devuelve SOLO JSON válido (sin markdown)',
        '- Usa labels legibles en highlights',
        dataGaps.length ? `- data_gaps iniciales: ${dataGaps.join(' | ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const result = await callWithRetries(async () =>
        callOpenAIJson({
          model,
          maxOutputTokens: config.AI_MAX_OUTPUT_TOKENS,
          messages: [
            { role: 'system', content: system.prompt },
            { role: 'user', content: userContent },
          ],
        })
      );

      const parsed = safeJsonParse(result.content);
      const validated = companyInsightSchema.parse(parsed);
      const mergedGaps = Array.from(new Set([...(validated.data_gaps ?? []), ...dataGaps]));
      const contentJson = { ...validated, data_gaps: mergedGaps };

      await prisma.aIInsight.update({
        where: { id: insight.id },
        data: {
          status: 'success',
          contentJson,
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          totalTokens: result.totalTokens,
          generatedAt: new Date(),
        },
      });
    } catch (error: any) {
      await prisma.aIInsight.update({
        where: { id: insight.id },
        data: {
          status: 'error',
          errorCode: 'generation_failed',
          errorMessage: String(error?.message || error),
          generatedAt: new Date(),
        },
      });
      throw error;
    }
  });

  if (!locked) {
    logger.info({ lockName }, 'AI job skipped (lock busy)');
  }
}

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    // Sometimes model returns leading/trailing text; try to extract the first {...} block
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(s.slice(start, end + 1));
    }
    throw new Error('Invalid JSON from OpenAI');
  }
}

function hashString(input: string): string {
  // Simple deterministic hash without importing heavy libs; sufficient for audit keys.
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return `h${h.toString(16)}`;
}

async function callWithRetries<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= config.AI_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delayMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
      logger.warn({ attempt, delayMs, err: String(err) }, 'AI call failed, retrying');
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function startAIWorker(): Promise<void> {
  if (!config.AI_WORKER_ENABLED) {
    logger.info('AI worker disabled');
    return;
  }
  logger.info({ concurrency: config.AI_WORKER_CONCURRENCY }, 'AI worker starting');
  const loops = Array.from({ length: Math.max(1, config.AI_WORKER_CONCURRENCY) }, (_, idx) => idx);
  for (const idx of loops) {
    void (async () => {
      while (true) {
        try {
          const job = await dequeueJob(5);
          if (!job) continue;
          logger.info({ idx, job: { type: job.type, tenantId: job.tenantId, plantId: job.plantId, periodStart: job.periodStart, periodEnd: job.periodEnd } }, 'AI job received');
          await processJob(job);
        } catch (error) {
          logger.error({ error }, 'AI worker loop error');
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    })();
  }
}

