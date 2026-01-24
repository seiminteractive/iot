import { WSMessage } from '../types/index.js';
import { connectionManager } from './connectionManager.js';
import { publishWsMessage } from './pubsub.js';

export async function broadcastToClients(message: WSMessage): Promise<void> {
  connectionManager.broadcastToFiltered(message);
  await publishWsMessage(message);
}

/**
 * Notifica a los clientes que se actualizó un dato agregado.
 * Los widgets de gráficos pueden usar esto para refrescar sus datos.
 */
const aggregatedUpdateLastSent = new Map<string, number>();
const AGGREGATED_UPDATE_THROTTLE_MS = 1500;

export async function broadcastAggregatedUpdate(params: {
  tenantId: string;
  plantId: string;
  plcId: string;
  metricId: string;
  bucket: string;
  intervalMinutes: number;
}): Promise<void> {
  // Throttle por bucket+metric para no spamear en alta frecuencia
  const key = [
    params.tenantId,
    params.plantId,
    params.plcId,
    params.metricId,
    params.bucket,
    String(params.intervalMinutes),
  ].join('|');
  const now = Date.now();
  const last = aggregatedUpdateLastSent.get(key) || 0;
  if (now - last < AGGREGATED_UPDATE_THROTTLE_MS) return;
  aggregatedUpdateLastSent.set(key, now);

  const message: WSMessage = {
    type: 'aggregated_update',
    tenantId: params.tenantId,
    plantId: params.plantId,
    plcId: params.plcId,
    metricId: params.metricId,
    bucket: params.bucket,
    intervalMinutes: params.intervalMinutes,
  };

  // En escala/multi-instancia: necesitamos fanout por Redis Pub/Sub.
  await broadcastToClients(message);
}
