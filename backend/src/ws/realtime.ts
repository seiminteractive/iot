import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { connectionManager } from './connectionManager.js';
import { logger } from '../utils/logger.js';

const realtimePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket, request) => {
    const clientId = randomUUID();
    const { site, machineId } = request.query as { site?: string; machineId?: string };

    logger.info({ clientId, site, machineId, ip: request.ip }, 'WebSocket connection request');

    // Add client to connection manager
    connectionManager.addClient(clientId, socket, site, machineId);

    // Handle messages from client (optional)
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        logger.debug({ clientId, message }, 'Received message from client');

        // Handle client messages (e.g., subscribe to specific topics)
        if (message.type === 'subscribe') {
          // Update client filters
          // This could be extended to dynamically update subscriptions
        }
      } catch (error) {
        logger.error({ error, clientId }, 'Error handling client message');
      }
    });

    // Handle client disconnect
    socket.on('close', () => {
      connectionManager.removeClient(clientId);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error({ error, clientId }, 'WebSocket error');
      connectionManager.removeClient(clientId);
    });

    // Send welcome message
    socket.send(JSON.stringify({
      type: 'connected',
      clientId,
      message: 'Connected to IoT Telemetry WebSocket',
    }));
  });
};

export default realtimePlugin;
