import { WebSocket } from 'ws';
import { WSMessage } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { metricsCollector } from '../utils/metrics.js';
import { config } from '../config/env.js';

interface ClientConnection {
  ws: WebSocket;
  tenant?: string;
  plant?: string;
  plcThingName?: string;
  gatewayId?: string;
  lastPing: number;
}

class ConnectionManager {
  private clients: Map<string, ClientConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  addClient(
    clientId: string,
    ws: WebSocket,
    tenant?: string,
    plant?: string,
    plcThingName?: string,
    gatewayId?: string
  ): void {
    this.clients.set(clientId, {
      ws,
      tenant,
      plant,
      plcThingName,
      gatewayId,
      lastPing: Date.now(),
    });

    metricsCollector.setWsConnections(this.clients.size);
    logger.info(
      { clientId, tenant, plant, plcThingName, gatewayId, total: this.clients.size },
      'WebSocket client connected'
    );

    // Start heartbeat if not already running
    if (!this.heartbeatInterval) {
      this.startHeartbeat();
    }
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    metricsCollector.setWsConnections(this.clients.size);
    logger.info({ clientId, total: this.clients.size }, 'WebSocket client disconnected');

    // Stop heartbeat if no clients
    if (this.clients.size === 0 && this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, client] of this.clients.entries()) {
        // Check if client is still alive
        if (client.ws.readyState === WebSocket.OPEN) {
          // Send ping
          client.ws.send(JSON.stringify({
            type: 'ping',
            ts: now,
          }));
        } else {
          // Remove dead connection
          this.removeClient(clientId);
        }
      }
    }, config.WS_HEARTBEAT_INTERVAL);
  }

  broadcastToAll(message: WSMessage): void {
    const payload = JSON.stringify(message);
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (error) {
          logger.error({ error, clientId }, 'Failed to send message to client');
          this.removeClient(clientId);
        }
      }
    }
  }

  broadcastToFiltered(message: WSMessage): void {
    const payload = JSON.stringify(message);
    
    for (const [clientId, client] of this.clients.entries()) {
      // Check if client is interested in this message
      const interestedInTenant = !client.tenant || client.tenant === message.tenant || client.tenant === '*';
      const interestedInPlant = !client.plant || client.plant === message.plant || client.plant === '*';
      const interestedInPlc =
        !client.plcThingName || client.plcThingName === message.plcThingName || client.plcThingName === '*';
      const interestedInGateway = !client.gatewayId || client.gatewayId === message.gatewayId || client.gatewayId === '*';

      if (interestedInTenant && interestedInPlant && interestedInPlc && interestedInGateway &&
          client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch (error) {
          logger.error({ error, clientId }, 'Failed to send message to client');
          this.removeClient(clientId);
        }
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, 'Server shutting down');
      }
    }

    this.clients.clear();
    metricsCollector.setWsConnections(0);
  }
}

const connectionManager = new ConnectionManager();

export { connectionManager };
