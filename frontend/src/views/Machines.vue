<template>
  <div class="machines-container">
    <header class="machines-header">
      <h1 class="page-title">Máquinas</h1>
      <p class="page-subtitle">
        {{ selectedPlant ? `Planta ${formatPlant(selectedPlant)}` : 'Selecciona una planta para ver sus máquinas' }}
      </p>
    </header>

    <div v-if="loading" class="state-message">Cargando máquinas...</div>
    <div v-else-if="error" class="state-message error">{{ error }}</div>

    <div v-else class="machines-grid">
      <div
        v-for="machine in machines"
        :key="machine.id"
        class="machine-card"
        :class="{ active: isSelected(machine) }"
        @click="selectMachine(machine)"
      >
        <div class="machine-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <div class="machine-info">
          <h3 class="machine-name">{{ getMachineName(machine) }}</h3>
          <p class="machine-location">{{ selectedPlant ? `Planta ${formatPlant(selectedPlant)}` : 'Planta' }}</p>
          <div class="machine-status">
            <div :class="['status-indicator', getStatus(machine)]"></div>
            <span class="status-text">{{ getStatusText(getStatus(machine)) }}</span>
          </div>
        </div>
        <div v-if="isSelected(machine)" class="selected-badge">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
      </div>
    </div>

    <div v-if="!loading && !error && machines.length === 0" class="state-message">
      No hay máquinas para esta planta todavía.
    </div>

    <div v-if="selectedMachineLabel" class="selection-info">
      <p>Máquina seleccionada: <strong>{{ selectedMachineLabel }}</strong></p>
      <p class="hint">Ve a la pestaña "Mediciones" para ver los datos en tiempo real</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const props = defineProps({
  machines: {
    type: Array,
    default: () => [],
  },
  selectedMachineId: {
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

const selectMachine = (machine) => {
  if (machine?.machineId) {
    emit('select', machine.machineId);
  }
};

const isSelected = (machine) => props.selectedMachineId === machine.machineId;

const getMachineName = (machine) => machine?.name || machine?.machineId || 'Máquina';

const getStatus = (machine) => {
  if (!machine?.state?.lastTs) return 'offline';
  const lastTs = new Date(machine.state.lastTs).getTime();
  if (Number.isNaN(lastTs)) return 'offline';
  return Date.now() - lastTs <= ONLINE_WINDOW_MS ? 'online' : 'offline';
};

const getStatusText = (status) => {
  const statusMap = {
    online: 'En línea',
    offline: 'Desconectada',
  };
  return statusMap[status] || 'Desconocido';
};

const formatPlant = (plant) => {
  if (!plant) return '-';
  return plant
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const selectedMachineLabel = computed(() => {
  const selected = props.machines.find(machine => machine.machineId === props.selectedMachineId);
  return selected ? getMachineName(selected) : '';
});
</script>

<style scoped>
.machines-container {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 100px; /* Espacio para el bottom nav */
}

.machines-header {
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
  margin-bottom: 1.5rem;
}

.state-message.error {
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.machines-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.machine-card {
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 2px solid #222222;
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.machine-card:hover {
  border-color: #8a2be2;
  box-shadow: 0 4px 16px rgba(138, 43, 226, 0.2);
  transform: translateY(-2px);
}

.machine-card.active {
  border-color: #8a2be2;
  background: linear-gradient(135deg, #1a0a2e 0%, #0f0520 100%);
  box-shadow: 0 4px 16px rgba(138, 43, 226, 0.3);
}

.machine-icon {
  width: 48px;
  height: 48px;
  background: rgba(138, 43, 226, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8a2be2;
}

.machine-icon svg {
  width: 28px;
  height: 28px;
}

.machine-info {
  flex: 1;
}

.machine-name {
  font-size: 1.2rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 0.25rem;
}

.machine-location {
  font-size: 0.85rem;
  color: #666666;
  margin-bottom: 0.75rem;
}

.machine-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-indicator.online {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.status-indicator.offline {
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
}

.status-indicator.maintenance {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.status-text {
  font-size: 0.85rem;
  color: #888888;
}

.selected-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  background: #8a2be2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
}

.selected-badge svg {
  width: 20px;
  height: 20px;
}

.selection-info {
  background: linear-gradient(135deg, #1a0a2e 0%, #0f0520 100%);
  border: 1px solid #8a2be2;
  border-radius: 12px;
  padding: 1.25rem;
  text-align: center;
}

.selection-info p {
  color: #cccccc;
  margin-bottom: 0.5rem;
}

.selection-info p:last-child {
  margin-bottom: 0;
}

.selection-info strong {
  color: #8a2be2;
  font-weight: 600;
}

.hint {
  font-size: 0.85rem;
  color: #888888;
}

@media (max-width: 768px) {
  .machines-container {
    padding: 1rem;
    padding-bottom: 90px;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .machines-grid {
    grid-template-columns: 1fr;
  }
}
</style>
