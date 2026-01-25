-- Make AIInsight columns nullable to support pending/running/error states without fake payloads

ALTER TABLE "ai_insights"
  ALTER COLUMN "content_json" DROP NOT NULL,
  ALTER COLUMN "input_snapshot_json" DROP NOT NULL,
  ALTER COLUMN "input_hash" DROP NOT NULL,
  ALTER COLUMN "prompt_version" DROP NOT NULL,
  ALTER COLUMN "system_prompt_ver" DROP NOT NULL,
  ALTER COLUMN "model_used" DROP NOT NULL;

