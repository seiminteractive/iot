import { ref, onUnmounted } from 'vue';
import { getCurrentUser } from '../services/authService';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

export function useWebSocket() {
  const ws = ref(null);
  const connected = ref(false);

  async function connect({ onConnectionChange = null, onMessage = null, token = null } = {}) {
    try {
      let wsToken = token;
      if (!wsToken) {
        const user = getCurrentUser();
        if (user) {
          wsToken = await user.getIdToken();
        }
      }

      const query = wsToken ? `?token=${encodeURIComponent(wsToken)}` : '';
      ws.value = new WebSocket(`${WS_URL}/ws${query}`);

      ws.value.onopen = () => {
        console.log('WebSocket connected');
        connected.value = true;
        if (onConnectionChange) onConnectionChange(true);
      };

      ws.value.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type !== 'ping' && message.type !== 'connected') {
            if (onMessage) onMessage(message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.value.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.value.onclose = () => {
        console.log('WebSocket disconnected');
        connected.value = false;
        if (onConnectionChange) onConnectionChange(false);

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect({ onConnectionChange, onMessage, token: wsToken });
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  function disconnect() {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
  }

  function send(message) {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message));
    }
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    connect,
    disconnect,
    send,
    connected,
  };
}
