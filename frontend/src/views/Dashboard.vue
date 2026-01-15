<template>
  <div class="dashboard-container">
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
  </div>
</template>

<script setup>
import { computed } from 'vue';
import GaugeChart from '../components/GaugeChart.vue';
import StatusLight from '../components/StatusLight.vue';

const props = defineProps({
  telemetryEvents: Array,
  currentMetricsValues: Object,
  gaugeMetrics: Array,
  statusMetrics: Array,
  counterMetrics: Array,
});

const lastEventTime = computed(() => {
  if (props.telemetryEvents.length === 0) return '-';
  const lastEvent = props.telemetryEvents[0];
  return formatTime(lastEvent.ts);
});

const activeMachines = computed(() => {
  const machines = new Set();
  props.telemetryEvents.forEach(event => {
    machines.add(event.machineId);
  });
  return machines.size;
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
</script>

<style scoped>
.dashboard-container {
  padding: 1.5rem;
  max-width: 1600px;
  margin: 0 auto;
  padding-bottom: 100px; /* Espacio para el bottom nav */
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

@media (max-width: 768px) {
  .dashboard-container {
    padding: 1rem;
    padding-bottom: 90px;
  }

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
</style>
