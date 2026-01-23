<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <div class="tenant-info" v-if="tenant">
        <img v-if="tenant.icon_url" :src="tenant.icon_url" alt="Tenant icon" class="tenant-icon" />
        <div>
          <h1>{{ dashboard?.name || 'Dashboard' }}</h1>
          <p class="muted">{{ tenant.name }} · {{ plant?.plant_id }} · {{ plc?.plc_thing_name }}</p>
        </div>
      </div>
    </header>

    <div v-if="loading" class="state-message">Cargando dashboard...</div>
    <div v-else-if="error" class="state-message error">{{ error }}</div>

    <div v-else class="widgets-grid">
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

.state-message {
  padding: 1rem;
  border-radius: 12px;
  background: #0f0f0f;
  border: 1px solid #222222;
  color: #cccccc;
  text-align: center;
}

.state-message.error {
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}
</style>
