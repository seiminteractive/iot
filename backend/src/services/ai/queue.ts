import { config } from '../../config/env.js';
import { getRedis, keyOf } from './redis.js';
import type { AIJob } from './types.js';

const queueKey = keyOf(config.AI_QUEUE_NAME);

export async function enqueueJob(job: AIJob): Promise<void> {
  const redis = getRedis();
  await redis.lpush(queueKey, JSON.stringify(job));
}

export async function dequeueJob(blockTimeoutSeconds = 5): Promise<AIJob | null> {
  const redis = getRedis();
  // BRPOP returns [key, value] or null
  const res = await redis.brpop(queueKey, blockTimeoutSeconds);
  if (!res) return null;
  const [, payload] = res;
  return JSON.parse(payload) as AIJob;
}

