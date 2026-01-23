import { ref } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';

// Crear una instancia global de WebSocket para AdminPanel
let wsInstance = null;
let messageCallbacks = [];
let connectionCallbacks = [];

export function getWebSocketInstance() {
  if (!wsInstance) {
    wsInstance = useWebSocket();
  }
  return wsInstance;
}

/**
 * Conectar al WebSocket y registrar callbacks
 */
export function connect(options = {}) {
  const ws = getWebSocketInstance();
  
  ws.connect({
    onConnectionChange: (connected) => {
      connectionCallbacks.forEach(cb => cb(connected));
      if (options.onConnectionChange) {
        options.onConnectionChange(connected);
      }
    },
    onMessage: (msg) => {
      messageCallbacks.forEach(cb => cb(msg));
      if (options.onMessage) {
        options.onMessage(msg);
      }
    },
  });
}

/**
 * Desconectar del WebSocket
 */
export function disconnect() {
  const ws = getWebSocketInstance();
  ws.disconnect();
}

/**
 * Suscribirse a mensajes del WebSocket
 * Retorna una función para desuscribirse
 */
export function onMessage(callback) {
  messageCallbacks.push(callback);
  
  // Retornar función para desuscribirse
  return () => {
    messageCallbacks = messageCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Suscribirse a cambios de conexión
 * Retorna una función para desuscribirse
 */
export function onConnectionChange(callback) {
  connectionCallbacks.push(callback);
  
  // Retornar función para desuscribirse
  return () => {
    connectionCallbacks = connectionCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Obtener estado de conexión
 */
export function isConnected() {
  const ws = getWebSocketInstance();
  return ws.connected?.value ?? false;
}

/**
 * Enviar mensaje por WebSocket
 */
export function send(message) {
  const ws = getWebSocketInstance();
  ws.send(message);
}
