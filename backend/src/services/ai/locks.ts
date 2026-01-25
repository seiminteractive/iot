import { config } from '../../config/env.js';
import { getRedis, keyOf } from './redis.js';

export async function withLock<T>(
  lockName: string,
  fn: () => Promise<T>,
  ttlMs: number = config.AI_LOCK_TTL_MS
): Promise<T | null> {
  const redis = getRedis();
  const key = keyOf('ai:lock', lockName);
  const token = `${Date.now()}-${Math.random()}`;
  const ok = await redis.set(key, token, 'PX', ttlMs, 'NX');
  if (!ok) return null;

  try {
    return await fn();
  } finally {
    // Best-effort release: delete only if token matches
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await redis.eval(script, 1, key, token);
  }
}

