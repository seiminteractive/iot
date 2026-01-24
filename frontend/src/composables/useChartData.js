import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import api from '../services/api';
import { onMessage } from '../services/websocket';

/**
 * Composable para manejar datos de gráficos
 * Soporta:
 * - Carga inicial desde API
 * - Auto-refresh cuando llegan datos vía WebSocket
 * - Cálculo automático de rango de tiempo relativo
 * - Polling opcional
 * 
 * @param {Object} config - Configuración del widget
 * @param {string} config.metricId - ID de la métrica
 * @param {string} [config.plcId] - UUID del PLC
 * @param {string} [config.dataSource='aggregated'] - 'realtime' | 'raw' | 'aggregated'
 * @param {Object} [config.timeRange] - Configuración de rango de tiempo
 * @param {string} [config.groupBy='hour'] - Agrupación temporal
 * @param {string} [config.aggregate='avg'] - Función de agregación
 * @param {Object} [config.autoRefresh] - Configuración de auto-refresh
 */
export function useChartData(config) {
  const data = ref({
    categories: [],
    values: [],
    data: [],
    meta: null,
  });
  
  const loading = ref(false);
  const error = ref(null);
  const lastUpdated = ref(null);

  let unsubscribeWs = null;
  let pollingInterval = null;

  /**
   * Calcula las fechas from/to basadas en la configuración de timeRange
   */
  const calculateTimeRange = () => {
    const timeRange = config.timeRange || {};
    const now = new Date();
    let from, to;

    if (timeRange.type === 'absolute' && timeRange.absolute) {
      from = timeRange.absolute.from;
      to = timeRange.absolute.to;
    } else {
      // Relativo (default)
      to = now.toISOString();
      const relative = timeRange.relative || { value: 24, unit: 'hours' };
      const value = relative.value || 24;
      const unit = relative.unit || 'hours';

      const msMultipliers = {
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        weeks: 7 * 24 * 60 * 60 * 1000,
        months: 30 * 24 * 60 * 60 * 1000, // Aproximado
      };

      const ms = msMultipliers[unit] || msMultipliers.hours;
      from = new Date(now.getTime() - value * ms).toISOString();
    }

    return { from, to };
  };

  /**
   * Fetch datos del servidor
   */
  const fetchData = async () => {
    if (!config.metricId) {
      error.value = 'metricId is required';
      return;
    }

    // Si es realtime, no hacemos fetch (los datos vienen por WebSocket)
    if (config.dataSource === 'realtime') {
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const { from, to } = calculateTimeRange();

      const params = {
        metricId: config.metricId,
        plcId: config.plcId,
        source: config.dataSource || 'aggregated',
        from,
        to,
        groupBy: config.groupBy || 'hour',
        aggregate: config.aggregate || 'avg',
        limit: config.limit || 100,
      };

      const response = await api.getChartData(params);
      
      data.value = {
        categories: response.categories || [],
        values: response.values || [],
        data: response.data || [],
        meta: response.meta || null,
      };

      lastUpdated.value = new Date();
    } catch (err) {
      console.error('Error fetching chart data:', err);
      error.value = err.message || 'Failed to fetch data';
    } finally {
      loading.value = false;
    }
  };

  /**
   * Suscribirse a WebSocket para detectar nuevos datos
   */
  const subscribeToWebSocket = () => {
    if (unsubscribeWs) {
      unsubscribeWs();
    }

    const autoRefresh = config.autoRefresh || {};
    
    // Si autoRefresh.onNewData está habilitado, escuchamos WebSocket
    if (autoRefresh.onNewData !== false) {
      unsubscribeWs = onMessage((msg) => {
        // Detectar si el mensaje contiene nuestra métrica
        if (msg.type === 'telemetry' && msg.values) {
          const hasOurMetric = config.metricId in msg.values;
          
          // Opcionalmente filtrar por PLC
          const matchesPlc = !config.plcId || msg.plcThingName === config.plcThingName;
          
          if (hasOurMetric && matchesPlc) {
            // Nuevo dato de nuestra métrica, refrescar
            fetchData();
          }
        }

        // También escuchar eventos de agregación (si los implementamos)
        if (msg.type === 'aggregated_update' && msg.metricId === config.metricId) {
          fetchData();
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

    const autoRefresh = config.autoRefresh || {};
    const pollingSeconds = autoRefresh.pollingSeconds || 0;

    if (pollingSeconds > 0) {
      pollingInterval = setInterval(() => {
        fetchData();
      }, pollingSeconds * 1000);
    }
  };

  /**
   * Refresh manual
   */
  const refresh = () => {
    return fetchData();
  };

  /**
   * Cleanup
   */
  const cleanup = () => {
    if (unsubscribeWs) {
      unsubscribeWs();
      unsubscribeWs = null;
    }
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };

  // Computed para datos formateados
  const chartData = computed(() => ({
    categories: data.value.categories,
    values: data.value.values,
  }));

  const isEmpty = computed(() => data.value.values.length === 0);

  const dataPoints = computed(() => data.value.data);

  // Lifecycle
  onMounted(() => {
    if (config.dataSource !== 'realtime') {
      fetchData();
    }
    subscribeToWebSocket();
    setupPolling();
  });

  onUnmounted(() => {
    cleanup();
  });

  // Watch para recargar cuando cambia la config
  watch(
    () => [
      config.metricId,
      config.plcId,
      config.dataSource,
      config.timeRange,
      config.groupBy,
      config.aggregate,
    ],
    () => {
      if (config.dataSource !== 'realtime') {
        fetchData();
      }
    },
    { deep: true }
  );

  return {
    // Estado
    data,
    loading,
    error,
    lastUpdated,
    
    // Computed
    chartData,
    isEmpty,
    dataPoints,
    
    // Métodos
    refresh,
    cleanup,
  };
}

export default useChartData;
