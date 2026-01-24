import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'crypto';
import { prisma } from '../db/prisma.js';
import { connectionManager } from './connectionManager.js';
import { logger } from '../utils/logger.js';
import { verifyFirebaseToken } from '../auth/firebase.js';

const realtimePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    const clientId = randomUUID();
    const { token, tenantId: tenantIdQuery, plantId: plantIdQuery, plcId: plcIdQuery, gatewayId } =
      request.query as {
      token?: string;
      tenantId?: string;
      plantId?: string;
      plcId?: string;
      gatewayId?: string;
    };

    try {
      if (!token) {
        logger.warn({ clientId, ip: request.ip }, 'WS rejected: missing token');
        socket.close(1008, 'Missing token');
        return;
      }

      const decoded = await verifyFirebaseToken(token);
      const tenantId = decoded.tenantId as string | undefined;
      const role = decoded.role as string | undefined;
      const plantAccess = (decoded.plantAccess as string[] | undefined) || [];

      if (!tenantId || !role) {
        logger.warn({ clientId, ip: request.ip, hasTenantId: !!tenantId, hasRole: !!role }, 'WS rejected: missing tenant or role');
        socket.close(1008, 'Missing tenant or role');
        return;
      }

      const effectiveTenantId = tenantIdQuery || tenantId;
      if (effectiveTenantId !== tenantId) {
        logger.warn({ clientId, ip: request.ip, tenantIdClaim: tenantId, tenantIdQuery: tenantIdQuery }, 'WS rejected: tenant mismatch');
        socket.close(1008, 'Tenant mismatch');
        return;
      }

      // Validar acceso a planta
      // Si el usuario tiene plantAccess restringido, verificar que pueda acceder a la planta solicitada
      const effectivePlantId = plantIdQuery;
      const restrictedPlantAccess = plantAccess.length > 0 && !plantAccess.includes('*');

      if (effectivePlantId && restrictedPlantAccess) {
        if (!plantAccess.includes(effectivePlantId)) {
          logger.warn({ clientId, ip: request.ip, tenantId: tenantId, plantIdQuery, plantAccessCount: plantAccess.length }, 'WS rejected: forbidden plant');
          socket.close(1008, 'Forbidden plant');
          return;
        }
      }

      const effectiveGatewayId = gatewayId;
      logger.info(
        {
          clientId,
          tenantId: effectiveTenantId,
          plantId: effectivePlantId,
          plcId: plcIdQuery,
          gatewayId: effectiveGatewayId,
          ip: request.ip,
        },
        'WebSocket connection request'
      );

      // Add client to connection manager
      connectionManager.addClient(
        clientId,
        socket,
        effectiveTenantId,
        effectivePlantId,
        restrictedPlantAccess ? plantAccess : undefined,
        plcIdQuery,
        effectiveGatewayId
      );
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
