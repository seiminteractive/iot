import { FastifyPluginAsync } from 'fastify';
import { mqttClient } from '../../mqtt/client.js';
import { metricsCollector } from '../../utils/metrics.js';
import { connectionManager } from '../../ws/connectionManager.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (request, reply) => {
    const mqttStatus = mqttClient.getConnectionStatus();
    const metrics = metricsCollector.getMetrics();

    const health = {
      status: mqttStatus ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      mqtt: {
        connected: mqttStatus,
      },
      metrics: {
        ...metrics,
        wsConnections: connectionManager.getClientCount(),
      },
    };

    const statusCode = mqttStatus ? 200 : 503;
    
    return reply.code(statusCode).send(health);
  });

  fastify.get('/metrics', async (request, reply) => {
    const metrics = metricsCollector.getMetrics();
    
    return reply.send({
      ...metrics,
      wsConnections: connectionManager.getClientCount(),
      mqttConnected: mqttClient.getConnectionStatus(),
    });
  });
};

export default healthRoutes;
