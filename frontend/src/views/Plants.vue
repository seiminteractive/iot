<template>
  <div class="plants-container">
    <header class="plants-header">
      <h1 class="page-title">Plantas</h1>
    <p class="page-subtitle">Selecciona la planta que querés visualizar</p>
    </header>

    <div v-if="loading" class="state-message">Cargando plantas...</div>
    <div v-else-if="error" class="state-message error">{{ error }}</div>

    <div v-else class="plants-grid">
      <div
        v-for="plant in plants"
        :key="plant.id"
        class="plant-card"
        :class="{ active: isSelected(plant) }"
        @click="selectPlant(plant)"
      >
        <div class="plant-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21V8l7-5 7 5v13" />
            <path d="M9 21V12h6v9" />
          </svg>
        </div>
        <div class="plant-info">
          <h3 class="plant-name">{{ plant.name || formatName(plant.plantId) }}</h3>
          <p class="plant-id">{{ formatProvince(plant.province) }} · {{ plant.plantId }}</p>
        </div>
        <div v-if="isSelected(plant)" class="selected-badge">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
      </div>
    </div>

    <div v-if="selectedPlant" class="selection-info">
      <p>Planta seleccionada: <strong>{{ selectedPlant.name || formatName(selectedPlant.plantId) }}</strong></p>
      <p class="hint">{{ formatProvince(selectedPlant.province) }} · {{ selectedPlant.plantId }}</p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  plants: {
    type: Array,
    default: () => [],
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

const isSelected = (plant) => props.selectedPlant?.id === plant.id;

const selectPlant = (plant) => {
  emit('select', plant);
};

const formatName = (name) => {
  if (!name) return '-';
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatProvince = (province) => {
  if (!province) return '';
  return province
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
</script>

<style scoped>
/* Apple-style Plants View */
.plants-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  background: #000000;
}

.plants-header {
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

.plants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.plant-card {
  background: #0d0d0d;
  border: 1px solid #1d1d1f;
  border-radius: 16px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.plant-card:hover {
  border-color: #2d2d2d;
  background: #141414;
}

.plant-card.active {
  border-color: #f5f5f7;
  background: #1a1a1a;
}

.plant-icon {
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

.plant-card.active .plant-icon {
  background: #f5f5f7;
  color: #000000;
}

.plant-icon svg {
  width: 24px;
  height: 24px;
  stroke-width: 1.8;
}

.plant-info {
  flex: 1;
  min-width: 0;
}

.plant-name {
  font-size: 1rem;
  font-weight: 600;
  color: #f5f5f7;
  margin: 0 0 0.35rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plant-id {
  font-size: 0.8rem;
  color: #86868b;
  margin: 0;
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

.selection-info {
  background: #0d0d0d;
  border: 1px solid #2d2d2d;
  border-radius: 16px;
  padding: 1.25rem;
  text-align: center;
}

.selection-info p {
  color: #86868b;
  margin: 0 0 0.35rem 0;
  font-size: 0.95rem;
}

.selection-info p:last-child {
  margin-bottom: 0;
}

.selection-info strong {
  color: #f5f5f7;
  font-weight: 600;
}

.hint {
  font-size: 0.85rem;
  color: #48484a;
}

@media (max-width: 768px) {
  .plants-container {
    padding: 1.5rem;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .plants-grid {
    grid-template-columns: 1fr;
  }

  .plant-card {
    padding: 1.25rem;
  }
}
</style>
