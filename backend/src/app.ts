import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { mqttClient } from './mqtt/client.js';
import { connectionManager } from './ws/connectionManager.js';
import authPlugin from './api/plugins/auth.js';
import { initWsPubSub } from './ws/pubsub.js';

// Plugins
import rateLimitPlugin from './api/plugins/rateLimit.js';

// Routes
import healthRoutes from './api/routes/health.js';
import machinesRoutes from './api/routes/machines.js';
import telemetryRoutes from './api/routes/telemetry.js';
import alarmsRoutes from './api/routes/alarms.js';

// WebSocket
import realtimePlugin from './ws/realtime.js';

const fastify = Fastify({
  logger: logger as any,
  disableRequestLogging: config.NODE_ENV === 'production',
  trustProxy: true,
});

async function start() {
  try {
    // CORS global (evita problemas de encapsulación con plugins)
    await fastify.register(fastifyCors, {
      origin:
        config.NODE_ENV === 'development'
          ? [
              'http://localhost:8080',
              'http://localhost:5173',
              'http://127.0.0.1:8080',
              'http://127.0.0.1:5173',
            ]
          : (config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    });
    await fastify.register(websocket);
    // await fastify.register(rateLimitPlugin); // Deshabilitado temporalmente
    await fastify.register(authPlugin);

    // Register routes
    await fastify.register(healthRoutes);
    await fastify.register(machinesRoutes, { prefix: '/api' });
    await fastify.register(telemetryRoutes, { prefix: '/api' });
    await fastify.register(alarmsRoutes, { prefix: '/api' });

    // Register WebSocket
    await fastify.register(realtimePlugin);

    // Start Fastify server
    await fastify.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    logger.info(`🚀 Server listening on port ${config.PORT}`);

    // Init Redis Pub/Sub for WebSocket fanout
    await initWsPubSub();

    // Connect to AWS IoT Core
    await mqttClient.connect();

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      
      try {
        // Disconnect MQTT
        await mqttClient.disconnect();
        
        // Close WebSocket connections
        connectionManager.shutdown();
        
        // Close Fastify
        await fastify.close();
        
        logger.info('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
