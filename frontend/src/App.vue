<template>
  <div id="app">
    <div v-if="!isAuthReady" class="auth-loading">
      Verificando sesión...
    </div>

    <!-- Login Screen -->
    <Login v-else-if="!isAuthenticated" @login-success="handleLoginSuccess" />

    <!-- Main App (Protected) -->
    <div v-else class="main-app">
      <!-- Ruta dedicada: Editor de Dashboard (F5 no lo cierra) -->
      <DashboardBuilder
        v-if="isDashboardBuilderRoute && builderData.plc && builderData.dashboard?.id && !builderData.loading"
        :plc="builderData.plc"
        :tenant="builderData.tenant"
        :plant="builderData.plant"
        :dashboard="builderData.dashboard"
        :widgets="builderData.widgets"
        @close="closeDashboardBuilderRoute"
        @saved="reloadDashboardBuilderRoute"
      />
      <div v-else-if="isDashboardBuilderRoute" class="auth-loading">
        Cargando editor...
      </div>

      <template v-else>
        <header v-if="currentTab !== 'admin'" class="app-header">
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

        <!-- PLCs Tab -->
        <Plcs
          v-if="currentTab === 'plcs'"
          :plcs="plcs"
          :selectedPlcThingName="selectedPlcThingName"
          :selectedPlant="selectedPlant"
          :loading="plcsLoading"
          :error="plcsError"
          @select="handleSelectPlc"
        />

        <!-- Mediciones Tab (Dashboard) -->
        <DynamicDashboard
          v-if="currentTab === 'dashboard'"
          :dashboard="dashboardData?.dashboard"
          :tenant="dashboardData?.tenant"
          :plant="dashboardData?.plant"
          :plc="dashboardData?.plc"
          :widgets="dashboardData?.widgets || []"
          :currentValues="currentMetricsValues"
          :loading="dashboardLoading"
          :error="dashboardError"
        />

        <!-- Admin Tab -->
        <AdminPanel v-if="currentTab === 'admin'" :tab="adminTab" />
        </main>

        <!-- Bottom Navigation (operador) -->
        <nav v-if="showOperatorTabs && currentTab !== 'admin'" class="bottom-nav">
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
          v-if="showOperatorTabs"
          class="nav-item"
          :class="{ active: currentTab === 'plcs' }"
          @click="currentTab = 'plcs'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>PLCs</span>
        </button>
        <button
          v-if="showOperatorTabs"
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
        <button
          v-if="showAdminTab"
          class="nav-item"
          :class="{ active: currentTab === 'admin' }"
          @click="currentTab = 'admin'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
          <span>Admin</span>
        </button>
        </nav>

        <!-- Bottom Navigation (admin mode) -->
        <nav v-if="currentTab === 'admin'" class="admin-nav">
        <button
          v-if="!isAdminOnly"
          class="admin-nav-item"
          @click="currentTab = 'dashboard'"
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span>Volver</span>
        </button>

        <button class="admin-nav-item" :class="{ active: adminTab === 'tenants' }" @click="adminTab = 'tenants'" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21V8l7-5 7 5v13" />
            <rect x="9" y="13" width="6" height="8" />
          </svg>
          <span>Tenants</span>
        </button>

        <button class="admin-nav-item" :class="{ active: adminTab === 'plants' }" @click="adminTab = 'plants'" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 20h20" />
            <path d="M5 20V8l7-5 7 5v12" />
            <rect x="9" y="12" width="6" height="8" />
          </svg>
          <span>Plantas</span>
        </button>

        <button class="admin-nav-item" :class="{ active: adminTab === 'plcs' }" @click="adminTab = 'plcs'" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span>PLCs</span>
        </button>

        <button class="admin-nav-item" :class="{ active: adminTab === 'users' }" @click="adminTab = 'users'" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Usuarios</span>
        </button>

        <button class="admin-nav-item" :class="{ active: adminTab === 'persist' }" @click="adminTab = 'persist'" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <span>Persistencia</span>
        </button>

        <button class="admin-nav-item" :class="{ active: adminTab === 'dashboards' }" @click="adminTab = 'dashboards'" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>Dashboards</span>
        </button>

        <button class="admin-nav-item" @click="handleLogout" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          <span>Salir</span>
        </button>
        </nav>
      </template>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useWebSocket } from './composables/useWebSocket';
import { onAuthChange, logout } from './services/authService';
import api from './services/api';
import Login from './views/Login.vue';
import Plcs from './views/Plcs.vue';
import DynamicDashboard from './views/DynamicDashboard.vue';
import Plants from './views/Plants.vue';
import AdminPanel from './views/AdminPanel.vue';
import DashboardBuilder from './views/DashboardBuilder.vue';

export default {
  name: 'App',
  components: {
    Login,
    Plcs,
    DynamicDashboard,
    Plants,
    AdminPanel,
    DashboardBuilder,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const isAuthenticated = ref(false);
    const isAuthReady = ref(false);
    const currentUser = ref(null);
    const currentTab = ref('dashboard'); // Tab activo por defecto
    const adminTab = ref('tenants');
    const telemetryEvents = ref([]);
    const currentMetricsValues = ref({});
    const wsConnected = ref(false);
    const showDataStream = ref(false);
    const plants = ref([]);
    const selectedPlant = ref(null);
    const plcs = ref([]);
    const selectedPlcThingName = ref(null);
    const isAdmin = ref(false);
    const isAdminOnly = ref(false); // Solo admin, sin acceso a plantas
    const tenantInfo = ref(null);
    const dashboardData = ref(null);
    const dashboardLoading = ref(false);
    const dashboardError = ref('');
    const plantsLoading = ref(false);
    const plantsError = ref('');
    const plcsLoading = ref(false);
    const plcsError = ref('');
    const { connect, disconnect } = useWebSocket();

    // ===== Dashboard Builder (ruta dedicada) =====
    const builderData = ref({
      plc: null,
      tenant: null,
      plant: null,
      dashboard: { id: null, name: '', iconUrl: '', layoutVersion: 1 },
      widgets: [],
      loading: false,
      error: '',
    });

    const isDashboardBuilderRoute = computed(() => route.name === 'dashboardBuilder');

    const applyQueryTabs = () => {
      const qTab = route.query?.tab;
      const qAdminTab = route.query?.adminTab;
      if (typeof qTab === 'string' && qTab) currentTab.value = qTab;
      if (typeof qAdminTab === 'string' && qAdminTab) adminTab.value = qAdminTab;
    };

    const loadBuilderFromRoute = async () => {
      if (!isDashboardBuilderRoute.value) return;
      const plcId = route.params?.plcId;
      if (!plcId) return;

      builderData.value.loading = true;
      builderData.value.error = '';
      try {
        const dashboard = await api.getDashboardByPlc(plcId);
        builderData.value = {
          plc: dashboard.plc || null,
          tenant: dashboard.tenant || null,
          plant: dashboard.plant || null,
          dashboard: {
            id: dashboard.id,
            name: dashboard.name,
            iconUrl: dashboard.iconUrl || '',
            layoutVersion: dashboard.layoutVersion || 1,
          },
          widgets: dashboard.widgets || [],
          loading: false,
          error: '',
        };
      } catch (e) {
        console.error('Error cargando dashboard builder:', e);
        builderData.value.loading = false;
        builderData.value.error = 'No se pudo cargar el dashboard para editar.';
        builderData.value.widgets = [];
      }
    };

    const closeDashboardBuilderRoute = () => {
      const returnTab = (route.query?.returnTab || 'admin');
      const returnAdminTab = (route.query?.returnAdminTab || 'dashboards');
      router.push({ name: 'home', query: { tab: returnTab, adminTab: returnAdminTab } });
    };

    const reloadDashboardBuilderRoute = async () => {
      await loadBuilderFromRoute();
    };

    const showPlantsTab = computed(() => !isAdminOnly.value && plants.value.length > 1);
    const showAdminTab = computed(() => isAdmin.value);
    const showOperatorTabs = computed(() => !isAdminOnly.value); // PLCs, Dashboard, etc.

    function initializeMetricsValues() {
      currentMetricsValues.value = {};
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

    const activePlcs = computed(() => {
      const plcsSet = new Set();
      telemetryEvents.value.forEach(event => {
        plcsSet.add(event.plcThingName);
      });
      return plcsSet.size;
    });

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }

    function matchesSelection(msg) {
      if (!selectedPlant.value) return false;
      if (msg.plant !== selectedPlant.value) return false;
      if (selectedPlcThingName.value && msg.plcThingName !== selectedPlcThingName.value) return false;
      return true;
    }

    function handleNewMessage(msg) {
      if (msg.type === 'telemetry') {
        if (!matchesSelection(msg)) return;
        // Agregar a stream de datos (solo últimos 100 para visualización)
        telemetryEvents.value.unshift({
          id: `${msg.plant || 'plant'}-${msg.plcThingName || 'plc'}-${msg.ts}`,
          plant: msg.plant,
          plcThingName: msg.plcThingName,
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
              currentMetricsValues.value[key] = {
                value: value.value,
                quality: value.quality,
                ts: msg.ts,
              };
            }
          });
        }
      }
    }

    // Observar cambios de autenticación
    onMounted(() => {
      const unsubscribe = onAuthChange(async (user) => {
        isAuthReady.value = true;
        if (user) {
          isAuthenticated.value = true;
          currentUser.value = user;
          await loadAdminAccess();
          applyQueryTabs();

          if (!isAdminOnly.value) {
            await loadPlants();
            await loadTenantInfo();
            // Conectar WebSocket solo si es operador
            connect({
              onConnectionChange: (connected) => {
                wsConnected.value = connected;
              },
              onMessage: (msg) => {
                handleNewMessage(msg);
              },
            });
          } else {
            // Admin-only: no levantar plantas ni WS
            wsConnected.value = false;
            disconnect();
            currentTab.value = 'admin';
            adminTab.value = 'tenants';
          }

          // Si entramos por ruta del builder (o refrescamos), cargar data
          await loadBuilderFromRoute();
        } else {
          isAuthenticated.value = false;
          currentUser.value = null;
          plants.value = [];
          selectedPlant.value = null;
          plcs.value = [];
          selectedPlcThingName.value = null;
          isAdmin.value = false;
          isAdminOnly.value = false;
          tenantInfo.value = null;
          dashboardData.value = null;
          dashboardError.value = '';
          plantsError.value = '';
          plcsError.value = '';
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

    // Si cambian params/ruta, recargar builder o aplicar query tabs (F5/entrada directa)
    watch(
      () => [route.name, route.params?.plcId, route.query?.tab, route.query?.adminTab],
      async () => {
        if (!isAuthenticated.value) return;
        applyQueryTabs();
        await loadBuilderFromRoute();
      }
    );

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
        plcs.value = [];
        selectedPlcThingName.value = null;
        plantsError.value = '';
        plcsError.value = '';
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

    async function loadPlcs(plantId) {
      if (!plantId) {
        plcs.value = [];
        selectedPlcThingName.value = null;
        return;
      }
      plcsLoading.value = true;
      plcsError.value = '';
      try {
        const data = await api.getPlcsByPlant(plantId);
        plcs.value = Array.isArray(data) ? data : [];
        const plcThingNames = plcs.value.map(plc => plc.plcThingName);
        if (!selectedPlcThingName.value || !plcThingNames.includes(selectedPlcThingName.value)) {
          selectedPlcThingName.value = plcThingNames[0] || null;
        }
      } catch (error) {
        console.error('Error al cargar PLCs:', error);
        plcsError.value = 'No se pudieron cargar los PLCs.';
        plcs.value = [];
        selectedPlcThingName.value = null;
      } finally {
        plcsLoading.value = false;
      }
    }

    async function loadAdminAccess() {
      try {
        const result = await api.getAdminAccess();
        isAdmin.value = !!result?.allowed;
        isAdminOnly.value = !!result?.adminOnly;
        // Si es adminOnly, ir directo al panel admin
        if (isAdminOnly.value) {
          currentTab.value = 'admin';
          adminTab.value = 'tenants';
        }
      } catch (error) {
        isAdmin.value = false;
        isAdminOnly.value = false;
      }
    }

    async function loadTenantInfo() {
      try {
        tenantInfo.value = await api.getTenantMe();
      } catch (error) {
        tenantInfo.value = null;
      }
    }

    async function loadDashboard() {
      if (!tenantInfo.value?.slug || !selectedPlant.value || !selectedPlcThingName.value) {
        dashboardData.value = null;
        return;
      }
      dashboardLoading.value = true;
      dashboardError.value = '';
      try {
        dashboardData.value = await api.getPublicDashboard(
          tenantInfo.value.slug,
          selectedPlant.value,
          selectedPlcThingName.value
        );
      } catch (error) {
        dashboardData.value = null;
        dashboardError.value = 'No se pudo cargar el dashboard.';
      } finally {
        dashboardLoading.value = false;
      }
    }

    function handleSelectPlant(plant) {
      if (plant !== selectedPlant.value) {
        selectedPlant.value = plant;
      }
      if (currentTab.value === 'plants') {
        currentTab.value = 'plcs';
      }
    }

    function handleSelectPlc(plcThingName) {
      if (plcThingName !== selectedPlcThingName.value) {
        selectedPlcThingName.value = plcThingName;
      }
    }

    watch(selectedPlant, (plant) => {
      loadPlcs(plant);
      resetTelemetry();
      loadDashboard();
    });

    watch(selectedPlcThingName, () => {
      resetTelemetry();
      loadDashboard();
    });

    watch(tenantInfo, () => {
      loadDashboard();
    });

    watch(showPlantsTab, (show) => {
      if (!show && currentTab.value === 'plants') {
        currentTab.value = 'dashboard';
      }
    });

    watch(showAdminTab, (show) => {
      if (!show && currentTab.value === 'admin') {
        currentTab.value = 'dashboard';
      }
    });

    return {
      isAuthenticated,
      isAuthReady,
      currentUser,
      currentTab,
      adminTab,
      telemetryEvents,
      currentMetricsValues,
      wsConnected,
      plants,
      selectedPlant,
      plantsLoading,
      plantsError,
      plcs,
      selectedPlcThingName,
      plcsLoading,
      plcsError,
      isAdmin,
      isAdminOnly,
      tenantInfo,
      dashboardData,
      dashboardLoading,
      dashboardError,
      showPlantsTab,
      showAdminTab,
      showOperatorTabs,
      handleSelectPlant,
      handleSelectPlc,
      handleLoginSuccess,
      handleLogout,
      // Builder route
      builderData,
      isDashboardBuilderRoute,
      closeDashboardBuilderRoute,
      reloadDashboardBuilderRoute,
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
  color: #f5f5f7;
  background: rgba(255, 255, 255, 0.05);
}

.nav-item.active {
  color: #f5f5f7;
  background: rgba(255, 255, 255, 0.1);
}

.nav-item.active svg {
  transform: scale(1.05);
}

/* Admin Navigation */
.admin-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;
  background: #0d0d0d;
  border-top: 1px solid #1d1d1f;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.25rem;
  padding: 0 1rem;
  z-index: 1000;
}

.admin-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  height: 56px;
  padding: 0 1rem;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: #48484a;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-nav-item svg {
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.admin-nav-item span {
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
}

.admin-nav-item:hover {
  color: #86868b;
  background: rgba(255, 255, 255, 0.03);
}

.admin-nav-item.active {
  color: #f5f5f7;
  background: rgba(255, 255, 255, 0.08);
}

.admin-nav-item.active svg {
  transform: scale(1.05);
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

@media (max-width: 768px) {
  .admin-nav {
    gap: 0;
    padding: 0 0.5rem;
  }

  .admin-nav-item {
    padding: 0 0.6rem;
  }

  .admin-nav-item span {
    font-size: 0.65rem;
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

  .admin-nav-item {
    padding: 0 0.4rem;
    height: 52px;
  }

  .admin-nav-item svg {
    width: 18px;
    height: 18px;
  }

  .admin-nav-item span {
    font-size: 0.6rem;
  }
}
</style>
