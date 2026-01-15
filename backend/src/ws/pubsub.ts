import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { WSMessage } from '../types/index.js';
import { connectionManager } from './connectionManager.js';

const instanceId = randomUUID();
const channel = `${config.REDIS_PREFIX}:ws`;

const publisher = new Redis(config.REDIS_URL);
const subscriber = new Redis(config.REDIS_URL);

export function getInstanceId() {
  return instanceId;
}

export async function initWsPubSub() {
  subscriber.on('message', (ch, message) => {
    if (ch !== channel) return;
    try {
      const parsed = JSON.parse(message) as { origin: string; payload: WSMessage };
      if (parsed.origin === instanceId) return;
      connectionManager.broadcastToFiltered(parsed.payload);
    } catch (error) {
      logger.error({ error }, 'Failed to parse WS pubsub message');
    }
  });

  await subscriber.subscribe(channel);
  logger.info({ channel }, 'Redis WS pubsub subscribed');
}

export async function publishWsMessage(message: WSMessage) {
  try {
    await publisher.publish(channel, JSON.stringify({ origin: instanceId, payload: message }));
  } catch (error) {
    logger.error({ error }, 'Failed to publish WS message to Redis');
  }
}
