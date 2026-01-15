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
        :key="plant"
        class="plant-card"
        :class="{ active: selectedPlant === plant }"
        @click="selectPlant(plant)"
      >
        <div class="plant-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21V8l7-5 7 5v13" />
            <path d="M9 21V12h6v9" />
          </svg>
        </div>
        <div class="plant-info">
          <h3 class="plant-name">{{ formatPlant(plant) }}</h3>
          <p class="plant-id">{{ plant }}</p>
        </div>
        <div v-if="selectedPlant === plant" class="selected-badge">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        </div>
      </div>
    </div>

    <div v-if="selectedPlant" class="selection-info">
      <p>Planta seleccionada: <strong>{{ formatPlant(selectedPlant) }}</strong></p>
      <p class="hint">Las máquinas y mediciones se filtran por esta planta</p>
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

const selectPlant = (plant) => {
  emit('select', plant);
};

const formatPlant = (plant) => {
  if (!plant) return '-';
  return plant
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
</script>

<style scoped>
.plants-container {
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 100px;
}

.plants-header {
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

.plants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.plant-card {
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

.plant-card:hover {
  border-color: #8a2be2;
  box-shadow: 0 4px 16px rgba(138, 43, 226, 0.2);
  transform: translateY(-2px);
}

.plant-card.active {
  border-color: #8a2be2;
  background: linear-gradient(135deg, #1a0a2e 0%, #0f0520 100%);
  box-shadow: 0 4px 16px rgba(138, 43, 226, 0.3);
}

.plant-icon {
  width: 44px;
  height: 44px;
  background: rgba(138, 43, 226, 0.1);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8a2be2;
}

.plant-icon svg {
  width: 24px;
  height: 24px;
}

.plant-info {
  flex: 1;
}

.plant-name {
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 0.25rem;
}

.plant-id {
  font-size: 0.8rem;
  color: #666666;
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
  .plants-container {
    padding: 1rem;
    padding-bottom: 90px;
  }

  .page-title {
    font-size: 1.5rem;
  }

  .plants-grid {
    grid-template-columns: 1fr;
  }
}
</style>
