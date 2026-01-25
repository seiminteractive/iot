export type InsightType = 'plant' | 'company';

export interface AIJob {
  type: InsightType;
  tenantId: string;
  plantId?: string | null;
  periodStart: string; // ISO
  periodEnd: string;   // ISO
  requestedBy?: string | null;
  reason?: 'scheduled' | 'manual' | 'stale';
}

