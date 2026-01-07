import mqtt, { MqttClient as MqttClientType } from 'mqtt';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ingestTelemetry } from '../services/ingestTelemetry.js';
import { metricsCollector } from '../utils/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MQTTClient {
  private client: MqttClientType | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private subscriptions: Set<string> = new Set();

  async connect(): Promise<void> {
    try {
      logger.info('🔌 Connecting to AWS IoT Core...');

      // Resolve certificate paths
      const certPath = path.resolve(process.cwd(), config.AWS_IOT_CERT_PATH);
      const keyPath = path.resolve(process.cwd(), config.AWS_IOT_KEY_PATH);
      const caPath = path.resolve(process.cwd(), config.AWS_IOT_CA_PATH);

      logger.debug({ certPath, keyPath, caPath }, 'Certificate paths');

      // Read certificates
      const cert = readFileSync(certPath);
      const key = readFileSync(keyPath);
      const ca = readFileSync(caPath);

      // Create MQTT client with mTLS
      const options: mqtt.IClientOptions = {
        host: config.AWS_IOT_ENDPOINT,
        port: 8883,
        protocol: 'mqtts',
        clientId: config.AWS_IOT_CLIENT_ID,
        cert,
        key,
        ca,
        rejectUnauthorized: true,
        reconnectPeriod: config.MQTT_RECONNECT_PERIOD,
        connectTimeout: 30 * 1000,
        keepalive: config.MQTT_KEEP_ALIVE,
        clean: false, // persistent session
        will: {
          topic: 'factory/backend/status',
          payload: JSON.stringify({ status: 'offline', ts: Date.now() }),
          qos: 1,
          retain: true,
        },
      };

      this.client = mqtt.connect(options);
      this.setupEventHandlers();

    } catch (error) {
      logger.error({ error }, 'Failed to connect to AWS IoT Core');
      await this.handleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('✅ Connected to AWS IoT Core');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Re-subscribe to topics after connection
      this.subscribeToTopics();

      // Publish online status
      this.publishStatus('online');
    });

    this.client.on('message', this.handleMessage.bind(this));

    this.client.on('error', (error) => {
      logger.error({ error }, 'MQTT error');
      metricsCollector.incrementFailed();
    });

    this.client.on('offline', () => {
      logger.warn('MQTT offline');
      this.isConnected = false;
      this.handleReconnect();
    });

    this.client.on('reconnect', () => {
      logger.info('MQTT reconnecting...');
    });

    this.client.on('close', () => {
      logger.warn('MQTT connection closed');
      this.isConnected = false;
    });
  }

  private async handleReconnect(): Promise<void> {
    this.reconnectAttempts++;

    if (this.reconnectAttempts >= config.MQTT_MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnect attempts reached. Exiting...');
      process.exit(1);
    }

    const delay = Math.min(
      config.MQTT_RECONNECT_PERIOD * Math.pow(2, this.reconnectAttempts - 1),
      60000 // max 1 minute
    );

    logger.warn(
      `Reconnect attempt ${this.reconnectAttempts}/${config.MQTT_MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`
    );

    // mqtt.js handles reconnection automatically, so we just wait
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private subscribeToTopics(): void {
    if (!this.client || !this.isConnected) {
      logger.warn('Cannot subscribe: not connected');
      return;
    }

    // En desarrollo: suscribirse a todo para debuggear.
    // En producción: usar los topics configurados.
    const topics =
      config.NODE_ENV === 'development'
        ? ['#']
        : [config.MQTT_TOPICS_TELEMETRY, config.MQTT_TOPICS_STATUS];

    for (const topic of topics) {
      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          logger.error({ error, topic }, 'Failed to subscribe to topic');
          metricsCollector.incrementFailed();
        } else {
          this.subscriptions.add(topic);
          logger.info(`📥 Subscribed to: ${topic}`);
        }
      });
    }
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      metricsCollector.incrementReceived();

      const message = JSON.parse(payload.toString());

      // Log TODOS los mensajes (para debuggear)
      logger.info({ topic, message }, '📨 MQTT Message Received');

      // Procesar SIEMPRE (parseTopic/ingesta hacen fallback si el topic no es factory/...)
      await ingestTelemetry(topic, message);
      metricsCollector.incrementProcessed();
      metricsCollector.updateLastMessage();

    } catch (error) {
      logger.error({ error, topic, payload: payload.toString() }, 'Error handling MQTT message');
      metricsCollector.incrementFailed();
    }
  }

  publish(topic: string, payload: any, qos: 0 | 1 | 2 = 1): void {
    if (!this.client || !this.isConnected) {
      logger.warn('Cannot publish: not connected');
      return;
    }

    try {
      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);

      this.client.publish(topic, message, { qos }, (error) => {
        if (error) {
          logger.error({ error, topic }, 'Failed to publish message');
          metricsCollector.incrementFailed();
        } else {
          logger.debug({ topic, payload }, 'Published MQTT message');
        }
      });
    } catch (error) {
      logger.error({ error, topic }, 'Error publishing message');
    }
  }

  private publishStatus(status: 'online' | 'offline'): void {
    this.publish(
      'factory/backend/status',
      { status, ts: Date.now(), clientId: config.AWS_IOT_CLIENT_ID },
      1
    );
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;

    return new Promise<void>((resolve) => {
      try {
        logger.info('Disconnecting from AWS IoT Core...');

        this.publishStatus('offline');

        this.client?.end(false, {}, () => {
          this.isConnected = false;
          logger.info('✅ Disconnected from AWS IoT Core');
          resolve();
        });

        // Timeout si tarda mucho
        setTimeout(() => {
          resolve();
        }, 5000);
      } catch (error) {
        logger.error({ error }, 'Error during disconnect');
        resolve();
      }
    });
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const mqttClient = new MQTTClient();
