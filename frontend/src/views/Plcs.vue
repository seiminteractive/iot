<template>
  <div class="plcs-container">
    <header class="plcs-header">
      <h1 class="page-title">PLCs</h1>
      <p class="page-subtitle">Selecciona el PLC que querés visualizar</p>
    </header>

    <div v-if="loading" class="state-message">Cargando PLCs...</div>
    <div v-else-if="error" class="state-message error">{{ error }}</div>

    <div v-else class="plcs-grid">
      <div
        v-for="plc in plcs"
        :key="plc.id"
        class="plc-card"
        :class="{ active: isSelected(plc) }"
        @click="selectPlc(plc)"
      >
        <div class="plc-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div class="plc-info">
          <h3 class="plc-name">{{ getPlcName(plc) }}</h3>
          <p class="plc-location">{{ selectedPlant ? `Planta ${formatPlant(selectedPlant)}` : 'Planta' }}</p>
          <div class="plc-status">
            <div :class="['status-indicator', getStatus(plc)]"></div>
            <span class="status-text">{{ getStatusText(getStatus(plc)) }}</span>
          </div>
        </div>
        <div v-if="isSelected(plc)" class="selected-badge">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
      </div>
    </div>

    <div v-if="!loading && !error && plcs.length === 0" class="state-message">
      No hay PLCs disponibles para esta planta.
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  plcs: {
    type: Array,
    default: () => [],
  },
  selectedPlcThingName: {
    type: String,
    default: null,
  },
  selectedPlant: {
    type: String,
    default: null,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['select']);

const selectPlc = (plc) => {
  if (plc?.plcThingName) {
    emit('select', plc.plcThingName);
  }
};

const isSelected = (plc) => props.selectedPlcThingName === plc.plcThingName;

const getPlcName = (plc) => plc?.name || plc?.plcThingName || 'PLC';

const getStatus = (plc) => {
  if (!plc?.state?.lastTs) return 'offline';
  const lastTs = new Date(plc.state.lastTs).getTime();
  const now = Date.now();
  const diffSeconds = (now - lastTs) / 1000;
  return diffSeconds <= 30 ? 'online' : 'offline';
};

const getStatusText = (status) => (status === 'online' ? 'Online' : 'Offline');

const formatPlant = (plant) => {
  if (!plant) return '-';
  return plant
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
</script>

<style scoped>
.plcs-container {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 100px;
}

.plcs-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 0.5rem;
}

.page-subtitle {
  font-size: 0.95rem;
  color: #888888;
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

.plcs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.plc-card {
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 2px solid #222222;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.plc-card:hover {
  border-color: #8a2be2;
  box-shadow: 0 4px 16px rgba(138, 43, 226, 0.2);
  transform: translateY(-2px);
}

.plc-card.active {
  border-color: #8a2be2;
  background: linear-gradient(135deg, #1a0a2e 0%, #0f0520 100%);
  box-shadow: 0 4px 16px rgba(138, 43, 226, 0.3);
}

.plc-icon {
  width: 44px;
  height: 44px;
  background: rgba(138, 43, 226, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8a2be2;
}

.plc-icon svg {
  width: 24px;
  height: 24px;
}

.plc-info {
  flex: 1;
}

.plc-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 0.25rem;
}

.plc-location {
  font-size: 0.8rem;
  color: #666666;
}

.plc-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-indicator.online {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.status-indicator.offline {
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}

.status-text {
  font-size: 0.8rem;
  color: #888888;
}

.selected-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 28px;
  height: 28px;
  background: #8a2be2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.selected-badge svg {
  width: 16px;
  height: 16px;
}

@media (max-width: 768px) {
  .plcs-container {
    padding: 1rem;
    padding-bottom: 90px;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .plcs-grid {
    grid-template-columns: 1fr;
  }
}
</style>
