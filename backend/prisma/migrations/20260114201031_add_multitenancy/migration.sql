/*
  Warnings:

  - You are about to drop the column `site` on the `machines` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenant_id,plant_id,machine_id]` on the table `machines` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idempotency_key]` on the table `telemetry_events` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `plant_id` to the `alarms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `alarms` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plant_id` to the `machine_state` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `machine_state` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plant_id` to the `machines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `machines` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plant_id` to the `telemetry_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenant_id` to the `telemetry_events` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "machines_site_machine_id_key";

-- DropIndex
DROP INDEX "telemetry_events_ts_idx";

-- AlterTable
ALTER TABLE "alarms" ADD COLUMN     "plant_id" UUID NOT NULL,
ADD COLUMN     "tenant_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "machine_state" ADD COLUMN     "plant_id" UUID NOT NULL,
ADD COLUMN     "tenant_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "machines" DROP COLUMN "site",
ADD COLUMN     "plant_id" UUID NOT NULL,
ADD COLUMN     "tenant_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "telemetry_events" ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "plant_id" UUID NOT NULL,
ADD COLUMN     "seq" INTEGER,
ADD COLUMN     "tenant_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "province" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gateways" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "thing_name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'offline',
    "version" TEXT,
    "uptime_sec" INTEGER,
    "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "gateways_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "plants_tenant_id_province_idx" ON "plants"("tenant_id", "province");

-- CreateIndex
CREATE UNIQUE INDEX "plants_tenant_id_plant_id_key" ON "plants"("tenant_id", "plant_id");

-- CreateIndex
CREATE INDEX "gateways_tenant_id_plant_id_idx" ON "gateways"("tenant_id", "plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "gateways_tenant_id_thing_name_key" ON "gateways"("tenant_id", "thing_name");

-- CreateIndex
CREATE INDEX "alarms_tenant_id_plant_id_ts_idx" ON "alarms"("tenant_id", "plant_id", "ts" DESC);

-- CreateIndex
CREATE INDEX "machine_state_tenant_id_plant_id_idx" ON "machine_state"("tenant_id", "plant_id");

-- CreateIndex
CREATE INDEX "machines_tenant_id_plant_id_idx" ON "machines"("tenant_id", "plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "machines_tenant_id_plant_id_machine_id_key" ON "machines"("tenant_id", "plant_id", "machine_id");

-- CreateIndex
CREATE UNIQUE INDEX "telemetry_events_idempotency_key_key" ON "telemetry_events"("idempotency_key");

-- CreateIndex
CREATE INDEX "telemetry_events_tenant_id_plant_id_ts_idx" ON "telemetry_events"("tenant_id", "plant_id", "ts" DESC);

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateways" ADD CONSTRAINT "gateways_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gateways" ADD CONSTRAINT "gateways_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_state" ADD CONSTRAINT "machine_state_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_state" ADD CONSTRAINT "machine_state_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
