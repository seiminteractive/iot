-- Eliminar índice anterior
DROP INDEX IF EXISTS "telemetry_aggregated_tenant_id_plant_id_metric_id_bucket_idx";

-- Crear nuevo índice optimizado con plcId
CREATE INDEX "telemetry_aggregated_tenant_id_plant_id_plc_id_metric_id_buck_idx" 
  ON "telemetry_aggregated"("tenant_id", "plant_id", "plc_id", "metric_id", "bucket" DESC);
