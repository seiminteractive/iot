import { ref, onUnmounted } from 'vue';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

export function useWebSocket() {
  const ws = ref(null);
  const connected = ref(false);

  function connect({ onConnectionChange = null, onMessage = null } = {}) {
    try {
      ws.value = new WebSocket(`${WS_URL}/ws`);

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
          connect({ onConnectionChange, onMessage });
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
