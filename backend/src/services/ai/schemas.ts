import { z } from 'zod';

export const plantInsightSchema = z.object({
  summary: z.string(),
  byPlc: z.array(
    z.object({
      plcId: z.string(),
      plcName: z.string(),
      status: z.enum(['ok', 'warning', 'critical']).optional().default('ok'),
      highlights: z
        .array(z.object({ label: z.string(), value: z.string(), trend: z.string().optional().default('') }))
        .optional()
        .default([]),
      alerts: z
        .array(z.object({ severity: z.enum(['critical', 'warning', 'info']), description: z.string() }))
        .optional()
        .default([]),
      actions: z.array(z.string()).optional().default([]),
    })
  ),
  risks: z.array(z.string()).optional().default([]),
  actions: z.array(z.string()).optional().default([]),
  data_gaps: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(100).optional().default(50),
});

export const companyInsightSchema = z.object({
  summary: z.string(),
  ranking: z
    .array(
      z.object({
        plantId: z.string(),
        plantName: z.string(),
        position: z.number().int().positive(),
        status: z.enum(['ok', 'warning', 'critical']).optional().default('ok'),
        highlights: z
          .array(z.object({ label: z.string(), value: z.string(), trend: z.string().optional().default('') }))
          .optional()
          .default([]),
        alerts: z
          .array(z.object({ severity: z.enum(['critical', 'warning', 'info']), description: z.string() }))
          .optional()
          .default([]),
      })
    )
    .optional()
    .default([]),
  criticalAlerts: z
    .array(z.object({ plantName: z.string(), severity: z.literal('critical'), description: z.string() }))
    .optional()
    .default([]),
  trends: z.array(z.string()).optional().default([]),
  actions: z.array(z.string()).optional().default([]),
  data_gaps: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(100).optional().default(50),
});

