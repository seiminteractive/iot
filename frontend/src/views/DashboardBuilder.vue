<template>
  <div class="builder-root">
    <!-- Floating top bar -->
    <div class="builder-topbar">
      <div class="topbar-left">
        <button class="btn" @click="$emit('close')">Volver</button>
        <div class="title">
          <div class="title-main">Editor de Dashboard</div>
          <div class="title-sub muted">
            {{ contextTitle }}
          </div>
        </div>
      </div>

      <div class="topbar-right">
        <button class="btn" @click="togglePanel">{{ panelOpen ? 'Ocultar panel' : 'Mostrar panel' }}</button>
        <button class="btn primary" :disabled="saving" @click="handleSaveAll">
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>

    <!-- Floating side panel -->
    <div class="builder-panel" :class="{ open: panelOpen }">
      <div class="panel-section">
        <div class="panel-title">Dashboard</div>
        <div class="panel-form">
          <input v-model="dashboardDraft.name" placeholder="Nombre del dashboard" />
          <input v-model="dashboardDraft.iconUrl" placeholder="Icon URL (opcional)" />
        </div>
      </div>

      <div class="panel-section">
        <div class="panel-title">Widgets</div>
        <div class="panel-actions">
          <button class="btn primary" @click="startCreateWidget">+ Agregar widget</button>
        </div>

        <div class="widgets-list">
          <div
            v-for="w in widgetsDraft"
            :key="w.id"
            class="widget-pill"
            :class="{ active: selectedWidgetId === w.id }"
          >
            <div class="pill-content" @click="selectWidget(w)">
              <div class="pill-title">{{ w.label || 'Widget' }}</div>
              <div class="pill-sub muted">{{ w.metricId || w.metric_id || '-' }}</div>
            </div>
            <div class="pill-actions">
              <button class="pill-btn" @click="selectWidget(w)" title="Editar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="pill-btn danger" @click="deleteWidget(w.id)" title="Eliminar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-section" v-if="widgetFormVisible">
        <div class="panel-title">{{ editingWidgetId ? 'Editar widget' : 'Nuevo widget' }}</div>
        <form class="panel-form" @submit.prevent="submitWidgetForm">
          <div class="form-field">
            <label>Tipo</label>
            <select v-model="widgetForm.type" required>
              <option value="status">Estado (luz)</option>
              <option value="gauge">Gauge (velocímetro)</option>
              <option value="counter">Contador (número)</option>
              <option value="bar">Gráfico de barras</option>
            </select>
          </div>

          <div class="form-field">
            <label>Variable (metric ID)</label>
            <input v-model="widgetForm.metricId" placeholder="ej: Simulacion.Envasadora-1.Velocidad" required />
          </div>

          <div class="form-field">
            <label>Nombre visible</label>
            <input v-model="widgetForm.label" placeholder="ej: Velocidad de Línea" required />
          </div>

          <div class="form-field" v-if="widgetForm.type === 'gauge'">
            <label>Unidad</label>
            <input v-model="widgetForm.unit" placeholder="ej: pph, %, °C" />
          </div>

          <div class="form-field" v-if="widgetForm.type === 'gauge'">
            <label>Valor máximo</label>
            <input v-model.number="widgetForm.gaugeMax" type="number" placeholder="100" />
          </div>

          <div class="form-field" v-if="widgetForm.type === 'status'">
            <label>Color</label>
            <select v-model="widgetForm.statusColor">
              <option value="green">Verde</option>
              <option value="red">Rojo</option>
              <option value="yellow">Amarillo</option>
              <option value="blue">Azul</option>
            </select>
          </div>

          <!-- Bar Chart Configuration -->
          <template v-if="widgetForm.type === 'bar'">
            <!-- Sección: Fuente de datos -->
            <div class="form-section-title">Fuente de datos</div>
            
            <div class="form-field">
              <label>Origen de datos</label>
              <select v-model="widgetForm.dataSource">
                <option value="realtime">Tiempo real (WebSocket)</option>
                <option value="aggregated">Histórico agregado (DB)</option>
                <option value="raw">Histórico raw (DB)</option>
              </select>
            </div>

            <!-- Configuración de datos históricos -->
            <template v-if="widgetForm.dataSource !== 'realtime'">
              <div class="form-section-title">Rango de tiempo</div>
              
              <div class="form-field">
                <label>Tipo de rango</label>
                <select v-model="widgetForm.timeRangeType">
                  <option value="relative">Relativo (últimas X...)</option>
                  <option value="absolute">Absoluto (desde/hasta)</option>
                </select>
              </div>

              <template v-if="widgetForm.timeRangeType === 'relative'">
                <div class="form-row">
                  <div class="form-field">
                    <label>Últimas</label>
                    <input v-model.number="widgetForm.timeRangeValue" type="number" min="1" placeholder="24" />
                  </div>
                  <div class="form-field">
                    <label>Unidad</label>
                    <select v-model="widgetForm.timeRangeUnit">
                      <option value="minutes">Minutos</option>
                      <option value="hours">Horas</option>
                      <option value="days">Días</option>
                      <option value="weeks">Semanas</option>
                      <option value="months">Meses</option>
                    </select>
                  </div>
                </div>
              </template>

              <template v-if="widgetForm.timeRangeType === 'absolute'">
                <div class="form-field">
                  <label>Desde</label>
                  <input v-model="widgetForm.absoluteFrom" type="datetime-local" />
                </div>
                <div class="form-field">
                  <label>Hasta</label>
                  <input v-model="widgetForm.absoluteTo" type="datetime-local" />
                </div>
              </template>

              <div class="form-section-title">Agrupación</div>
              
              <div class="form-field">
                <label>Agrupar por</label>
                <select v-model="widgetForm.groupBy">
                  <option value="minute">Minuto</option>
                  <option value="hour">Hora</option>
                  <option value="day">Día</option>
                  <option value="week">Semana</option>
                  <option value="month">Mes</option>
                </select>
              </div>

              <div class="form-field">
                <label>Función de agregación</label>
                <select v-model="widgetForm.aggregate">
                  <option value="avg">Promedio</option>
                  <option value="sum">Suma</option>
                  <option value="min">Mínimo</option>
                  <option value="max">Máximo</option>
                  <option value="last">Último valor</option>
                  <option value="count">Conteo</option>
                </select>
              </div>

            </template>

            <!-- Visualización -->
            <div class="form-section-title">Visualización</div>

            <div class="form-field">
              <label>Unidad</label>
              <input v-model="widgetForm.unit" placeholder="ej: kWh, %, unidades" />
            </div>
            
            <div class="form-field">
              <label>Color de barras</label>
              <select v-model="widgetForm.barColor">
                <option value="purple">Violeta</option>
                <option value="blue">Azul</option>
                <option value="green">Verde</option>
                <option value="orange">Naranja</option>
                <option value="red">Rojo</option>
                <option value="cyan">Cyan</option>
                <option value="pink">Rosa</option>
                <option value="yellow">Amarillo</option>
              </select>
            </div>

            <div class="form-field">
              <label>Orientación</label>
              <select v-model="widgetForm.barHorizontal">
                <option :value="false">Vertical</option>
                <option :value="true">Horizontal</option>
              </select>
            </div>

            <div class="form-field">
              <label>Nombre eje X</label>
              <input v-model="widgetForm.barXAxisName" placeholder="ej: Tiempo, Categoría" />
            </div>

            <div class="form-field">
              <label>Nombre eje Y</label>
              <input v-model="widgetForm.barYAxisName" placeholder="ej: Valores, Cantidad" />
            </div>

            <div class="form-field">
              <label>Valor mínimo eje Y</label>
              <input v-model.number="widgetForm.barYMin" type="number" placeholder="Auto" />
            </div>

            <div class="form-field">
              <label>Valor máximo eje Y</label>
              <input v-model.number="widgetForm.barYMax" type="number" placeholder="Auto" />
            </div>

            <div class="form-field toggle-field">
              <label class="toggle-label">
                <input type="checkbox" v-model="widgetForm.barShowLabels" class="toggle-input" />
                <span class="toggle-switch"></span>
                <span class="toggle-text">Mostrar valores sobre barras</span>
              </label>
            </div>

            <div class="form-field toggle-field">
              <label class="toggle-label">
                <input type="checkbox" v-model="widgetForm.barShowGrid" class="toggle-input" />
                <span class="toggle-switch"></span>
                <span class="toggle-text">Mostrar líneas de grilla</span>
              </label>
            </div>

            <div class="form-field toggle-field">
              <label class="toggle-label">
                <input type="checkbox" v-model="widgetForm.barShowTooltip" class="toggle-input" />
                <span class="toggle-switch"></span>
                <span class="toggle-text">Mostrar tooltip al hover</span>
              </label>
            </div>
          </template>

          <div class="panel-actions">
            <button class="btn primary" type="submit">{{ editingWidgetId ? 'Guardar' : 'Crear' }}</button>
            <button class="btn" type="button" @click="cancelWidgetForm">Cancelar</button>
            <button v-if="editingWidgetId" class="btn danger" type="button" @click="deleteWidget(editingWidgetId)">
              Eliminar
            </button>
          </div>
        </form>
      </div>

    </div>

    <!-- Canvas: matches user dashboard proportions -->
    <div class="builder-canvas" :class="{ 'panel-closed': !panelOpen }">
      <div class="dashboard-shell">
        <div class="grid-wrap">
          <div ref="gridRef" class="grid-stack user-grid">
            <div
              v-for="(widget, index) in widgetsDraft"
              :key="widget.id"
              class="grid-stack-item"
              :gs-id="widget.id"
              :gs-x="gridAttrs(widget, index).x"
              :gs-y="gridAttrs(widget, index).y"
              :gs-w="gridAttrs(widget, index).w"
              :gs-h="gridAttrs(widget, index).h"
              :gs-min-w="gridAttrs(widget, index).minW"
              :gs-min-h="gridAttrs(widget, index).minH"
              @mousedown.stop="selectedWidgetId = widget.id"
            >
              <div
                class="grid-stack-item-content widget-card"
                :class="{
                  selected: selectedWidgetId === widget.id,
                  'inner-only': widget.type === 'gauge' || widget.type === 'counter',
                }"
              >

                <component
                  :is="resolveComponent(widget.type)"
                  v-if="resolveComponent(widget.type)"
                  :label="widget.label"
                  :value="sampleValue(widget)"
                  :max="widget.configJson?.max || widget.config_json?.max"
                  :unit="widget.unit"
                  :color="(widget.configJson?.color || widget.config_json?.color)"
                  :config="widget.configJson || widget.config_json"
                />

                <div v-else class="widget-unknown">{{ widget.metricId || widget.metric_id }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { GridStack } from 'gridstack';
// Importar CSS de GridStack acá (no depender de AdminPanel),
// si no, los items quedan sin position/size y se ven "en fila" como en tu screenshot.
import 'gridstack/dist/gridstack.min.css';
import api from '../services/api';
import GaugeChart from '../components/GaugeChart.vue';
import StatusLight from '../components/StatusLight.vue';
import NumericCounter from '../components/NumericCounter.vue';
import BarChartWidget from '../components/BarChartWidget.vue';

const props = defineProps({
  plc: { type: Object, required: true }, // expects { id, plcThingName?, name? }
  tenant: { type: Object, default: null }, // optional context
  plant: { type: Object, default: null }, // optional context
  dashboard: { type: Object, required: true }, // { id, name, iconUrl?, layoutVersion? }
  widgets: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'saved']);

const gridRef = ref(null);
let gridInstance = null;

// Match user dashboard proportions exactly
const gridConfig = {
  cols: 12,
  rowHeight: 70, // matches DynamicDashboard.vue (grid-auto-rows: 70px)
  margin: 16, // roughly 1rem gap (same as DynamicDashboard)
};

const panelOpen = ref(true);
const saving = ref(false);

const dashboardDraft = ref({
  id: props.dashboard.id,
  name: props.dashboard.name || '',
  iconUrl: props.dashboard.iconUrl || props.dashboard.icon_url || '',
  layoutVersion: props.dashboard.layoutVersion || props.dashboard.layout_version || 1,
});

const widgetsDraft = ref(props.widgets.map((w) => ({ ...w })));

watch(
  () => props.widgets,
  async (next) => {
    widgetsDraft.value = next.map((w) => ({ ...w }));
    await initGrid();
  }
);

const contextTitle = computed(() => {
  // Usar nombres amigables (labels) en vez de IDs técnicos
  const tenantName = props.tenant?.name || props.tenant?.slug || '';
  const plantName = props.plant?.name || props.plant?.plantId || props.plant?.plant_id || '';
  const plcName = props.plc?.name || props.plc?.plcThingName || props.plc?.plc_thing_name || '';
  return [tenantName, plantName, plcName].filter(Boolean).join(' - ');
});

const togglePanel = () => {
  panelOpen.value = !panelOpen.value;
};

// Cuando cambia el ancho disponible (panel open/close), GridStack necesita recalcular.
watch(panelOpen, async () => {
  await nextTick();
  try {
    gridInstance?.onParentResize?.();
  } catch (e) {}
});

const resolveComponent = (type) => {
  if (type === 'gauge') return GaugeChart;
  if (type === 'status') return StatusLight;
  if (type === 'counter') return NumericCounter;
  if (type === 'bar') return BarChartWidget;
  return null;
};

const defaultLayoutForType = (type, index = 0) => {
  const gridCols = gridConfig.cols;
  if (type === 'status') {
    const w = 2, h = 2;
    return { x: (index * w) % gridCols, y: Math.floor((index * w) / gridCols) * h, w, h, minW: 2, minH: 2 };
  }
  if (type === 'counter') {
    // Counter puede ser más angosto
    const w = 2, h = 3;
    return { x: (index * w) % gridCols, y: Math.floor((index * w) / gridCols) * h, w, h, minW: 2, minH: 2 };
  }
  if (type === 'bar') {
    // Bar chart necesita más espacio
    const w = 6, h = 4;
    return { x: (index * w) % gridCols, y: Math.floor((index * w) / gridCols) * h, w, h, minW: 4, minH: 3 };
  }
  const w = 4, h = 3;
  return { x: (index * w) % gridCols, y: Math.floor((index * w) / gridCols) * h, w, h, minW: 3, minH: 2 };
};

const gridAttrs = (widget, index) => {
  const layout = widget.layoutJson || widget.layout_json || widget.layoutJson || {};
  const defaults = defaultLayoutForType(widget.type, index);
  const x = Number.isFinite(layout.x) ? layout.x : defaults.x;
  const y = Number.isFinite(layout.y) ? layout.y : defaults.y;
  const w = Number.isFinite(layout.w) ? layout.w : defaults.w;
  const h = Number.isFinite(layout.h) ? layout.h : defaults.h;
  return { x, y, w, h, minW: layout.minW || defaults.minW, minH: layout.minH || defaults.minH };
};

const syncWidgetsFromGrid = (items) => {
  const layoutMap = new Map(
    items.map((item) => {
      const widgetId =
        item.el?.getAttribute('gs-id') ||
        item.el?.getAttribute('data-gs-id') ||
        item.id;
      return [String(widgetId), { x: item.x, y: item.y, w: item.w, h: item.h }];
    })
  );

  widgetsDraft.value = widgetsDraft.value.map((widget) => {
    const item = layoutMap.get(String(widget.id));
    if (!item) return widget;
    return {
      ...widget,
      layoutJson: { ...(widget.layoutJson || widget.layout_json || {}), ...item },
    };
  });
};

const initGrid = async () => {
  await nextTick();
  if (!gridRef.value) return;

  if (gridInstance) {
    try {
      gridInstance.destroy(false);
    } catch (e) {}
    gridInstance = null;
  }

  gridInstance = GridStack.init(
    {
      column: gridConfig.cols,
      margin: gridConfig.margin,
      cellHeight: gridConfig.rowHeight,
      float: true,
      resizable: { handles: 'all' },
      draggable: { handle: '.grid-stack-item-content' },
      disableOneColumnMode: true,
    },
    gridRef.value
  );

  gridInstance.on('change', (event, items) => {
    if (!items) return;
    syncWidgetsFromGrid(items);
  });

  // Asegura que al iniciar ya calcule tamaños/posiciones con el layout actual del DOM.
  // Importante: si el grid se inicializa cuando el contenedor aún no tiene ancho final
  // (por layout/scrollbar/panel), GridStack queda con columnas muy chicas y parece que
  // no respeta x/y/w/h. Forzamos recálculo en RAF + pequeños timeouts.
  const forceResize = () => {
    try {
      gridInstance?.onParentResize?.();
    } catch (e) {}
  };
  requestAnimationFrame(forceResize);
  setTimeout(forceResize, 0);
  setTimeout(forceResize, 50);
};

onMounted(async () => {
  await initGrid();
});

onUnmounted(() => {
  if (gridInstance) {
    try {
      gridInstance.destroy(false);
    } catch (e) {}
    gridInstance = null;
  }
});

// Floating panel: widget form
const selectedWidgetId = ref(null);
const editingWidgetId = ref(null);
const widgetFormVisible = ref(false);

const widgetForm = ref({
  widgetKey: '',
  type: 'status',
  label: '',
  metricId: '',
  unit: '',
  dataType: '',
  sortOrder: 0,
  gaugeMax: 100,
  statusColor: 'green',
  isVisible: true,
  // Bar chart - data source
  dataSource: 'aggregated',
  timeRangeType: 'relative',
  timeRangeValue: 24,
  timeRangeUnit: 'hours',
  groupBy: 'hour',
  aggregate: 'avg',
  // Bar chart - visualization
  barColor: 'blue',
  barHorizontal: false,
  barXAxisName: '',
  barYAxisName: '',
  barYMin: null,
  barYMax: null,
  barShowLabels: false,
  barShowGrid: true,
  barShowTooltip: true,
  // Rango absoluto
  absoluteFrom: '',
  absoluteTo: '',
});

const selectWidget = (w) => {
  selectedWidgetId.value = w.id;
  editingWidgetId.value = w.id;
  widgetFormVisible.value = true;

  const cfg = w.configJson || w.config_json || {};
  
  const timeRange = cfg.timeRange || {};
  const autoRefresh = cfg.autoRefresh || {};
  
  widgetForm.value = {
    widgetKey: w.widgetKey || w.widget_key || '',
    type: w.type,
    label: w.label || '',
    metricId: w.metricId || w.metric_id || '',
    unit: w.unit || '',
    dataType: w.dataType || w.data_type || '',
    sortOrder: typeof w.sortOrder === 'number' ? w.sortOrder : (w.sort_order || 0),
    gaugeMax: cfg.max || 100,
    statusColor: cfg.color || 'green',
    isVisible: w.isVisible !== false && w.is_visible !== false,
    // Bar chart - data source
    dataSource: cfg.dataSource || 'aggregated',
    timeRangeType: timeRange.type || 'relative',
    timeRangeValue: timeRange.relative?.value || 24,
    timeRangeUnit: timeRange.relative?.unit || 'hours',
    groupBy: cfg.groupBy || 'hour',
    aggregate: cfg.aggregate || 'avg',
    // Bar chart - visualization
    barColor: cfg.color || 'blue',
    barHorizontal: cfg.horizontal || false,
    barXAxisName: cfg.xAxisName || '',
    barYAxisName: cfg.yAxisName || '',
    barYMin: cfg.yAxisMin ?? null,
    barYMax: cfg.yAxisMax ?? null,
    barShowLabels: cfg.showBarLabels || false,
    barShowGrid: cfg.showGridLines !== false,
    barShowTooltip: cfg.showTooltip !== false,
    // Rango absoluto
    absoluteFrom: timeRange.absolute?.from || '',
    absoluteTo: timeRange.absolute?.to || '',
  };
};

const startCreateWidget = () => {
  editingWidgetId.value = null;
  widgetFormVisible.value = true;
  widgetForm.value = {
    widgetKey: '',
    type: 'status',
    label: '',
    metricId: '',
    unit: '',
    dataType: '',
    sortOrder: widgetsDraft.value.length,
    gaugeMax: 100,
    statusColor: 'green',
    isVisible: true,
    // Bar chart - data source defaults
    dataSource: 'aggregated',
    timeRangeType: 'relative',
    timeRangeValue: 24,
    timeRangeUnit: 'hours',
    groupBy: 'hour',
    aggregate: 'avg',
    // Bar chart - visualization defaults
    barColor: 'blue',
    barHorizontal: false,
    barXAxisName: '',
    barYAxisName: '',
    barYMin: null,
    barYMax: null,
    barShowLabels: false,
    barShowGrid: true,
    barShowTooltip: true,
    // Rango absoluto
    absoluteFrom: '',
    absoluteTo: '',
  };
};

const cancelWidgetForm = () => {
  widgetFormVisible.value = false;
  editingWidgetId.value = null;
};

const buildConfigJson = () => {
  if (widgetForm.value.type === 'status') return { color: widgetForm.value.statusColor || 'green' };
  if (widgetForm.value.type === 'gauge') return { max: Number(widgetForm.value.gaugeMax) || 100 };
  if (widgetForm.value.type === 'bar') {
    const timeRange = {
      type: widgetForm.value.timeRangeType || 'relative',
      relative: {
        value: widgetForm.value.timeRangeValue || 24,
        unit: widgetForm.value.timeRangeUnit || 'hours',
      },
      absolute: {
        from: widgetForm.value.absoluteFrom || null,
        to: widgetForm.value.absoluteTo || null,
      },
    };
    return {
      // Data source configuration
      dataSource: widgetForm.value.dataSource || 'aggregated',
      timeRange,
      groupBy: widgetForm.value.groupBy || 'hour',
      aggregate: widgetForm.value.aggregate || 'avg',
      // Visualization configuration
      color: widgetForm.value.barColor || 'blue',
      horizontal: widgetForm.value.barHorizontal || false,
      xAxisName: widgetForm.value.barXAxisName || '',
      yAxisName: widgetForm.value.barYAxisName || '',
      yAxisMin: widgetForm.value.barYMin ?? undefined,
      yAxisMax: widgetForm.value.barYMax ?? undefined,
      showBarLabels: widgetForm.value.barShowLabels || false,
      showGridLines: widgetForm.value.barShowGrid !== false,
      showTooltip: widgetForm.value.barShowTooltip !== false,
    };
  }
  return {};
};

const submitWidgetForm = async () => {
  const dashboardId = dashboardDraft.value.id;
  if (!dashboardId) return;

  const payload = {
    widgetKey: widgetForm.value.widgetKey || '',
    type: widgetForm.value.type,
    label: widgetForm.value.label,
    metricId: widgetForm.value.metricId,
    unit: widgetForm.value.unit || null,
    dataType: widgetForm.value.dataType || null,
    sortOrder: Number(widgetForm.value.sortOrder) || 0,
    configJson: buildConfigJson(),
    layoutJson:
      editingWidgetId.value
        ? (widgetsDraft.value.find((w) => w.id === editingWidgetId.value)?.layoutJson || defaultLayoutForType(widgetForm.value.type, 0))
        : defaultLayoutForType(widgetForm.value.type, widgetsDraft.value.length),
    isVisible: widgetForm.value.isVisible,
  };

  if (editingWidgetId.value) {
    const updated = await api.updateDashboardWidget(editingWidgetId.value, payload);
    widgetsDraft.value = widgetsDraft.value.map((w) => (w.id === updated.id ? updated : w));
  } else {
    const created = await api.createDashboardWidget(dashboardId, payload);
    widgetsDraft.value = [...widgetsDraft.value, created];
  }

  await initGrid();
  widgetFormVisible.value = false;
  editingWidgetId.value = null;
};

const deleteWidget = async (widgetId) => {
  await api.deleteDashboardWidget(widgetId);
  widgetsDraft.value = widgetsDraft.value.filter((w) => w.id !== widgetId);
  selectedWidgetId.value = null;
  widgetFormVisible.value = false;
  editingWidgetId.value = null;
  await initGrid();
};

// Save
const computeSortOrder = (widgetsList) => {
  // Prefer layout position (y then x) for deterministic ordering
  const withPos = widgetsList.map((w, idx) => {
    const layout = w.layoutJson || w.layout_json || {};
    const x = Number.isFinite(layout.x) ? layout.x : 0;
    const y = Number.isFinite(layout.y) ? layout.y : 0;
    return { w, x, y, idx };
  });
  withPos.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.idx - b.idx));
  return withPos.map((it, i) => ({ id: it.w.id, sortOrder: i }));
};

const handleSaveAll = async () => {
  saving.value = true;
  try {
    // Save dashboard meta
    await api.updateDashboard(dashboardDraft.value.id, {
      name: dashboardDraft.value.name,
      iconUrl: dashboardDraft.value.iconUrl || null,
      layoutVersion: dashboardDraft.value.layoutVersion,
    });

    const sortOrders = computeSortOrder(widgetsDraft.value);
    const sortOrderMap = new Map(sortOrders.map((s) => [s.id, s.sortOrder]));

    // Persist all widgets (x/y/w/h + sortOrder + config if changed locally)
    await Promise.all(
      widgetsDraft.value.map((w) => {
        const layout = w.layoutJson || w.layout_json || {};
        return api.updateDashboardWidget(w.id, {
          sortOrder: sortOrderMap.get(w.id) ?? (w.sortOrder || w.sort_order || 0),
          layoutJson: {
            ...(layout || {}),
            x: layout.x ?? 0,
            y: layout.y ?? 0,
            w: layout.w ?? 2,
            h: layout.h ?? 2,
          },
        });
      })
    );

    emit('saved');
  } finally {
    saving.value = false;
  }
};

const sampleValue = (widget) => {
  if (widget.type === 'status') return true;
  if (widget.type === 'gauge') return Number(widget.configJson?.max || widget.config_json?.max || 100) * 0.6;
  if (widget.type === 'counter') return 42;
  if (widget.type === 'bar') {
    const cfg = widget.configJson || widget.config_json || {};
    const categories = cfg.categories || ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
    return categories.map((name, i) => ({
      name,
      value: Math.round(20 + Math.random() * 80),
    }));
  }
  return 0;
};
</script>

<style scoped>
.builder-root {
  position: fixed;
  inset: 0;
  background: #000;
  color: #fff;
  z-index: 9999;
}

.builder-topbar {
  position: fixed;
  top: 12px;
  left: 12px;
  right: 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid #1a1a1a;
  border-radius: 14px;
  padding: 12px;
  backdrop-filter: blur(10px);
  z-index: 2;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-main {
  font-weight: 700;
}

.title-sub {
  font-size: 0.85rem;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.builder-panel {
  position: fixed;
  top: 84px;
  right: 12px;
  bottom: 12px;
  width: 380px;
  background: rgba(10, 10, 10, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 12px;
  overflow: auto;
  backdrop-filter: blur(10px);
  transform: translateX(0);
  transition: transform 0.2s ease;
  z-index: 4;
}

.builder-panel:not(.open) {
  transform: translateX(400px);
}

.panel-section {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.25);
  margin-bottom: 12px;
  overflow: hidden;
}

.panel-title {
  font-weight: 700;
  margin-bottom: 8px;
}

.panel-form {
  display: grid;
  gap: 8px;
}

.panel-form input,
.panel-form select {
  border: 1px solid rgba(255, 255, 255, 0.10);
  padding: 0.65rem 0.8rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

.panel-form input:focus,
.panel-form select:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-field label {
  font-size: 0.75rem;
  color: #888;
  font-weight: 500;
}

.form-section-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #f5f5f7;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.form-section-title:first-of-type {
  border-top: none;
  margin-top: 0;
  padding-top: 0;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.panel-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.widgets-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  overflow: hidden;
}

.widget-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  transition: all 0.15s ease;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
}

.widget-pill:hover {
  background: rgba(255, 255, 255, 0.06);
}

.widget-pill.active {
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.pill-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.pill-title {
  font-weight: 600;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill-sub {
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pill-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pill-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.pill-btn.danger:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #ef4444;
}

.builder-canvas {
  position: absolute;
  top: 84px;
  left: 12px;
  right: 12px; /* El panel ahora es overlay, no empuja el canvas */
  bottom: 0;
  overflow-y: auto;
  overflow-x: hidden;
  transition: right 0.2s ease;
}

.builder-canvas.panel-closed {
  right: 12px;
}

.dashboard-shell {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.5rem;
  padding-bottom: 100px; /* Extra space for scrolling */
}

.muted {
  color: #888;
}

.grid-wrap {
  /* Let GridStack manage its own height */
  width: 100%;
}

.user-grid {
  background: transparent;
  min-height: 600px;
  width: 100%;
}

/* Asegurar que el contenedor de GridStack ocupe el ancho disponible */
.grid-stack {
  width: 100%;
}

.widget-card {
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 1px solid #222222;
  border-radius: 12px;
  padding: 1rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

/* Para gauge/counter: el componente ya dibuja su propio recuadro y título */
.widget-card.inner-only {
  background: transparent;
  border: none;
  padding: 0;
}

/* Match status widget style from DynamicDashboard */
.widget-card:has(.status-light-container) {
  padding: 0.5rem;
  justify-content: center;
  align-items: center;
}

.widget-card.selected {
  border-color: rgba(138, 43, 226, 0.9);
  box-shadow: 0 0 0 1px rgba(138, 43, 226, 0.35);
}

/* Mantener highlight aunque no haya borde (inner-only) */
.widget-card.inner-only.selected {
  outline: 2px solid rgba(138, 43, 226, 0.65);
  outline-offset: 2px;
}

.widget-unknown {
  color: #fff;
  font-weight: 700;
}

.btn {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.25);
  color: #ffffff;
  padding: 0.55rem 0.9rem;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.22);
}

.btn.primary {
  background: #ffffff;
  color: #000000;
  border-color: #ffffff;
}

.btn.danger {
  border-color: rgba(239, 68, 68, 0.6);
  color: #ef4444;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.row2 {
  display: grid;
  gap: 8px;
}

@media (max-width: 980px) {
  .builder-panel {
    width: 320px;
  }
}

/* Toggle field styles */
.toggle-field {
  padding: 8px 0;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  display: none;
}

.toggle-switch {
  position: relative;
  width: 40px;
  height: 22px;
  background: #333;
  border-radius: 11px;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  background: #888;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.toggle-input:checked + .toggle-switch {
  background: #10b981;
}

.toggle-input:checked + .toggle-switch::after {
  left: 21px;
  background: #fff;
}

.toggle-text {
  font-size: 0.85rem;
  color: #ccc;
}
</style>

