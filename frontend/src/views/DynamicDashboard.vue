<template>
  <div class="dashboard-container">
    <!-- Loading State -->
    <div v-if="loading" class="empty-state">
      <div class="empty-state-icon loading-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10" />
        </svg>
      </div>
      <h2 class="empty-state-title">Cargando dashboard</h2>
      <p class="empty-state-subtitle">Obteniendo datos del servidor...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="empty-state">
      <div class="empty-state-icon error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="16" r="0.5" fill="currentColor" />
        </svg>
      </div>
      <h2 class="empty-state-title">No se pudo cargar el dashboard</h2>
      <p class="empty-state-subtitle">{{ error }}</p>
      <p class="empty-state-hint">Verificá que tengas un PLC seleccionado con un dashboard configurado.</p>
    </div>

    <!-- No Dashboard State -->
    <div v-else-if="!dashboard || widgets.length === 0" class="empty-state">
      <div class="empty-state-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </div>
      <h2 class="empty-state-title">Sin dashboard configurado</h2>
      <p class="empty-state-subtitle">Este PLC aún no tiene un dashboard con widgets.</p>
      <p class="empty-state-hint">Contactá al administrador para configurar las mediciones.</p>
    </div>

    <!-- Dashboard Content -->
    <template v-else>
      <header class="dashboard-header">
        <div class="tenant-info" v-if="tenant">
          <img v-if="tenant.icon_url" :src="tenant.icon_url" alt="Tenant icon" class="tenant-icon" />
          <div>
            <h1>{{ dashboard?.name || 'Dashboard' }}</h1>
            <p class="muted">{{ tenant.name }} · {{ plant?.plant_id }} · {{ plc?.plc_thing_name }}</p>
          </div>
        </div>
      </header>

      <div class="widgets-grid">
        <div
          v-for="(widget, index) in visibleWidgets"
          :key="widget.id"
          class="widget-card"
          :class="{
            'no-padding': widget.type === 'status',
            'inner-only': widget.type === 'gauge' || widget.type === 'counter',
          }"
          :style="gridStyle(widget, index)"
        >
          <!-- Gauge/Counter ya dibujan su propio recuadro + título -->
          <div v-if="widget.type !== 'status' && widget.type !== 'gauge' && widget.type !== 'counter'" class="widget-header">
            <span>{{ widget.label }}</span>
            <span class="muted">{{ widget.unit || '' }}</span>
          </div>

          <component
            :is="resolveComponent(widget.type)"
            v-if="resolveComponent(widget.type)"
            :label="widget.label"
            :value="resolveValue(widget)"
            :max="widget.config_json?.max"
            :unit="widget.unit"
            :color="widget.config_json?.color"
          />

          <div v-else class="widget-unknown">
            {{ metricValue(widget.metric_id) }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import GaugeChart from '../components/GaugeChart.vue';
import StatusLight from '../components/StatusLight.vue';
import NumericCounter from '../components/NumericCounter.vue';

const props = defineProps({
  dashboard: Object,
  tenant: Object,
  plant: Object,
  plc: Object,
  widgets: {
    type: Array,
    default: () => [],
  },
  currentValues: {
    type: Object,
    default: () => ({}),
  },
  loading: Boolean,
  error: String,
});

const visibleWidgets = computed(() =>
  props.widgets
    .filter((widget) => widget.is_visible !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
);

const resolveComponent = (type) => {
  if (type === 'gauge') return GaugeChart;
  if (type === 'status') return StatusLight;
  if (type === 'counter') return NumericCounter;
  return null;
};

const metricValue = (metricId) => {
  const entry = props.currentValues?.[metricId];
  if (entry && typeof entry === 'object' && 'value' in entry) {
    return entry.value;
  }
  return entry ?? null;
};

const resolveValue = (widget) => {
  const raw = metricValue(widget.metric_id);
  
  if (widget.type === 'gauge' || widget.type === 'counter') {
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }
  if (widget.type === 'status') {
    // Solo true si es explícitamente true o > 0
    if (raw === null || raw === undefined) return false;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw > 0;
    return false;
  }
  return raw ?? '-';
};

const gridStyle = (widget, index) => {
  const layout = widget.layout_json || widget.layoutJson || {};
  
  // Default sizes based on widget type
  const defaultW = widget.type === 'status' ? 2 : 4;
  const defaultH = widget.type === 'status' ? 2 : 3;
  
  const w = Number.isFinite(layout.w) ? layout.w : defaultW;
  const h = Number.isFinite(layout.h) ? layout.h : defaultH;
  
  // If x and y are defined, use them; otherwise calculate from index
  const gridCols = 12;
  const x = Number.isFinite(layout.x) ? layout.x : (index * w) % gridCols;
  const y = Number.isFinite(layout.y) ? layout.y : Math.floor((index * w) / gridCols) * h;
  
  return {
    gridColumn: `${x + 1} / span ${w}`,
    gridRow: `${y + 1} / span ${h}`,
  };
};
</script>

<style scoped>
.dashboard-container {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
  padding-bottom: 100px;
}

.dashboard-header {
  margin-bottom: 1.5rem;
}

.tenant-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tenant-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  background: #111111;
}

.muted {
  color: #888888;
  font-size: 0.85rem;
}

.widgets-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 70px;
  gap: 1rem;
}

.widget-card {
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 1px solid #222222;
  border-radius: 12px;
  padding: 1rem;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.widget-card.no-padding {
  padding: 0.5rem;
}

/* Para gauge/counter: el componente ya tiene su propio recuadro/título */
.widget-card.inner-only {
  background: transparent;
  border: none;
  padding: 0;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  color: #ffffff;
}

.widget-unknown {
  font-size: 1.4rem;
  font-weight: 600;
  color: #ffffff;
}

/* Empty State - Apple Style */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  padding: 3rem 2rem;
}

.empty-state-icon {
  width: 80px;
  height: 80px;
  background: #1d1d1f;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
  color: #48484a;
}

.empty-state-icon svg {
  width: 40px;
  height: 40px;
}

.empty-state-icon.loading-icon {
  color: #86868b;
}

.empty-state-icon.loading-icon svg {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state-icon.error-icon {
  background: rgba(255, 69, 58, 0.1);
  color: #ff453a;
}

.empty-state-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #f5f5f7;
  margin: 0 0 0.5rem 0;
  letter-spacing: -0.3px;
}

.empty-state-subtitle {
  font-size: 1rem;
  color: #86868b;
  margin: 0 0 1rem 0;
  max-width: 380px;
  line-height: 1.5;
}

.empty-state-hint {
  font-size: 0.85rem;
  color: #48484a;
  margin: 0;
  max-width: 380px;
  line-height: 1.5;
}
</style>
