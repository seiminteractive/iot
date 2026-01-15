import { WSMessage } from '../types/index.js';
import { connectionManager } from './connectionManager.js';
import { publishWsMessage } from './pubsub.js';

export async function broadcastToClients(message: WSMessage): Promise<void> {
  connectionManager.broadcastToFiltered(message);
  await publishWsMessage(message);
}
