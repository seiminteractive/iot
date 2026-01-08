<template>
  <div id="app">
    <header class="app-header">
      <div class="header-container">
        <div class="logo-section">
          <img src="./assets/image.png" alt="Granix" class="logo" />
        </div>
        <div class="connection-status">
          <div :class="['status-dot', wsConnected ? 'online' : 'offline']"></div>
          <span class="status-text">{{ wsConnected ? 'Conectado' : 'Desconectado' }}</span>
        </div>
      </div>
    </header>

    <main class="app-main">
      <!-- Product Info -->
      <section class="product-section">
        <div class="product-card">
          <div class="product-label">Producto</div>
          <div class="product-name">Aritos Frutales</div>
        </div>
      </section>

      <!-- Metrics Summary -->
      <section class="summary-section">
        <div class="summary-card">
          <div class="summary-label">Última Actualización</div>
          <div class="summary-value small">{{ lastEventTime }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Dispositivos Activos</div>
          <div class="summary-value">{{ activeMachines }}</div>
        </div>
        <div class="summary-card summary-card-green">
          <div class="summary-label">Productos Realizados</div>
          <div class="summary-value">{{ counterMetrics.find(m => m.id === 'Productos realizados')?.value || 0 }}</div>
        </div>
        <div class="summary-card summary-card-red">
          <div class="summary-label">Productos Rechazados</div>
          <div class="summary-value">{{ counterMetrics.find(m => m.id === 'Productos rechazados')?.value || 0 }}</div>
        </div>
      </section>

      <!-- Measurements Dashboard -->
      <section class="measurements-section">
        <h2 class="section-title">Mediciones en Vivo</h2>
        
        <!-- Gauges -->
        <div v-if="gaugeMetrics.length > 0" class="metrics-group">
          <h3 class="group-title">Medidores</h3>
          <div class="metrics-grid gauges-grid">
            <GaugeChart 
              v-for="metric in gaugeMetrics"
              :key="metric.id"
              :label="formatLabel(metric.id)"
              :value="metric.value"
              :max="metric.max || 100"
              :unit="getGaugeUnit(metric.id)"
            />
          </div>
        </div>

        <!-- Status Lights -->
        <div v-if="statusMetrics.length > 0" class="metrics-group">
          <h3 class="group-title">Estado</h3>
          <div class="metrics-grid status-grid">
            <StatusLight 
              v-for="metric in statusMetrics"
              :key="metric.id"
              :label="formatLabel(metric.id)"
              :value="metric.value"
              :color="metric.color"
            />
          </div>
        </div>

      </section>

    </main>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useWebSocket } from './composables/useWebSocket';
import GaugeChart from './components/GaugeChart.vue';
import StatusLight from './components/StatusLight.vue';
import NumericCounter from './components/NumericCounter.vue';

export default {
  name: 'App',
  components: {
    GaugeChart,
    StatusLight,
    NumericCounter,
  },
  setup() {
    const telemetryEvents = ref([]);
    const currentMetricsValues = ref({});
    const wsConnected = ref(false);
    const showDataStream = ref(false);
    const { connect, disconnect } = useWebSocket();

    // Mapping de IDs a tipos de métricas
    const metricMapping = {
      // Gauges (medidores con aguja)
      'Porcentaje_Lote_Completo': { type: 'gauge', max: 100 },
      'Velocidad_Linea': { type: 'gauge', max: 100 },
      'Eficiencia': { type: 'gauge', max: 100 },
      
      // Status Lights (indicadores de luz) - Orden específico
      'En Produccion': { type: 'status', color: 'green' },
      'Detenida': { type: 'status', color: 'red' },
      'Falta Producto': { type: 'status', color: 'yellow' },
      'En Mantenimiento': { type: 'status', color: 'blue' },
      
      // Numeric Counters (contadores numéricos)
      'Productos rechazados': { type: 'counter', color: 'red' },
      'Productos realizados': { type: 'counter', color: 'green' },
    };

    // Inicializar todas las métricas con valores por defecto
    Object.keys(metricMapping).forEach(key => {
      const config = metricMapping[key];
      if (config.type === 'gauge') {
        currentMetricsValues.value[key] = { value: 0, quality: true, ts: Date.now() };
      } else if (config.type === 'status') {
        currentMetricsValues.value[key] = { value: false, quality: true, ts: Date.now() };
      } else if (config.type === 'counter') {
        currentMetricsValues.value[key] = { value: 0, quality: true, ts: Date.now() };
      }
    });

    const lastEventTime = computed(() => {
      if (telemetryEvents.value.length === 0) return '-';
      const lastEvent = telemetryEvents.value[0];
      return formatTime(lastEvent.ts);
    });

    const activeMachines = computed(() => {
      const machines = new Set();
      telemetryEvents.value.forEach(event => {
        machines.add(event.machineId);
      });
      return machines.size;
    });

    const currentMetrics = computed(() => {
      // Retornar todas las métricas en orden fijo basado en metricMapping
      const metrics = [];
      
      Object.entries(metricMapping).forEach(([key, config]) => {
        const metricValue = currentMetricsValues.value[key];
        if (metricValue !== undefined) {
          metrics.push({
            id: key,
            value: metricValue.value,
            quality: metricValue.quality,
            ts: metricValue.ts,
            config,
          });
        }
      });

      return metrics;
    });

    const gaugeMetrics = computed(() => {
      return currentMetrics.value.filter(metric => metric.config.type === 'gauge').map(metric => ({
        ...metric,
        max: metric.config.max || 100,
      }));
    });

    const statusMetrics = computed(() => {
      return currentMetrics.value.filter(metric => metric.config.type === 'status').map(metric => ({
        ...metric,
        color: metric.config.color || 'yellow',
      }));
    });

    const counterMetrics = computed(() => {
      return currentMetrics.value.filter(metric => metric.config.type === 'counter').map(metric => ({
        ...metric,
        color: metric.config.color || 'green',
      }));
    });

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }

    function formatLabel(id) {
      // Extrae el último segmento del ID (nombre de la variable)
      const parts = id.split('.');
      return parts[parts.length - 1] || id;
    }

    function getGaugeUnit(id) {
      if (id.includes('Porcentaje') || id.includes('Eficiencia')) {
        return '%';
      } else if (id.includes('Velocidad')) {
        return 'mph';
      }
      return '';
    }

    function countValues(values) {
      if (!values || typeof values !== 'object') return 0;
      return Object.keys(values).length;
    }

    function handleNewMessage(msg) {
      if (msg.type === 'telemetry' || msg.type === 'status') {
        // Agregar a stream de datos (solo últimos 100 para visualización)
        telemetryEvents.value.unshift({
          id: `${msg.site}-${msg.machineId}-${msg.ts}`,
          site: msg.site,
          machineId: msg.machineId,
          ts: msg.ts,
          values: msg.values,
        });

        if (telemetryEvents.value.length > 100) {
          telemetryEvents.value = telemetryEvents.value.slice(0, 100);
        }

        // Actualizar valores de métricas
        if (msg.values && typeof msg.values === 'object') {
          Object.entries(msg.values).forEach(([key, value]) => {
            if (value && typeof value === 'object' && 'value' in value) {
              // Buscar si este key coincide con alguna métrica conocida
              Object.keys(metricMapping).forEach(metricKey => {
                if (key.includes(metricKey)) {
                  currentMetricsValues.value[metricKey] = {
                    value: value.value,
                    quality: value.quality,
                    ts: msg.ts,
                  };
                }
              });
            }
          });
        }
      }
    }

    onMounted(() => {
      connect({
        onConnectionChange: (connected) => {
          wsConnected.value = connected;
        },
        onMessage: (msg) => {
          handleNewMessage(msg);
        },
      });
    });

    onUnmounted(() => {
      disconnect();
    });

    return {
      telemetryEvents,
      currentMetricsValues,
      wsConnected,
      lastEventTime,
      activeMachines,
      gaugeMetrics,
      statusMetrics,
      counterMetrics,
      showDataStream,
      formatTime,
      formatLabel,
      getGaugeUnit,
      countValues,
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  background: #000000;
  color: #ffffff;
  line-height: 1.6;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.app-header {
  background: linear-gradient(180deg, #0a0a0a 0%, #000000 100%);
  border-bottom: 1px solid #1a1a1a;
  padding: 1rem;
  sticky: top;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.header-container {
  max-width: 1600px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  width: 15rem;
  height: auto;
  opacity: 0.95;
}

.brand-name {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 8px;
  border: 1px solid #1a1a1a;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.online {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.status-dot.offline {
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.status-text {
  font-size: 0.85rem;
  color: #888888;
}

/* Main Content */
.app-main {
  flex: 1;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Product Section */
.product-section {
  display: flex;
  justify-content: center;
}

.product-card {
  background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
  border: 1px solid #222222;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  transition: all 0.3s ease;
  width: 100%;
  max-width: none;
}

.product-card:hover {
  border-color: #333333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.product-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.product-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.3px;
}

/* Summary Section */
.summary-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.summary-card {
  background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%);
  border: 1px solid #222222;
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
  transition: all 0.3s ease;
}

.summary-card:hover {
  border-color: #333333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.summary-card-green {
  background: linear-gradient(135deg, #0f3b1a 0%, #0a2412 100%);
  border-color: #10b981;
}

.summary-card-green:hover {
  border-color: #059669;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
}

.summary-card-green .summary-value {
  color: #10b981;
}

.summary-card-red {
  background: linear-gradient(135deg, #3b0f0f 0%, #2a0a0a 100%);
  border-color: #ef4444;
}

.summary-card-red:hover {
  border-color: #dc2626;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
}

.summary-card-red .summary-value {
  color: #ef4444;
}

.summary-label {
  font-size: 0.75rem;
  color: #666666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.summary-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #ffffff;
}

.summary-value.small {
  font-size: 1rem;
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Measurements Section */
.measurements-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.5px;
  margin-bottom: 0.25rem;
}

.metrics-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.group-title {
  font-size: 0.85rem;
  color: #888888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.metrics-grid {
  display: grid;
  gap: 1rem;
}

.gauges-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.status-grid {
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}

.counters-grid {
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}

/* Data Stream Section */
.data-stream-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-top: 2rem;
  border-top: 1px solid #1a1a1a;
}

.data-stream-container {
  background: #0a0a0a;
  border: 1px solid #1a1a1a;
  border-radius: 10px;
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: #666666;
  font-size: 0.95rem;
}

.stream-list {
  display: flex;
  flex-direction: column;
}

.stream-item {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #1a1a1a;
  font-size: 0.85rem;
  transition: background 0.2s ease;
}

.stream-item:hover {
  background: #111111;
}

.stream-item:last-child {
  border-bottom: none;
}

.stream-time {
  color: #666666;
  font-family: 'Monaco', 'Courier New', monospace;
  min-width: 80px;
}

.stream-machine {
  background: #1a1a1a;
  color: #a0a0a0;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  min-width: 100px;
  text-align: center;
}

.stream-values {
  color: #888888;
  margin-left: auto;
}

/* Scrollbar Styling */
.data-stream-container::-webkit-scrollbar {
  width: 8px;
}

.data-stream-container::-webkit-scrollbar-track {
  background: #0a0a0a;
}

.data-stream-container::-webkit-scrollbar-thumb {
  background: #333333;
  border-radius: 4px;
}

.data-stream-container::-webkit-scrollbar-thumb:hover {
  background: #444444;
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .product-card {
    padding: 0.75rem 1.5rem;
  }

  .product-name {
    font-size: 1.2rem;
  }

  .status-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .app-header {
    padding: 1rem;
  }

  .logo {
    height: auto;
    width: 10rem;
  }

  .brand-name {
    font-size: 1.1rem;
  }

  .app-main {
    padding: 0.75rem;
    gap: 1.5rem;
  }

  .status-grid {
    grid-template-columns: 1fr;
  }

  .counters-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .summary-value {
    font-size: 1.3rem;
  }

  .metric-card,
  .numeric-counter {
    padding: 0.75rem;
  }

  .metric-value {
    font-size: 1.2rem;
  }
}
</style>
