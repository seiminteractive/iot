import { getCurrentUser } from './authService';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

// Estado global del WebSocket
let ws: WebSocket | null = null;
let connected = false;
let messageCallbacks: ((msg: any) => void)[] = [];
let connectionCallbacks: ((connected: boolean) => void)[] = [];
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let currentToken: string | null = null;
let currentFilters: { tenantId?: string; plantId?: string; plcId?: string } = {};

function addUniqueCallback<T extends Function>(arr: T[], cb: T) {
  if (!arr.includes(cb)) arr.push(cb);
}

function buildQuery(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

function sameFilters(a: typeof currentFilters, b: typeof currentFilters) {
  return a.tenantId === b.tenantId && a.plantId === b.plantId && a.plcId === b.plcId;
}

/**
 * Conectar al WebSocket
 */
export async function connect(options: {
  onConnectionChange?: (connected: boolean) => void;
  onMessage?: (msg: any) => void;
  tenantId?: string;
  plantId?: string;
  plcId?: string;
} = {}) {
  // Registrar callbacks del caller
  if (options.onConnectionChange) {
    addUniqueCallback(connectionCallbacks, options.onConnectionChange);
  }
  if (options.onMessage) {
    addUniqueCallback(messageCallbacks, options.onMessage);
  }

  const nextFilters = { tenantId: options.tenantId, plantId: options.plantId, plcId: options.plcId };

  // Si ya está conectado, solo notificar
  if (ws && ws.readyState === WebSocket.OPEN) {
    // Si cambian filtros, reconectar con nueva query
    if (!sameFilters(currentFilters, nextFilters)) {
      internalDisconnect(false);
    } else {
      if (options.onConnectionChange) {
        options.onConnectionChange(true);
      }
      return;
    }
  }

  // Si ya hay una conexión en progreso, esperar
  if (ws && ws.readyState === WebSocket.CONNECTING) {
    return;
  }

  try {
    // Obtener token
    const user = getCurrentUser();
    if (user) {
      currentToken = await user.getIdToken();
    }

    currentFilters = nextFilters;
    const query = buildQuery({
      // IMPORTANT: URLSearchParams ya se encarga del encoding; no doble-encodear el token
      token: currentToken || undefined,
      tenantId: currentFilters.tenantId,
      plantId: currentFilters.plantId,
      plcId: currentFilters.plcId,
    });
    const url = `${WS_URL}/ws${query}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('WebSocket connected');
      connected = true;
      connectionCallbacks.forEach(cb => {
        try { cb(true); } catch (e) { console.error('WS callback error:', e); }
      });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type !== 'ping' && message.type !== 'connected') {
          messageCallbacks.forEach(cb => {
            try { cb(message); } catch (e) { console.error('WS message callback error:', e); }
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      connected = false;
      connectionCallbacks.forEach(cb => {
        try { cb(false); } catch (e) { console.error('WS callback error:', e); }
      });

      // Reconectar después de 5 segundos
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      reconnectTimeout = setTimeout(() => {
        console.log('Attempting to reconnect WebSocket...');
        // Limpiar callbacks antes de reconectar para evitar duplicados
        const savedMessageCb = [...messageCallbacks];
        const savedConnCb = [...connectionCallbacks];
        messageCallbacks = savedMessageCb;
        connectionCallbacks = savedConnCb;
        ws = null;
        connect({
          tenantId: currentFilters.tenantId,
          plantId: currentFilters.plantId,
          plcId: currentFilters.plcId,
        });
      }, 5000);
    };
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
  }
}

/**
 * Desconectar del WebSocket
 */
export function disconnect() {
  internalDisconnect(true);
}

function internalDisconnect(clearCallbacks: boolean) {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (ws) {
    // Remover handlers para evitar reconexión automática
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  
  connected = false;
  currentFilters = {};
  if (clearCallbacks) {
    messageCallbacks = [];
    connectionCallbacks = [];
  }
}

/**
 * Suscribirse a mensajes del WebSocket
 * Retorna una función para desuscribirse
 */
export function onMessage(callback: (msg: any) => void): () => void {
  messageCallbacks.push(callback);
  
  return () => {
    messageCallbacks = messageCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Suscribirse a cambios de conexión
 * Retorna una función para desuscribirse
 */
export function onConnectionChange(callback: (connected: boolean) => void): () => void {
  connectionCallbacks.push(callback);
  
  return () => {
    connectionCallbacks = connectionCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Obtener estado de conexión
 */
export function isConnected(): boolean {
  return connected && ws?.readyState === WebSocket.OPEN;
}

/**
 * Enviar mensaje por WebSocket
 */
export function send(message: any): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
