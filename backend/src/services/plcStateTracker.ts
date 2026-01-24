import { logger } from '../utils/logger.js';
import { publishWsMessage } from '../ws/pubsub.js';

// Tiempo sin recibir datos para considerar un PLC offline
// Con datos cada 1 segundo, 30 segundos da margen suficiente para jitter de red
const OFFLINE_THRESHOLD_MS = 30 * 1000;

interface PLCOnlineState {
  plcId: string;
  plcThingName: string;
  tenantId: string;
  plantId: string;
  isOnline: boolean;
  lastTs: number;
}

// Map para trackear estado anterior de PLCs
const plcStates = new Map<string, PLCOnlineState>();

/**
 * Actualiza el estado de un PLC y emite evento si cambió
 * @param receivedAt - Momento en que el servidor recibió el mensaje (usar new Date())
 */
export async function updatePLCState(
  plcId: string,
  plcThingName: string,
  tenantId: string,
  plantId: string,
  receivedAt: Date
) {
  const receivedAtMs = receivedAt.getTime();
  const previousState = plcStates.get(plcId);
  const wasOnline = previousState?.isOnline ?? false; // Asumir offline si no hay estado anterior

  // Si recibimos un mensaje, el PLC está online
  const isOnline = true;

  // Guardar nuevo estado
  plcStates.set(plcId, {
    plcId,
    plcThingName,
    tenantId,
    plantId,
    isOnline,
    lastTs: receivedAtMs,
  });

  // Solo emitir evento si pasó de offline a online
  if (!wasOnline && isOnline) {
    logger.info(
      { plcId, plcThingName },
      'PLC came online'
    );

    await publishWsMessage({
      type: 'plc_state_changed',
      plcId,
      plcThingName,
      tenantId,
      plantId,
      isOnline: true,
      lastSeenAt: receivedAt.toISOString(),
    });
  }
}

/**
 * Limpia PLCs que no han recibido datos en mucho tiempo
 * Ejecutar periódicamente para detectar desconexiones lentas
 */
export async function checkOfflinePLCs() {
  const now = Date.now();

  for (const [plcId, state] of plcStates.entries()) {
    if (state.isOnline && now - state.lastTs > OFFLINE_THRESHOLD_MS) {
      // Marcar como offline
      logger.warn({ plcId: state.plcThingName }, 'PLC marked as offline due to inactivity');

      await publishWsMessage({
        type: 'plc_state_changed',
        plcId: state.plcId,
        plcThingName: state.plcThingName,
        tenantId: state.tenantId,
        plantId: state.plantId,
        isOnline: false,
        lastSeenAt: new Date(state.lastTs).toISOString(),
      });

      state.isOnline = false;
    }
  }
}

/**
 * Obtener estado actual de un PLC
 */
export function getPLCState(plcId: string): PLCOnlineState | undefined {
  return plcStates.get(plcId);
}

/**
 * Obtener todos los estados de PLCs
 */
export function getAllPLCStates(): PLCOnlineState[] {
  return Array.from(plcStates.values());
}
