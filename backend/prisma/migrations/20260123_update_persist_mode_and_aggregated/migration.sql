-- Actualizar PersistMode enum: eliminar 'hourly', 'both', 'none' y agregar 'interval'
-- Primero actualizamos los datos existentes
UPDATE persist_rules SET mode = 'raw' WHERE mode IN ('hourly', 'both', 'none');

-- Recrear el enum
ALTER TYPE "PersistMode" RENAME TO "PersistMode_old";
CREATE TYPE "PersistMode" AS ENUM ('raw', 'interval');
ALTER TABLE "persist_rules" ALTER COLUMN "mode" TYPE "PersistMode" USING mode::text::"PersistMode";
DROP TYPE "PersistMode_old";

-- Agregar campo interval_minutes a persist_rules
ALTER TABLE "persist_rules" ADD COLUMN "interval_minutes" INTEGER;

-- Renombrar tabla telemetry_hourly a telemetry_aggregated
ALTER TABLE "telemetry_hourly" RENAME TO "telemetry_aggregated";

-- Renombrar campo hour a bucket
ALTER TABLE "telemetry_aggregated" RENAME COLUMN "hour" TO "bucket";

-- Agregar campo interval_minutes a telemetry_aggregated (default 60 para datos existentes que eran hourly)
ALTER TABLE "telemetry_aggregated" ADD COLUMN "interval_minutes" INTEGER NOT NULL DEFAULT 60;

-- Actualizar constraint unique
ALTER TABLE "telemetry_aggregated" DROP CONSTRAINT IF EXISTS "telemetry_hourly_tenant_id_plant_id_gateway_id_plc_id_metric_key";
ALTER TABLE "telemetry_aggregated" ADD CONSTRAINT "telemetry_aggregated_tenant_id_plant_id_gateway_id_plc_id_me_key" 
  UNIQUE ("tenant_id", "plant_id", "gateway_id", "plc_id", "metric_id", "bucket", "interval_minutes");

-- Actualizar índices
DROP INDEX IF EXISTS "telemetry_hourly_tenant_id_plant_id_metric_id_hour_idx";
CREATE INDEX "telemetry_aggregated_tenant_id_plant_id_metric_id_bucket_idx" 
  ON "telemetry_aggregated"("tenant_id", "plant_id", "metric_id", "bucket" DESC);
