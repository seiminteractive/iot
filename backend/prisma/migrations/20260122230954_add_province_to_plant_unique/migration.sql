-- DropConstraint (unique constraint, not just index)
ALTER TABLE "plants" DROP CONSTRAINT IF EXISTS "plants_tenant_id_plant_id_key";

-- CreateIndex (new unique constraint with province)
CREATE UNIQUE INDEX "plants_tenant_id_province_plant_id_key" ON "plants"("tenant_id", "province", "plant_id");
