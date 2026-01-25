import Redis from 'ioredis';
import { config } from '../../config/env.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.REDIS_URL);
  }
  return redis;
}

export function keyOf(...parts: string[]): string {
  return [config.REDIS_PREFIX, ...parts].join(':');
}

