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
          <p class="plc-location">{{ getPlantInfo(plc) }}</p>
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
  selectedPlc: {
    type: Object,
    default: null,
  },
  selectedPlant: {
    type: Object,
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
  emit('select', plc);
};

const isSelected = (plc) => props.selectedPlc?.id === plc.id;

const getPlcName = (plc) => plc?.name || plc?.plcThingName || 'PLC';

const getPlantInfo = (plc) => {
  const province = plc?.plant?.province || props.selectedPlant?.province;
  const plantName = plc?.plant?.name || props.selectedPlant?.name || props.selectedPlant?.plantId;
  if (province && plantName) {
    return `${formatName(province)} · ${formatName(plantName)}`;
  }
  return plantName ? formatName(plantName) : 'Planta';
};

const getStatus = (plc) => {
  if (!plc?.state?.lastTs) return 'offline';
  const lastTs = new Date(plc.state.lastTs).getTime();
  const now = Date.now();
  const diffSeconds = (now - lastTs) / 1000;
  return diffSeconds <= 30 ? 'online' : 'offline';
};

const getStatusText = (status) => (status === 'online' ? 'Online' : 'Offline');

const formatName = (name) => {
  if (!name) return '-';
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
</script>

<style scoped>
/* Apple-style PLCs View */
.plcs-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  background: #000000;
}

.plcs-header {
  margin-bottom: 2rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  color: #f5f5f7;
  margin: 0 0 0.25rem 0;
  letter-spacing: -0.5px;
}

.page-subtitle {
  font-size: 0.95rem;
  color: #86868b;
  margin: 0;
}

.state-message {
  padding: 1.5rem;
  border-radius: 16px;
  background: #0d0d0d;
  border: 1px solid #1d1d1f;
  color: #86868b;
  text-align: center;
  font-size: 0.95rem;
}

.state-message.error {
  border-color: rgba(255, 69, 58, 0.3);
  color: #ff453a;
  background: rgba(255, 69, 58, 0.08);
}

.plcs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.plc-card {
  background: #0d0d0d;
  border: 1px solid #1d1d1f;
  border-radius: 16px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.plc-card:hover {
  border-color: #2d2d2d;
  background: #141414;
}

.plc-card.active {
  border-color: #f5f5f7;
  background: #1a1a1a;
}

.plc-icon {
  width: 48px;
  height: 48px;
  background: #1d1d1f;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86868b;
  flex-shrink: 0;
}

.plc-card.active .plc-icon {
  background: #f5f5f7;
  color: #000000;
}

.plc-icon svg {
  width: 24px;
  height: 24px;
  stroke-width: 1.8;
}

.plc-info {
  flex: 1;
  min-width: 0;
}

.plc-name {
  font-size: 1rem;
  font-weight: 600;
  color: #f5f5f7;
  margin: 0 0 0.35rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plc-location {
  font-size: 0.8rem;
  color: #86868b;
  margin: 0 0 0.75rem 0;
}

.plc-status {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  background: #1d1d1f;
  border-radius: 20px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.online {
  background: #30d158;
  box-shadow: 0 0 8px rgba(48, 209, 88, 0.5);
}

.status-indicator.offline {
  background: #48484a;
}

.status-text {
  font-size: 0.75rem;
  font-weight: 500;
  color: #86868b;
}

.selected-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 24px;
  height: 24px;
  background: #f5f5f7;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000000;
}

.selected-badge svg {
  width: 14px;
  height: 14px;
}

@media (max-width: 768px) {
  .plcs-container {
    padding: 1.5rem;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .plcs-grid {
    grid-template-columns: 1fr;
  }

  .plc-card {
    padding: 1.25rem;
  }
}
</style>
