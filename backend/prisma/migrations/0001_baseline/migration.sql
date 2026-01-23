CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "PersistMode" AS ENUM ('raw', 'hourly', 'both', 'none');
CREATE TYPE "PersistAggregate" AS ENUM ('sum', 'avg', 'min', 'max', 'last');

CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenants_slug_key" UNIQUE ("slug")
);

CREATE TABLE "plants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "province" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "plants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plants_tenant_id_plant_id_key" UNIQUE ("tenant_id", "plant_id")
);

CREATE INDEX "plants_tenant_id_province_idx" ON "plants" ("tenant_id", "province");

CREATE TABLE "gateways" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "gateway_id" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'offline',
    "version" TEXT,
    "uptime_sec" INTEGER,
    "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "gateways_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "gateways_tenant_id_gateway_id_key" UNIQUE ("tenant_id", "gateway_id")
);

CREATE INDEX "gateways_tenant_id_plant_id_idx" ON "gateways" ("tenant_id", "plant_id");

CREATE TABLE "plcs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "gateway_id" UUID NOT NULL,
    "plc_thing_name" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "plcs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plcs_tenant_id_plant_id_plc_thing_name_key" UNIQUE ("tenant_id", "plant_id", "plc_thing_name")
);

CREATE INDEX "plcs_tenant_id_plant_id_idx" ON "plcs" ("tenant_id", "plant_id");
CREATE INDEX "plcs_tenant_id_plant_id_gateway_id_idx" ON "plcs" ("tenant_id", "plant_id", "gateway_id");

CREATE TABLE "telemetry_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "gateway_id" UUID NOT NULL,
    "plc_id" UUID NOT NULL,
    "metric_id" TEXT NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "topic" TEXT NOT NULL,
    "values_json" JSONB NOT NULL,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "telemetry_events_dedupe_key" UNIQUE ("tenant_id", "plant_id", "gateway_id", "plc_id", "metric_id", "ts")
);

CREATE INDEX "telemetry_events_tenant_id_plant_id_ts_idx" ON "telemetry_events" ("tenant_id", "plant_id", "ts" DESC);
CREATE INDEX "telemetry_events_plc_id_ts_idx" ON "telemetry_events" ("plc_id", "ts" DESC);

CREATE TABLE "plc_state" (
    "plc_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "last_ts" TIMESTAMPTZ NOT NULL,
    "last_values_json" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "plc_state_pkey" PRIMARY KEY ("plc_id")
);

CREATE INDEX "plc_state_tenant_id_plant_id_idx" ON "plc_state" ("tenant_id", "plant_id");

CREATE TABLE "alarms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "plc_id" UUID NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "alarms_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alarms_tenant_id_plant_id_ts_idx" ON "alarms" ("tenant_id", "plant_id", "ts" DESC);
CREATE INDEX "alarms_plc_id_ts_idx" ON "alarms" ("plc_id", "ts" DESC);
CREATE INDEX "alarms_acknowledged_severity_idx" ON "alarms" ("acknowledged", "severity");

CREATE TABLE "persist_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID,
    "gateway_id" UUID,
    "plc_id" UUID,
    "metric_id" TEXT NOT NULL,
    "mode" "PersistMode" NOT NULL,
    "aggregate" "PersistAggregate",
    "retention_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "persist_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "persist_rules_tenant_id_metric_id_idx" ON "persist_rules" ("tenant_id", "metric_id");
CREATE INDEX "persist_rules_tenant_id_plant_id_plc_id_metric_id_idx"
ON "persist_rules" ("tenant_id", "plant_id", "plc_id", "metric_id");

CREATE TABLE "telemetry_hourly" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "gateway_id" UUID NOT NULL,
    "plc_id" UUID NOT NULL,
    "metric_id" TEXT NOT NULL,
    "hour" TIMESTAMPTZ NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "sum" DOUBLE PRECISION,
    "min" DOUBLE PRECISION,
    "max" DOUBLE PRECISION,
    "last_value_json" JSONB,
    "last_ts" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "telemetry_hourly_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "telemetry_hourly_dedupe_key" UNIQUE ("tenant_id", "plant_id", "gateway_id", "plc_id", "metric_id", "hour")
);

CREATE INDEX "telemetry_hourly_tenant_id_plant_id_metric_id_hour_idx"
ON "telemetry_hourly" ("tenant_id", "plant_id", "metric_id", "hour" DESC);

CREATE TABLE "plc_dashboards" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "plc_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon_url" TEXT,
    "layout_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "plc_dashboards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plc_dashboards_tenant_id_plant_id_plc_id_key" UNIQUE ("tenant_id", "plant_id", "plc_id")
);

CREATE INDEX "plc_dashboards_tenant_id_plant_id_plc_id_idx"
ON "plc_dashboards" ("tenant_id", "plant_id", "plc_id");

CREATE TABLE "plc_dashboard_widgets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plc_dashboard_id" UUID NOT NULL,
    "widget_key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metric_id" TEXT NOT NULL,
    "unit" TEXT,
    "data_type" TEXT,
    "config_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "layout_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "plc_dashboard_widgets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plc_dashboard_widgets_unique_key" UNIQUE ("plc_dashboard_id", "widget_key")
);

CREATE INDEX "plc_dashboard_widgets_plc_dashboard_id_idx"
ON "plc_dashboard_widgets" ("plc_dashboard_id");

ALTER TABLE "plants"
ADD CONSTRAINT "plants_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gateways"
ADD CONSTRAINT "gateways_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gateways"
ADD CONSTRAINT "gateways_plant_id_fkey"
FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plcs"
ADD CONSTRAINT "plcs_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plcs"
ADD CONSTRAINT "plcs_plant_id_fkey"
FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plcs"
ADD CONSTRAINT "plcs_gateway_id_fkey"
FOREIGN KEY ("gateway_id") REFERENCES "gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "telemetry_events"
ADD CONSTRAINT "telemetry_events_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_events"
ADD CONSTRAINT "telemetry_events_plant_id_fkey"
FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_events"
ADD CONSTRAINT "telemetry_events_gateway_id_fkey"
FOREIGN KEY ("gateway_id") REFERENCES "gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_events"
ADD CONSTRAINT "telemetry_events_plc_id_fkey"
FOREIGN KEY ("plc_id") REFERENCES "plcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plc_state"
ADD CONSTRAINT "plc_state_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plc_state"
ADD CONSTRAINT "plc_state_plant_id_fkey"
FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plc_state"
ADD CONSTRAINT "plc_state_plc_id_fkey"
FOREIGN KEY ("plc_id") REFERENCES "plcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alarms"
ADD CONSTRAINT "alarms_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alarms"
ADD CONSTRAINT "alarms_plant_id_fkey"
FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alarms"
ADD CONSTRAINT "alarms_plc_id_fkey"
FOREIGN KEY ("plc_id") REFERENCES "plcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "persist_rules"
ADD CONSTRAINT "persist_rules_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "persist_rules"
ADD CONSTRAINT "persist_rules_plant_id_fkey"
FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "persist_rules"
ADD CONSTRAINT "persist_rules_gateway_id_fkey"
FOREIGN KEY ("gateway_id") REFERENCES "gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "persist_rules"
ADD CONSTRAINT "persist_rules_plc_id_fkey"
FOREIGN KEY ("plc_id") REFERENCES "plcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "telemetry_hourly"
ADD CONSTRAINT "telemetry_hourly_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_hourly"
ADD CONSTRAINT "telemetry_hourly_plant_id_fkey"
FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_hourly"
ADD CONSTRAINT "telemetry_hourly_gateway_id_fkey"
FOREIGN KEY ("gateway_id") REFERENCES "gateways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemetry_hourly"
ADD CONSTRAINT "telemetry_hourly_plc_id_fkey"
FOREIGN KEY ("plc_id") REFERENCES "plcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plc_dashboards"
ADD CONSTRAINT "plc_dashboards_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plc_dashboards"
ADD CONSTRAINT "plc_dashboards_plant_id_fkey"
FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plc_dashboards"
ADD CONSTRAINT "plc_dashboards_plc_id_fkey"
FOREIGN KEY ("plc_id") REFERENCES "plcs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plc_dashboard_widgets"
ADD CONSTRAINT "plc_dashboard_widgets_plc_dashboard_id_fkey"
FOREIGN KEY ("plc_dashboard_id") REFERENCES "plc_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
