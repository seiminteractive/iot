-- CreateTable
CREATE TABLE "machines" (
    "id" UUID NOT NULL,
    "site" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemetry_events" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "topic" TEXT NOT NULL,
    "values_json" JSONB NOT NULL,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_state" (
    "machine_id" UUID NOT NULL,
    "last_ts" TIMESTAMPTZ NOT NULL,
    "last_values_json" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "machine_state_pkey" PRIMARY KEY ("machine_id")
);

-- CreateTable
CREATE TABLE "alarms" (
    "id" UUID NOT NULL,
    "machine_id" UUID NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alarms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "machines_site_machine_id_key" ON "machines"("site", "machine_id");

-- CreateIndex
CREATE INDEX "telemetry_events_machine_id_ts_idx" ON "telemetry_events"("machine_id", "ts" DESC);

-- CreateIndex
CREATE INDEX "telemetry_events_ts_idx" ON "telemetry_events"("ts" DESC);

-- CreateIndex
CREATE INDEX "alarms_machine_id_ts_idx" ON "alarms"("machine_id", "ts" DESC);

-- CreateIndex
CREATE INDEX "alarms_acknowledged_severity_idx" ON "alarms"("acknowledged", "severity");

-- AddForeignKey
ALTER TABLE "telemetry_events" ADD CONSTRAINT "telemetry_events_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_state" ADD CONSTRAINT "machine_state_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
