import { logger } from '../utils/logger.js';
import { publishWsMessage } from '../ws/pubsub.js';

const ONLINE_THRESHOLD_MS = 15 * 1000;

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
 */
export async function updatePLCState(
  plcId: string,
  plcThingName: string,
  tenantId: string,
  plantId: string,
  lastTs: Date
) {
  const now = Date.now();
  const lastTsMs = lastTs.getTime();
  const isOnline = now - lastTsMs < ONLINE_THRESHOLD_MS;

  const previousState = plcStates.get(plcId);
  const wasOnline = previousState?.isOnline ?? true; // Asumir online si no hay estado anterior

  // Guardar nuevo estado
  plcStates.set(plcId, {
    plcId,
    plcThingName,
    tenantId,
    plantId,
    isOnline,
    lastTs: lastTsMs,
  });

  // Si cambió el estado, emitir evento
  if (isOnline !== wasOnline) {
    logger.info(
      { plcId, plcThingName, wasOnline, isOnline },
      'PLC state changed'
    );

    await publishWsMessage({
      type: 'plc_state_changed',
      plcId,
      plcThingName,
      tenantId,
      plantId,
      isOnline,
      lastSeenAt: lastTs.toISOString(),
    });
  }
}

/**
 * Limpia PLCs que no han recibido datos en mucho tiempo
 * Ejecutar periódicamente para detectar desconexiones lentas
 */
export async function checkOfflinePLCs() {
  const now = Date.now();
  const staleThreshold = 60 * 1000; // 1 minuto

  for (const [plcId, state] of plcStates.entries()) {
    if (state.isOnline && now - state.lastTs > staleThreshold) {
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
