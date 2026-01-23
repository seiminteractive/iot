## Baseline Migration Strategy

This repo ships **one clean baseline migration** under `backend/prisma/migrations/0001_baseline/`.
Use it for new environments or clean rebuilds.

### New Environments (clean DB)
1. Ensure the database is empty (no tables).
2. Apply the baseline using Prisma:

```bash
cd backend
npx prisma migrate deploy
```

### Existing Production DB (data preservation)
We do **not** auto-drop production data.
Use one of these safe paths:

#### Option A — Keep production DB, update app code only
- Deploy the new code and **do not** apply baseline.
- Manual schema reconciliation is required (DBA-led).

#### Option B — Dump & restore to baseline (recommended for staging)
1. Dump existing data:
```bash
pg_dump -U iot_user -d iot_telemetry > backup.sql
```
2. Provision a new DB and apply baseline:
```bash
createdb iot_telemetry
cd backend && npx prisma migrate deploy
```
3. Restore data with mapping/ETL as needed.

### Notes
- Baseline includes PLC renames (`plcs`, `plc_state`) and removes legacy fields.
- Ensure `schema.prisma` matches baseline before deployment.
# Baseline Migration Guide

This repository now uses a **single baseline migration** located at:

```
backend/prisma/migrations/0001_baseline/migration.sql
```

## New Environment (Fresh DB)

1. Create a new empty database.
2. Apply the baseline:
   - Prisma: `npx prisma migrate deploy`
   - Or run the SQL file manually.

## Existing Production DB

**Do NOT drop production data automatically.**  
Use a manual dump/restore plan if you need to move to the baseline schema.

### Recommended manual approach

1. Create a full backup:
   ```
   pg_dump -Fc -U iot_user iot_telemetry > backup.dump
   ```

2. Restore into a new empty DB:
   ```
   createdb -U iot_user iot_telemetry_new
   pg_restore -U iot_user -d iot_telemetry_new backup.dump
   ```

3. Apply the baseline SQL to a **new clean DB** if you want a strict reset.
4. Write a dedicated migration script to map old tables/columns into the new schema.

## Notes

- Only one migration folder remains (`0001_baseline`).
- `schema.prisma` matches the baseline exactly.
- New tables include:
  - `plcs`, `plc_state`
  - `plc_dashboards`, `plc_dashboard_widgets`
  - `persist_rules` (with retention)
  - `telemetry_hourly`

