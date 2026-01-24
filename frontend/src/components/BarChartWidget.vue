<template>
  <div class="bar-chart-container">
    <div class="bar-chart-header">
      <div class="bar-chart-title">{{ formatTitle(label) }}</div>
      <div class="bar-chart-status">
        <span v-if="isHistorical && chartLoading" class="status-loading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10" />
          </svg>
        </span>
        <span v-if="isHistorical && lastUpdated" class="status-time">{{ formatLastUpdated }}</span>
      </div>
    </div>
    <div v-if="isHistorical && chartError" class="chart-error">
      <span>{{ chartError }}</span>
      <button @click="refreshData" class="retry-btn">Reintentar</button>
    </div>
    <div v-else class="chart-scroll-wrapper">
      <VChart :option="chartOption" autoresize class="bar-chart" />
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { 
  GridComponent, 
  TooltipComponent, 
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import api from '../services/api';
import { onMessage } from '../services/websocket';

use([BarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);

export default {
  name: 'BarChartWidget',
  components: {
    VChart,
  },
  props: {
    label: {
      type: String,
      required: true,
    },
    // Datos del gráfico - para modo realtime
    value: {
      type: [Array, Object, Number],
      default: () => [],
    },
    // Configuración completa del gráfico
    config: {
      type: Object,
      default: () => ({}),
    },
    unit: {
      type: String,
      default: '',
    },
    // ID de la métrica (para fetch de datos históricos)
    metricId: {
      type: String,
      default: '',
    },
    // ID del PLC (para filtrar datos)
    plcId: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    // Estado para datos históricos
    const historicalData = ref({ categories: [], values: [] });
    const chartLoading = ref(false);
    const chartError = ref(null);
    const lastUpdated = ref(null);
    let unsubscribeWs = null;
    let pollingInterval = null;
    let debounceTimeout = null;
    
    // Debounce para evitar múltiples requests cuando llegan muchos datos seguidos
    const DEBOUNCE_MS = 2000; // Esperar 2 segundos de "silencio" antes de refrescar
    let refreshQueued = false;

    // Determinar si usamos datos históricos o realtime
    const isHistorical = computed(() => {
      const ds = props.config?.dataSource;
      return ds === 'raw' || ds === 'aggregated';
    });

    function formatTitle(text) {
      if (!text) return '';
      return text
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    const formatLastUpdated = computed(() => {
      if (!lastUpdated.value) return '';
      const now = new Date();
      const diff = Math.floor((now - lastUpdated.value) / 1000);
      if (diff < 60) return `hace ${diff}s`;
      if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
      return lastUpdated.value.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    });

    /**
     * Calcular rango de tiempo desde la config
     */
    const calculateTimeRange = () => {
      const cfg = props.config || {};
      const timeRange = cfg.timeRange || {};
      const now = new Date();

      if (timeRange.type === 'absolute' && timeRange.absolute) {
        return {
          from: timeRange.absolute.from,
          to: timeRange.absolute.to,
        };
      }

      // Relativo (default)
      const relative = timeRange.relative || { value: 24, unit: 'hours' };
      const value = relative.value || 24;
      const unit = relative.unit || 'hours';

      const msMultipliers = {
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        weeks: 7 * 24 * 60 * 60 * 1000,
        months: 30 * 24 * 60 * 60 * 1000,
      };

      const ms = msMultipliers[unit] || msMultipliers.hours;
      return {
        from: new Date(now.getTime() - value * ms).toISOString(),
        to: now.toISOString(),
      };
    };

    /**
     * Fetch datos históricos desde la API
     */
    const fetchHistoricalData = async () => {
      const cfg = props.config || {};
      const metricId = props.metricId || cfg.metricId;
      
      if (!metricId) {
        chartError.value = 'No se especificó métrica';
        return;
      }

      // Si ya estamos cargando, encolamos un refresh (coalescing)
      if (chartLoading.value) {
        refreshQueued = true;
        return;
      }

      chartLoading.value = true;
      chartError.value = null;

      try {
        const { from, to } = calculateTimeRange();
        
        const params = {
          metricId,
          plcId: props.plcId || cfg.plcId,
          source: cfg.dataSource || 'aggregated',
          from,
          to,
          groupBy: cfg.groupBy || 'hour',
          aggregate: cfg.aggregate || 'avg',
          limit: cfg.limit || 100,
        };

        const response = await api.getChartData(params);
        
        historicalData.value = {
          categories: response.categories || [],
          values: response.values || [],
        };

        lastUpdated.value = new Date();
      } catch (err) {
        console.error('Error fetching chart data:', err);
        chartError.value = err.response?.data?.error || 'Error al cargar datos';
      } finally {
        chartLoading.value = false;
        // Si durante el fetch se pidió otro refresh, ejecutarlo una vez (debounced)
        if (refreshQueued) {
          refreshQueued = false;
          scheduleRefresh();
        }
      }
    };

    const refreshData = () => {
      if (isHistorical.value) {
        scheduleRefresh();
      }
    };

    /**
     * Debounce/coalesce de refresh para evitar N requests por segundo.
     */
    const scheduleRefresh = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        debounceTimeout = null;
        fetchHistoricalData();
      }, DEBOUNCE_MS);
    };

    /**
     * Suscribirse a WebSocket para auto-refresh
     */
    const setupWebSocketSubscription = () => {
      if (unsubscribeWs) {
        unsubscribeWs();
        unsubscribeWs = null;
      }

      const cfg = props.config || {};
      const autoRefresh = cfg.autoRefresh || {};
      
      if (isHistorical.value && autoRefresh.onNewData !== false) {
        const metricId = props.metricId || cfg.metricId;
        const dataSource = cfg.dataSource || 'aggregated';
        const plcId = props.plcId || cfg.plcId;
        
        unsubscribeWs = onMessage((msg) => {
          // Para histórico agregado, refrescar SOLO con update agregado.
          if (dataSource === 'aggregated') {
            if (msg.type === 'aggregated_update') {
              if (metricId && msg.metricId !== metricId) return;
              if (plcId && msg.plcId && msg.plcId !== plcId) return;
              scheduleRefresh();
              return;
            }
            return;
          }

          // Para raw histórico, refrescar cuando llega telemetry de esa métrica
          if (dataSource === 'raw') {
            if (msg.type !== 'telemetry') return;
            if (!msg.values || !metricId || !(metricId in msg.values)) return;
            scheduleRefresh();
          }
        });
      }
    };

    /**
     * Configurar polling opcional
     */
    const setupPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }

      const cfg = props.config || {};
      const autoRefresh = cfg.autoRefresh || {};
      const pollingSeconds = autoRefresh.pollingSeconds || 0;

      if (isHistorical.value && pollingSeconds > 0) {
        pollingInterval = setInterval(fetchHistoricalData, pollingSeconds * 1000);
      }
    };

    // Parsear datos del gráfico (realtime o histórico)
    const parseChartData = () => {
      const cfg = props.config || {};
      
      // Si es histórico, usar datos del API
      if (isHistorical.value) {
        return historicalData.value;
      }
      
      // Modo realtime: usar prop value
      // Si value es un número, crear un simple bar chart con ese valor
      if (typeof props.value === 'number') {
        return {
          categories: [props.label],
          values: [props.value],
        };
      }
      
      // Si value es un array de números
      if (Array.isArray(props.value) && props.value.every(v => typeof v === 'number')) {
        const categories = cfg.categories || props.value.map((_, i) => `Item ${i + 1}`);
        return {
          categories,
          values: props.value,
        };
      }
      
      // Si value es un array de objetos {name, value}
      if (Array.isArray(props.value) && props.value.length > 0 && typeof props.value[0] === 'object') {
        return {
          categories: props.value.map(item => item.name || item.category || item.label || 'N/A'),
          values: props.value.map(item => item.value || item.v || 0),
        };
      }
      
      // Si value es un objeto con categories y values
      if (props.value && typeof props.value === 'object' && !Array.isArray(props.value)) {
        return {
          categories: props.value.categories || [],
          values: props.value.values || [],
        };
      }
      
      // Default: datos vacíos
      return {
        categories: cfg.categories || [],
        values: [],
      };
    };

    // Lifecycle
    onMounted(() => {
      if (isHistorical.value) {
        fetchHistoricalData();
        setupWebSocketSubscription();
        setupPolling();
      }
    });

    onUnmounted(() => {
      if (unsubscribeWs) {
        unsubscribeWs();
      }
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
    });

    // Watch para recargar cuando cambia config
    watch(
      () => [props.config, props.metricId, props.plcId],
      () => {
        if (isHistorical.value) {
          fetchHistoricalData();
          setupWebSocketSubscription();
          setupPolling();
        }
      },
      { deep: true }
    );

    const chartOption = computed(() => {
      const cfg = props.config || {};
      const data = parseChartData();
      
      // Colores predefinidos o personalizado
      const colorPalette = {
        purple: '#7c3aed',
        blue: '#3b82f6',
        green: '#22c55e',
        orange: '#f97316',
        red: '#ef4444',
        cyan: '#06b6d4',
        pink: '#ec4899',
        yellow: '#eab308',
      };
      
      const barColor = colorPalette[cfg.color] || cfg.color || '#7c3aed';
      
      // Configuración del eje X
      const xAxisConfig = {
        type: cfg.xAxisType || 'category',
        data: data.categories,
        name: cfg.xAxisName || '',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          color: '#888888',
          fontSize: 12,
        },
        axisLine: {
          show: cfg.showAxisLine !== false,
          lineStyle: {
            color: '#333333',
          },
        },
        axisTick: {
          show: cfg.showAxisTick !== false,
          alignWithLabel: true,
          lineStyle: {
            color: '#333333',
          },
        },
        axisLabel: {
          color: '#888888',
          fontSize: cfg.xAxisFontSize || 11,
          rotate: cfg.xAxisRotate || 0,
          interval: cfg.xAxisInterval ?? 'auto',
        },
        splitLine: {
          show: false,
        },
      };
      
      // Configuración del eje Y
      const yAxisConfig = {
        type: cfg.yAxisType || 'value',
        name: cfg.yAxisName || (props.unit ? `(${props.unit})` : ''),
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          color: '#888888',
          fontSize: 12,
        },
        min: cfg.yAxisMin ?? undefined,
        max: cfg.yAxisMax ?? undefined,
        axisLine: {
          show: cfg.showAxisLine !== false,
          lineStyle: {
            color: '#333333',
          },
        },
        axisTick: {
          show: cfg.showAxisTick !== false,
          lineStyle: {
            color: '#333333',
          },
        },
        axisLabel: {
          color: '#888888',
          fontSize: cfg.yAxisFontSize || 11,
          formatter: (value) => {
            if (Math.abs(value) >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (Math.abs(value) >= 1000) return (value / 1000).toFixed(1) + 'K';
            return value;
          },
        },
        splitLine: {
          show: cfg.showGridLines !== false,
          lineStyle: {
            color: '#222222',
            type: 'dashed',
          },
        },
      };
      
      // Configuración de la serie de barras
      const seriesConfig = {
        type: 'bar',
        name: props.label,
        data: data.values,
        barWidth: cfg.barWidth || '60%',
        barMaxWidth: cfg.barMaxWidth || 50,
        barMinWidth: cfg.barMinWidth || undefined,
        barGap: cfg.barGap || '30%',
        itemStyle: {
          color: barColor,
          borderRadius: cfg.borderRadius ?? [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.3)',
          },
        },
        label: {
          show: cfg.showBarLabels || false,
          position: cfg.barLabelPosition || 'top',
          color: '#ffffff',
          fontSize: 10,
          formatter: (params) => {
            const val = params.value;
            if (props.unit) return `${val}${props.unit}`;
            return val;
          },
        },
        showBackground: cfg.showBackground || false,
        backgroundStyle: {
          color: 'rgba(255, 255, 255, 0.05)',
          borderRadius: cfg.borderRadius ?? [4, 4, 0, 0],
        },
      };
      
      // Opción completa del gráfico
      const option = {
        backgroundColor: 'transparent',
        grid: {
          left: cfg.gridLeft || 50,
          right: cfg.gridRight || 20,
          top: cfg.gridTop || 30,
          bottom: cfg.gridBottom || 40,
          containLabel: cfg.containLabel ?? false,
        },
        tooltip: {
          show: cfg.showTooltip !== false,
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          borderColor: '#333333',
          borderWidth: 1,
          textStyle: {
            color: '#ffffff',
            fontSize: 12,
          },
          formatter: (params) => {
            const item = params[0];
            const val = item.value;
            const unit = props.unit ? ` ${props.unit}` : '';
            return `<strong>${item.name}</strong><br/>${val}${unit}`;
          },
        },
        legend: {
          show: cfg.showLegend || false,
          textStyle: {
            color: '#888888',
          },
          top: 0,
        },
        xAxis: cfg.horizontal ? yAxisConfig : xAxisConfig,
        yAxis: cfg.horizontal ? xAxisConfig : yAxisConfig,
        series: [seriesConfig],
        animation: cfg.animation !== false,
        animationDuration: cfg.animationDuration || 500,
        animationEasing: cfg.animationEasing || 'cubicOut',
      };
      
      // Data zoom si está habilitado
      if (cfg.enableZoom) {
        option.dataZoom = [
          {
            type: 'inside',
            start: cfg.zoomStart || 0,
            end: cfg.zoomEnd || 100,
          },
          {
            type: 'slider',
            show: cfg.showZoomSlider || false,
            height: 20,
            bottom: 5,
            borderColor: '#333333',
            backgroundColor: '#1a1a1a',
            fillerColor: 'rgba(124, 58, 237, 0.3)',
            handleStyle: {
              color: '#7c3aed',
            },
            textStyle: {
              color: '#888888',
            },
          },
        ];
      }
      
      return option;
    });

    return {
      chartOption,
      formatTitle,
      isHistorical,
      chartLoading,
      chartError,
      lastUpdated,
      formatLastUpdated,
      refreshData,
    };
  },
};
</script>

<style scoped>
.bar-chart-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 1px solid #222222;
  border-radius: 12px;
  padding: 1rem;
  transition: all 0.3s ease;
}

.bar-chart-container:hover {
  border-color: #333333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.bar-chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.bar-chart-title {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.3px;
  text-align: left;
}

.bar-chart-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-loading svg {
  animation: spin 1s linear infinite;
  color: #888888;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-time {
  font-size: 0.7rem;
  color: #555555;
}

.chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 0.75rem;
  color: #888888;
  font-size: 0.85rem;
}

.retry-btn {
  padding: 0.4rem 0.8rem;
  background: rgba(124, 58, 237, 0.2);
  border: 1px solid rgba(124, 58, 237, 0.4);
  border-radius: 6px;
  color: #a78bfa;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: rgba(124, 58, 237, 0.3);
  border-color: rgba(124, 58, 237, 0.6);
}

/* Wrapper para scroll horizontal en mobile */
.chart-scroll-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  min-width: 0; /* Crucial: permite que el flex child se encoja */
  width: 100%;
}

.bar-chart {
  height: 100%;
  width: 100%;
  min-height: 200px;
}

@media (max-width: 640px) {
  .bar-chart-container {
    padding: 0.75rem;
    min-width: 0; /* Evita que el contenedor empuje el ancho */
    max-width: 100%; /* Limita al ancho del padre */
    overflow: hidden; /* Contiene el overflow */
  }
  
  .bar-chart-title {
    font-size: 0.9rem;
  }
  
  .status-time {
    display: none;
  }
  
  .chart-scroll-wrapper {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    max-width: 100%;
  }
  
  .bar-chart {
    min-width: 500px;
    width: 500px; /* Fuerza el ancho para el scroll */
  }
}
</style>
