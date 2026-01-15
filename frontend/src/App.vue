<template>
  <div id="app">
    <div v-if="!isAuthReady" class="auth-loading">
      Verificando sesión...
    </div>

    <!-- Login Screen -->
    <Login v-else-if="!isAuthenticated" @login-success="handleLoginSuccess" />

    <!-- Main App (Protected) -->
    <div v-else class="main-app">
      <header class="app-header">
        <div class="header-container">
          <div class="logo-section">
            <img src="./assets/image.png" alt="Granix" class="logo" />
          </div>
          <div class="header-actions">
            <div class="connection-status">
              <div :class="['status-dot', wsConnected ? 'online' : 'offline']"></div>
              <span class="status-text">{{ wsConnected ? 'Conectado' : 'Desconectado' }}</span>
            </div>
            <button @click="handleLogout" class="logout-button">Cerrar Sesión</button>
          </div>
        </div>
      </header>

      <main class="app-main">
        <!-- Plantas Tab -->
        <Plants
          v-if="currentTab === 'plants'"
          :plants="plants"
          :selectedPlant="selectedPlant"
          :loading="plantsLoading"
          :error="plantsError"
          @select="handleSelectPlant"
        />

        <!-- Máquinas Tab -->
        <Machines
          v-if="currentTab === 'machines'"
          :machines="machines"
          :selectedMachineId="selectedMachineId"
          :selectedPlant="selectedPlant"
          :loading="machinesLoading"
          :error="machinesError"
          @select="handleSelectMachine"
        />

        <!-- Mediciones Tab (Dashboard) -->
        <Dashboard
          v-if="currentTab === 'dashboard'"
          :telemetryEvents="telemetryEvents"
          :currentMetricsValues="currentMetricsValues"
          :gaugeMetrics="gaugeMetrics"
          :statusMetrics="statusMetrics"
          :counterMetrics="counterMetrics"
        />
      </main>

      <!-- Bottom Navigation -->
      <nav class="bottom-nav">
        <button
          v-if="showPlantsTab"
          class="nav-item"
          :class="{ active: currentTab === 'plants' }"
          @click="currentTab = 'plants'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21V8l7-5 7 5v13" />
            <path d="M9 21V12h6v9" />
          </svg>
          <span>Plantas</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: currentTab === 'machines' }"
          @click="currentTab = 'machines'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>Máquinas</span>
        </button>
        <button
          class="nav-item"
          :class="{ active: currentTab === 'dashboard' }"
          @click="currentTab = 'dashboard'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3v18h18" />
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
          </svg>
          <span>Mediciones</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useWebSocket } from './composables/useWebSocket';
import { onAuthChange, logout } from './services/authService';
import api from './services/api';
import Login from './views/Login.vue';
import Machines from './views/Machines.vue';
import Dashboard from './views/Dashboard.vue';
import Plants from './views/Plants.vue';

export default {
  name: 'App',
  components: {
    Login,
    Machines,
    Dashboard,
    Plants,
  },
  setup() {
    const isAuthenticated = ref(false);
    const isAuthReady = ref(false);
    const currentUser = ref(null);
    const currentTab = ref('dashboard'); // Tab activo por defecto
    const telemetryEvents = ref([]);
    const currentMetricsValues = ref({});
    const wsConnected = ref(false);
    const showDataStream = ref(false);
    const plants = ref([]);
    const selectedPlant = ref(null);
    const machines = ref([]);
    const selectedMachineId = ref(null);
    const plantsLoading = ref(false);
    const plantsError = ref('');
    const machinesLoading = ref(false);
    const machinesError = ref('');
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

    const showPlantsTab = computed(() => plants.value.length > 1);

    function initializeMetricsValues() {
      const nextValues = {};
      Object.keys(metricMapping).forEach(key => {
        const config = metricMapping[key];
        if (config.type === 'gauge') {
          nextValues[key] = { value: 0, quality: true, ts: Date.now() };
        } else if (config.type === 'status') {
          nextValues[key] = { value: false, quality: true, ts: Date.now() };
        } else if (config.type === 'counter') {
          nextValues[key] = { value: 0, quality: true, ts: Date.now() };
        }
      });
      currentMetricsValues.value = nextValues;
    }

    function resetTelemetry() {
      telemetryEvents.value = [];
      initializeMetricsValues();
    }

    initializeMetricsValues();

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

    function matchesSelection(msg) {
      if (!selectedPlant.value) return false;
      if (msg.plant !== selectedPlant.value) return false;
      if (selectedMachineId.value && msg.machineId !== selectedMachineId.value) return false;
      return true;
    }

    function handleNewMessage(msg) {
      if (msg.type === 'telemetry' || msg.type === 'status') {
        if (!matchesSelection(msg)) return;
        // Agregar a stream de datos (solo últimos 100 para visualización)
        telemetryEvents.value.unshift({
          id: `${msg.plant || 'plant'}-${msg.machineId || 'machine'}-${msg.ts}`,
          plant: msg.plant,
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

    // Observar cambios de autenticación
    onMounted(() => {
      const unsubscribe = onAuthChange((user) => {
        isAuthReady.value = true;
        if (user) {
          isAuthenticated.value = true;
          currentUser.value = user;
          loadPlants();
          
          // Conectar WebSocket solo si está autenticado
          connect({
            onConnectionChange: (connected) => {
              wsConnected.value = connected;
            },
            onMessage: (msg) => {
              handleNewMessage(msg);
            },
          });
        } else {
          isAuthenticated.value = false;
          currentUser.value = null;
          plants.value = [];
          selectedPlant.value = null;
          machines.value = [];
          selectedMachineId.value = null;
          plantsError.value = '';
          machinesError.value = '';
          resetTelemetry();
          disconnect();
        }
      });

      // Cleanup
      return () => {
        unsubscribe();
      };
    });

    onUnmounted(() => {
      disconnect();
    });

    const handleLoginSuccess = (user) => {
      isAuthenticated.value = true;
      currentUser.value = user;
    };

    const handleLogout = async () => {
      const result = await logout();
      if (result.success) {
        isAuthenticated.value = false;
        currentUser.value = null;
        plants.value = [];
        selectedPlant.value = null;
        machines.value = [];
        selectedMachineId.value = null;
        plantsError.value = '';
        machinesError.value = '';
        resetTelemetry();
        disconnect();
      }
    };

    async function loadPlants() {
      plantsLoading.value = true;
      plantsError.value = '';
      try {
        const data = await api.getPlants();
        plants.value = Array.isArray(data) ? data : [];
        if (!selectedPlant.value || !plants.value.includes(selectedPlant.value)) {
          selectedPlant.value = plants.value[0] || null;
        }
      } catch (error) {
        console.error('Error al cargar plantas:', error);
        plantsError.value = 'No se pudieron cargar las plantas.';
        plants.value = [];
        selectedPlant.value = null;
      } finally {
        plantsLoading.value = false;
      }
    }

    async function loadMachines(plantId) {
      if (!plantId) {
        machines.value = [];
        selectedMachineId.value = null;
        return;
      }
      machinesLoading.value = true;
      machinesError.value = '';
      try {
        const data = await api.getMachinesByPlant(plantId);
        machines.value = Array.isArray(data) ? data : [];
        const machineIds = machines.value.map(machine => machine.machineId);
        if (!selectedMachineId.value || !machineIds.includes(selectedMachineId.value)) {
          selectedMachineId.value = machineIds[0] || null;
        }
      } catch (error) {
        console.error('Error al cargar máquinas:', error);
        machinesError.value = 'No se pudieron cargar las máquinas.';
        machines.value = [];
        selectedMachineId.value = null;
      } finally {
        machinesLoading.value = false;
      }
    }

    function handleSelectPlant(plant) {
      if (plant !== selectedPlant.value) {
        selectedPlant.value = plant;
      }
      if (currentTab.value === 'plants') {
        currentTab.value = 'machines';
      }
    }

    function handleSelectMachine(machineId) {
      if (machineId !== selectedMachineId.value) {
        selectedMachineId.value = machineId;
      }
    }

    watch(selectedPlant, (plant) => {
      loadMachines(plant);
      resetTelemetry();
    });

    watch(selectedMachineId, () => {
      resetTelemetry();
    });

    watch(showPlantsTab, (show) => {
      if (!show && currentTab.value === 'plants') {
        currentTab.value = 'dashboard';
      }
    });

    return {
      isAuthenticated,
      isAuthReady,
      currentUser,
      currentTab,
      telemetryEvents,
      currentMetricsValues,
      wsConnected,
      gaugeMetrics,
      statusMetrics,
      counterMetrics,
      plants,
      selectedPlant,
      plantsLoading,
      plantsError,
      machines,
      selectedMachineId,
      machinesLoading,
      machinesError,
      showPlantsTab,
      handleSelectPlant,
      handleSelectMachine,
      handleLoginSuccess,
      handleLogout,
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

/* Main App Container */
.main-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.auth-loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888888;
  font-size: 0.95rem;
  letter-spacing: 0.2px;
}

/* Header */
.app-header {
  background: linear-gradient(180deg, #0a0a0a 0%, #000000 100%);
  border-bottom: 1px solid #1a1a1a;
  padding: 1rem;
  position: sticky;
  top: 0;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-button {
  padding: 0.5rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.logout-button:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  width: 8rem;
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
  width: 100%;
  overflow-y: auto;
}

/* Bottom Navigation */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, #0a0a0a 0%, #000000 100%);
  border-top: 1px solid #1a1a1a;
  display: flex;
  justify-content: space-around;
  padding: 0.75rem 0;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1.5rem;
  background: none;
  border: none;
  color: #666666;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 8px;
}

.nav-item svg {
  width: 24px;
  height: 24px;
  transition: all 0.3s ease;
}

.nav-item span {
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.nav-item:hover {
  color: #8a2be2;
  background: rgba(138, 43, 226, 0.1);
}

.nav-item.active {
  color: #8a2be2;
  background: rgba(138, 43, 226, 0.15);
}

.nav-item.active svg {
  transform: scale(1.1);
}

/* Mobile Responsiveness */
@media (max-width: 768px) {
  .header-actions {
    flex-direction: row;
    gap: 0.5rem;
  }

  .logout-button {
    padding: 0.4rem 0.75rem;
    font-size: 0.75rem;
  }

  .bottom-nav {
    padding: 0.5rem 0;
  }

  .nav-item {
    padding: 0.5rem 1rem;
  }

  .nav-item svg {
    width: 22px;
    height: 22px;
  }

  .nav-item span {
    font-size: 0.7rem;
  }
}

@media (max-width: 480px) {
  .app-header {
    padding: 0.75rem 1rem;
  }

  .logo {
    height: auto;
    width: 10rem;
  }

  .connection-status {
    padding: 0.4rem 0.75rem;
  }

  .status-text {
    display: none;
  }

  .logout-button {
    padding: 0.4rem 0.6rem;
    font-size: 0.7rem;
  }

  .nav-item {
    padding: 0.4rem 0.75rem;
  }
}
</style>
