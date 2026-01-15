import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  // Base
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3002'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),
  DB_POOL_MIN: z.string().transform(Number).default('2'),
  DB_POOL_MAX: z.string().transform(Number).default('10'),

  // AWS IoT / MQTT
  AWS_IOT_ENDPOINT: z.string(),
  AWS_IOT_CLIENT_ID: z.string(),
  AWS_IOT_CERT_PATH: z.string(),
  AWS_IOT_KEY_PATH: z.string(),
  AWS_IOT_CA_PATH: z.string(),
  MQTT_TOPICS_TELEMETRY: z.string().default('factory/+/+/+/+/telemetry'),
  MQTT_TOPICS_STATUS: z.string().default('ops/+/+/+/gateway/+/status'),
  MQTT_QOS: z.string().transform(Number).default('1'),
  MQTT_KEEP_ALIVE: z.string().transform(Number).default('60'),
  MQTT_RECONNECT_PERIOD: z.string().transform(Number).default('5000'),
  MQTT_MAX_RECONNECT_ATTEMPTS: z.string().transform(Number).default('10'),

  // API
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),

  // WebSocket
  WS_HEARTBEAT_INTERVAL: z.string().transform(Number).default('30000'),
  WS_MAX_CONNECTIONS: z.string().transform(Number).default('1000'),

  // Auth (Firebase)
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PREFIX: z.string().default('iot'),
});

export type Config = z.infer<typeof envSchema>;

let config: Config;

try {
  config = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(error.errors, null, 2));
    process.exit(1);
  }
  throw error;
}

export { config };
