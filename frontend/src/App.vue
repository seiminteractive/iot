<template>
  <div id="app">
    <header>
      <div class="header-content">
        <h1>Industrial Telemetry System</h1>
        <div class="connection-status">
          <div :class="['status-dot', wsConnected ? 'online' : 'offline']"></div>
          <span class="status-text">{{ wsConnected ? 'Connected' : 'Offline' }}</span>
        </div>
      </div>
    </header>

    <main>
      <!-- Metrics Cards -->
      <section class="metrics-section">
        <div class="metric-card">
          <div class="metric-content">
            <div class="metric-label">Total Events</div>
            <div class="metric-value">{{ telemetryEvents.length }}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-content">
            <div class="metric-label">Active Devices</div>
            <div class="metric-value">{{ machines.length }}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-content">
            <div class="metric-label">Sites</div>
            <div class="metric-value">{{ sites.length }}</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-content">
            <div class="metric-label">Last Event</div>
            <div class="metric-value time">{{ lastEventTime }}</div>
          </div>
        </div>
      </section>

      <!-- Real-time Telemetry Stream -->
      <section class="telemetry-section">
        <div class="section-header">
          <h2>Real-time Data Stream</h2>
          <div class="event-count">{{ telemetryEvents.length }} events</div>
        </div>

        <div v-if="loading" class="telemetry-container empty">
          <p>Loading...</p>
        </div>
        <div v-else-if="telemetryEvents.length === 0" class="telemetry-container empty">
          <p>Waiting for incoming data...</p>
        </div>
        <div v-else class="telemetry-container">
          <div 
            v-for="event in telemetryEvents" 
            :key="event.id"
            class="telemetry-item"
          >
            <div class="item-header">
              <div class="device-info">
                <span class="device-badge">{{ event.site }}</span>
                <span class="machine-badge">{{ event.machineId }}</span>
              </div>
              <span class="timestamp">{{ formatTime(event.ts) }}</span>
            </div>
            <div class="item-data">
              <div v-if="hasValidValues(event.values)" class="values-grid">
                <div v-for="(data, key) in event.values" :key="key" class="value-item">
                  <div class="value-key">{{ key }}</div>
                  <div class="value-display">
                    <div class="value-number">{{ formatValue(data.value !== undefined ? data.value : data) }}</div>
                    <div v-if="data.quality !== undefined" class="value-quality">
                      <span :class="['quality-badge', data.quality ? 'good' : 'bad']">
                        {{ data.quality ? 'Good' : 'Bad' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <pre v-else>{{ JSON.stringify(event.values, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import api from './services/api';
import { useWebSocket } from './composables/useWebSocket';

export default {
  name: 'App',
  setup() {
    const machines = ref([]);
    const sites = ref([]);
    const telemetryEvents = ref([]);
    const loading = ref(true);
    const wsConnected = ref(false);

    const { connect, disconnect, messages } = useWebSocket();
    const intervalId = ref(null);
    const lastProcessedIndex = ref(0);

    const lastEventTime = computed(() => {
      if (telemetryEvents.value.length === 0) return '-';
      const lastEvent = telemetryEvents.value[0];
      return formatTime(lastEvent.ts);
    });

    async function loadMachines() {
      try {
        const data = await api.getMachines();
        machines.value = data;
      } catch (error) {
        console.error('Error loading machines:', error);
      }
    }

    async function loadSites() {
      try {
        const data = await api.getSites();
        sites.value = data;
      } catch (error) {
        console.error('Error loading sites:', error);
      }
    }

    async function loadInitialData() {
      loading.value = true;
      await Promise.all([
        loadMachines(),
        loadSites(),
      ]);
      loading.value = false;
    }

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('es-AR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    }

    function formatValue(value) {
      if (typeof value === 'number') {
        // Si es un decimal, mostrar máximo 2 decimales
        return Number.isInteger(value) ? value : value.toFixed(2);
      }
      return value;
    }

    function hasValidValues(values) {
      if (!values || typeof values !== 'object') return false;
      // Verificar si es el formato de KepServer {key: {value, quality, timestamp}}
      const keys = Object.keys(values);
      if (keys.length === 0) return false;
      
      // Verificar si al menos una propiedad tiene estructura KepServer
      return keys.some(key => {
        const item = values[key];
        return item && typeof item === 'object' && ('value' in item || 'v' in item);
      });
    }

    function handleNewMessage(msg) {
      if (msg.type === 'telemetry' || msg.type === 'status') {
        console.log('📨 New telemetry message:', msg);
        
        // Add to telemetry events
        telemetryEvents.value.unshift({
          id: `${msg.site}-${msg.machineId}-${msg.ts}`,
          site: msg.site,
          machineId: msg.machineId,
          ts: msg.ts,
          values: msg.values,
        });

        // Sin límite - acumular todos los eventos

        // Reload machines to update state
        loadMachines();
      }
    }

    // Watch for new WebSocket messages (en tiempo real)
    watch(
      messages,
      (newMessages) => {
        if (!newMessages || newMessages.length === 0) return;

        // Procesar todos los mensajes nuevos desde el último índice
        for (let i = lastProcessedIndex.value; i < newMessages.length; i++) {
          handleNewMessage(newMessages[i]);
        }
        lastProcessedIndex.value = newMessages.length;
      },
      { deep: true }
    );

    onMounted(async () => {
      await loadInitialData();

      // Connect to WebSocket
      connect((connected) => {
        wsConnected.value = connected;
        console.log('WebSocket connected:', connected);
      });

      // Refresh data periodically
      intervalId.value = setInterval(() => {
        loadMachines();
      }, 30000); // Every 30 seconds
    });

    onUnmounted(() => {
      if (intervalId.value) clearInterval(intervalId.value);
      disconnect();
    });

    return {
      machines,
      sites,
      telemetryEvents,
      loading,
      wsConnected,
      lastEventTime,
      formatTime,
      formatValue,
      hasValidValues,
    };
  },
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  background: #000000;
  color: #ffffff;
  line-height: 1.6;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background: #000000;
  border-bottom: 1px solid #1a1a1a;
  padding: 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.header-content {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.5px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.online {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.status-dot.offline {
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.status-text {
  font-size: 0.9rem;
  color: #888888;
}

main {
  flex: 1;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

.metrics-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.metric-card {
  background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
  border: 1px solid #222222;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: center;
  transition: all 0.3s ease;
}

.metric-card:hover {
  border-color: #333333;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.metric-content {
  width: 100%;
}

.metric-label {
  font-size: 0.85rem;
  color: #888888;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: #ffffff;
}

.metric-value.time {
  font-size: 1.1rem;
  font-family: 'Monaco', 'Courier New', monospace;
}

.telemetry-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header h2 {
  font-size: 1.3rem;
  font-weight: 600;
}

.event-count {
  font-size: 0.9rem;
  color: #666666;
  background: #0a0a0a;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #1a1a1a;
}

.telemetry-container {
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-radius: 12px;
  max-height: 600px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.telemetry-container.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #666666;
  font-size: 1rem;
}

.telemetry-item {
  border-bottom: 1px solid #1a1a1a;
  padding: 1.5rem;
  transition: background 0.2s ease;
  animation: slideIn 0.3s ease-out;
}

.telemetry-item:hover {
  background: #111111;
}

.telemetry-item:last-child {
  border-bottom: none;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.device-info {
  display: flex;
  gap: 0.75rem;
}

.device-badge, .machine-badge {
  font-size: 0.8rem;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.device-badge {
  background: #1a1a1a;
  color: #a0a0a0;
  border: 1px solid #333333;
}

.machine-badge {
  background: #111111;
  color: #888888;
  border: 1px solid #222222;
}

.timestamp {
  font-size: 0.85rem;
  color: #666666;
  font-family: 'Monaco', 'Courier New', monospace;
}

.item-data {
  width: 100%;
}

.values-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.value-item {
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 1px solid #222222;
  border-radius: 10px;
  padding: 1rem;
  transition: all 0.3s ease;
}

.value-item:hover {
  border-color: #333333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  transform: translateY(-2px);
}

.value-key {
  font-size: 0.75rem;
  color: #666666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.75rem;
  font-weight: 500;
}

.value-display {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  justify-content: space-between;
}

.value-number {
  font-size: 1.8rem;
  font-weight: 700;
  color: #ffffff;
  font-family: 'Monaco', 'Courier New', monospace;
  letter-spacing: -0.5px;
}

.value-quality {
  display: flex;
  align-items: center;
}

.quality-badge {
  font-size: 0.65rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

.quality-badge.good {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid #10b981;
}

.quality-badge.bad {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid #ef4444;
}

.item-data pre {
  background: #000000;
  border: 1px solid #1a1a1a;
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.8rem;
  color: #a0a0a0;
  line-height: 1.4;
}

.item-data pre::-webkit-scrollbar {
  height: 6px;
}

.item-data pre::-webkit-scrollbar-track {
  background: #0a0a0a;
}

.item-data pre::-webkit-scrollbar-thumb {
  background: #333333;
  border-radius: 3px;
}

.telemetry-container::-webkit-scrollbar {
  width: 8px;
}

.telemetry-container::-webkit-scrollbar-track {
  background: #0a0a0a;
}

.telemetry-container::-webkit-scrollbar-thumb {
  background: #333333;
  border-radius: 4px;
}

.telemetry-container::-webkit-scrollbar-thumb:hover {
  background: #444444;
}

@media (max-width: 768px) {
  header {
    padding: 1.5rem;
  }

  .header-content {
    flex-direction: column;
    gap: 1rem;
  }

  main {
    padding: 1rem;
  }

  .metrics-section {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .metric-card {
    padding: 1rem;
  }

  .metric-value {
    font-size: 1.5rem;
  }

  .telemetry-container {
    max-height: 400px;
  }
}
</style>
