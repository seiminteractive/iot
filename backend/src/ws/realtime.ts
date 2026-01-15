import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { connectionManager } from './connectionManager.js';
import { logger } from '../utils/logger.js';
import { verifyFirebaseToken } from '../auth/firebase.js';

const realtimePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const clientId = randomUUID();
    const { token, tenant, plant, machineId, thingName } = request.query as {
      token?: string;
      tenant?: string;
      plant?: string;
      machineId?: string;
      thingName?: string;
    };

    try {
      if (!token) {
        socket.close(1008, 'Missing token');
        return;
      }

      const decoded = await verifyFirebaseToken(token);
      const tenantId = decoded.tenantId as string | undefined;
      const role = decoded.role as string | undefined;
      const plantAccess = (decoded.plantAccess as string[] | undefined) || [];

      if (!tenantId || !role) {
        socket.close(1008, 'Missing tenant or role');
        return;
      }

      const effectiveTenant = tenant || tenantId;
      if (effectiveTenant !== tenantId) {
        socket.close(1008, 'Tenant mismatch');
        return;
      }

      if (plant && plantAccess.length > 0 && !plantAccess.includes(plant) && !plantAccess.includes('*')) {
        socket.close(1008, 'Forbidden plant');
        return;
      }

      logger.info(
        { clientId, tenant: effectiveTenant, plant, machineId, thingName, ip: request.ip },
        'WebSocket connection request'
      );

      // Add client to connection manager
      connectionManager.addClient(clientId, socket, effectiveTenant, plant, machineId, thingName);
    } catch (error) {
      logger.error({ error, clientId }, 'WebSocket auth failed');
      socket.close(1008, 'Unauthorized');
      return;
    }

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
