-- AI module init: GlobalConfig, MetricCatalog (scoped), AIInsight, Company Overview access + ai_config columns

-- Add ai_config columns
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_config" JSONB;
ALTER TABLE "plants" ADD COLUMN IF NOT EXISTS "ai_config" JSONB;

-- Global config table (system prompt, feature toggles)
CREATE TABLE IF NOT EXISTS "global_config" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_by" TEXT,
  CONSTRAINT "global_config_pkey" PRIMARY KEY ("key")
);

-- Allowlist for company overview (per tenant, by email)
CREATE TABLE IF NOT EXISTS "tenant_company_overview_access" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "email_lower" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "created_by" TEXT,
  "updated_by" TEXT,
  CONSTRAINT "tenant_company_overview_access_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_company_overview_access_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_company_overview_access_unique"
  ON "tenant_company_overview_access" ("tenant_id", "email_lower");
CREATE INDEX IF NOT EXISTS "tenant_company_overview_access_tenant_idx"
  ON "tenant_company_overview_access" ("tenant_id");

-- Metric catalog (scoped by tenant/plant/plc)
CREATE TABLE IF NOT EXISTS "metric_catalog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "plant_id" UUID,
  "plc_id" UUID,
  "metric_id" TEXT NOT NULL,

  "label" TEXT NOT NULL,
  "unit" TEXT,
  "description" TEXT,

  "enabled_for_ai" BOOLEAN NOT NULL DEFAULT true,
  "ai_priority" INTEGER NOT NULL DEFAULT 0,
  "key_for_ceo" BOOLEAN NOT NULL DEFAULT false,
  "key_for_plant" BOOLEAN NOT NULL DEFAULT false,

  "catalog_version" INTEGER NOT NULL DEFAULT 1,
  "updated_by" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "metric_catalog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "metric_catalog_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "metric_catalog_plant_id_fkey"
    FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE,
  CONSTRAINT "metric_catalog_plc_id_fkey"
    FOREIGN KEY ("plc_id") REFERENCES "plcs"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "metric_catalog_scope_unique"
  ON "metric_catalog" ("tenant_id", "plant_id", "plc_id", "metric_id");

CREATE INDEX IF NOT EXISTS "metric_catalog_tenant_metric_idx"
  ON "metric_catalog" ("tenant_id", "metric_id");
CREATE INDEX IF NOT EXISTS "metric_catalog_tenant_plant_metric_idx"
  ON "metric_catalog" ("tenant_id", "plant_id", "metric_id");
CREATE INDEX IF NOT EXISTS "metric_catalog_tenant_plant_plc_metric_idx"
  ON "metric_catalog" ("tenant_id", "plant_id", "plc_id", "metric_id");

-- AI insights (plant-level and company-level)
CREATE TABLE IF NOT EXISTS "ai_insights" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "plant_id" UUID,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',

  "content_json" JSONB NOT NULL,
  "content_markdown" TEXT,

  "input_snapshot_json" JSONB NOT NULL,
  "input_hash" TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "system_prompt_ver" TEXT NOT NULL,
  "catalog_version" INTEGER NOT NULL DEFAULT 1,
  "stale" BOOLEAN NOT NULL DEFAULT false,

  "model_used" TEXT NOT NULL,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,

  "period_start" TIMESTAMPTZ NOT NULL,
  "period_end" TIMESTAMPTZ NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,

  "error_code" TEXT,
  "error_message" TEXT,

  "generated_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_insights_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_insights_plant_id_fkey"
    FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_insights_tenant_plant_type_idx"
  ON "ai_insights" ("tenant_id", "plant_id", "type");
CREATE INDEX IF NOT EXISTS "ai_insights_tenant_type_generated_idx"
  ON "ai_insights" ("tenant_id", "type", "generated_at" DESC);

