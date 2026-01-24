<template>
  <div class="plant-autocomplete" ref="containerRef">
    <!-- Input de búsqueda -->
    <input
      v-model="searchInput"
      @input="handleInput"
      @focus="handleFocus"
      @blur="closeSuggestions"
      :placeholder="placeholder"
      :disabled="disabled"
      type="text"
      class="autocomplete-input"
    />
    
    <!-- Dropdown de sugerencias - Portal para escapar del overflow -->
    <Teleport to="body" v-if="showSuggestions && filteredPlants.length > 0">
      <div 
        class="autocomplete-dropdown" 
        :style="dropdownPosition"
      >
        <div
          v-for="plant in filteredPlants"
          :key="plant.id"
          @mousedown.prevent="selectPlant(plant)"
          class="dropdown-item"
        >
          <div class="item-title">{{ plant.name || plant.plantId }}</div>
          <div class="item-subtitle">{{ plant.province }} · {{ plant.plantId }}</div>
        </div>
      </div>
    </Teleport>

    <!-- Plantas seleccionadas como tags -->
    <div v-if="selectedPlants.length > 0" class="tags-container">
      <div v-for="plant in selectedPlants" :key="plant.id" class="tag">
        <span>{{ plant.province }} - {{ plant.name || plant.plantId }}</span>
        <button @click.prevent="removePlant(plant.id)" type="button" class="tag-remove">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  availablePlants: { type: Array, default: () => [] },
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Escribir para buscar plantas...' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const searchInput = ref('');
const showSuggestions = ref(false);
const selectedPlants = ref([]);
const containerRef = ref(null);
const dropdownPosition = ref({});

// Sync desde el padre
watch(
  () => props.modelValue,
  (newVal) => {
    if (Array.isArray(newVal) && newVal.length > 0) {
      selectedPlants.value = props.availablePlants.filter(p => newVal.includes(p.id));
    } else {
      selectedPlants.value = [];
    }
  },
  { immediate: true }
);

// Filtrar plantas (excluir ya seleccionadas)
const filteredPlants = computed(() => {
  const selectedIds = new Set(selectedPlants.value.map(p => p.id));
  let result = props.availablePlants.filter(p => !selectedIds.has(p.id));

  if (searchInput.value) {
    const q = searchInput.value.toLowerCase();
    result = result.filter(p =>
      p.province.toLowerCase().includes(q) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      p.plantId.toLowerCase().includes(q)
    );
  }
  return result;
});

const calculatePosition = async () => {
  await nextTick();
  const input = containerRef.value?.querySelector('.autocomplete-input');
  if (!input) return;

  const rect = input.getBoundingClientRect();
  dropdownPosition.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  };
};

const handleInput = async () => {
  if (props.disabled) return;
  showSuggestions.value = true;
  await calculatePosition();
};

const handleFocus = async () => {
  if (props.disabled) return;
  showSuggestions.value = true;
  await calculatePosition();
};

const selectPlant = (plant) => {
  if (props.disabled) return;
  selectedPlants.value.push(plant);
  emit('update:modelValue', selectedPlants.value.map(p => p.id));
  searchInput.value = '';
  showSuggestions.value = false;
};

const removePlant = (plantId) => {
  if (props.disabled) return;
  selectedPlants.value = selectedPlants.value.filter(p => p.id !== plantId);
  emit('update:modelValue', selectedPlants.value.map(p => p.id));
};

const closeSuggestions = () => {
  setTimeout(() => { showSuggestions.value = false; }, 150);
};
</script>

<style scoped>
.plant-autocomplete {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.autocomplete-input {
  height: 44px;
  width: 100%;
  padding: 0 1rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  color: #f5f5f7;
  font-size: 0.9rem;
  font-family: inherit;
}

.autocomplete-input:focus {
  outline: none;
  border-color: #424245;
  background: #252525;
}

.autocomplete-input::placeholder {
  color: #48484a;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  background: #8a2be2;
  color: #f5f5f7;
  border-radius: 6px;
  font-size: 0.85rem;
}

.tag-remove {
  background: none;
  border: none;
  color: #f5f5f7;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0;
  line-height: 1;
}

.tag-remove:hover {
  opacity: 0.8;
}
</style>

<style>
/* Estilos globales para el dropdown renderizado en body */
.autocomplete-dropdown {
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
}

.dropdown-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid #2d2d2d;
  transition: background 0.2s ease;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: #252525;
}

.item-title {
  font-weight: 600;
  color: #f5f5f7;
  font-size: 0.95rem;
}

.item-subtitle {
  font-size: 0.75rem;
  color: #48484a;
  margin-top: 0.2rem;
}

.autocomplete-dropdown::-webkit-scrollbar {
  width: 6px;
}

.autocomplete-dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.autocomplete-dropdown::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 3px;
}

.autocomplete-dropdown::-webkit-scrollbar-thumb:hover {
  background: #6b7280;
}
</style>
