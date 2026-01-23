<template>
  <div class="persist-rules">
    <header class="section-header">
      <div>
        <h1>Reglas de Persistencia</h1>
        <p>Define qué métricas se guardan y cómo se agregan</p>
      </div>
      <button class="btn-ghost" @click="loadRules">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
        </svg>
        Actualizar
      </button>
    </header>

    <!-- Form -->
    <div class="form-card">
      <h3>{{ editingId ? 'Editar regla' : 'Nueva regla' }}</h3>
      <form @submit.prevent="handleSubmit" class="form-grid">
        <!-- Cascada: Tenant → Plant → PLC -->
        <div class="form-field">
          <label>Tenant *</label>
          <select v-model="selectedTenantId" @change="handleTenantChange" required>
            <option value="" disabled>Seleccionar tenant</option>
            <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
              {{ tenant.name }} ({{ tenant.slug }})
            </option>
          </select>
        </div>

        <div class="form-field">
          <label>Planta</label>
          <select v-model="selectedPlantId" @change="handlePlantChange" :disabled="!selectedTenantId">
            <option value="">Todas las plantas</option>
            <option v-for="plant in filteredPlants" :key="plant.id" :value="plant.id">
              {{ plant.name || plant.plantId }}
            </option>
          </select>
        </div>

        <div class="form-field">
          <label>PLC</label>
          <select v-model="selectedPlcId" :disabled="!selectedPlantId">
            <option value="">Todos los PLCs</option>
            <option v-for="plc in filteredPlcs" :key="plc.id" :value="plc.id">
              {{ plc.plcThingName }}
            </option>
          </select>
        </div>

        <div class="form-field">
          <label>Metric ID *</label>
          <input 
            v-model="form.metricId" 
            placeholder="ej: Simulacion.Envasadora-1.Temperatura" 
            required 
          />
          <span class="helper">Nombre de la variable a persistir</span>
        </div>

        <div class="form-field">
          <label>Modo de guardado *</label>
          <select v-model="form.mode" required>
            <option value="none">No guardar</option>
            <option value="raw">Raw (cada evento)</option>
            <option value="hourly">Hourly (agregado por hora)</option>
            <option value="both">Both (Raw + Hourly)</option>
          </select>
          <span class="helper">
            <template v-if="form.mode === 'none'">La métrica no se guardará</template>
            <template v-else-if="form.mode === 'raw'">Guarda cada evento individual</template>
            <template v-else-if="form.mode === 'hourly'">Guarda 1 registro por hora (promedio, suma, etc.)</template>
            <template v-else-if="form.mode === 'both'">Guarda raw + agregado por hora</template>
          </span>
        </div>

        <div class="form-field" v-if="showAggregate">
          <label>Agregación</label>
          <select v-model="form.aggregate">
            <option value="last">Último valor (snapshot)</option>
            <option value="avg">Promedio</option>
            <option value="sum">Suma</option>
            <option value="min">Mínimo</option>
            <option value="max">Máximo</option>
          </select>
          <span class="helper">Cómo se calcula el valor horario</span>
        </div>

        <div class="form-field">
          <label>Retención</label>
          <div class="input-with-suffix">
            <input v-model.number="form.retentionDays" type="number" min="1" max="365" />
            <span class="suffix">días</span>
          </div>
          <span class="helper">Tiempo que se mantienen los datos guardados</span>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-ghost" @click="resetForm" v-if="editingId">
            Cancelar
          </button>
          <button 
            type="submit" 
            class="btn-primary"
            :disabled="!selectedTenantId || !form.metricId"
          >
            {{ editingId ? 'Guardar cambios' : 'Crear regla' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Rules List -->
    <div class="list-container">
      <div class="list-header">
        <h3>Reglas activas</h3>
        <select v-model="filterTenantId" class="filter-select">
          <option value="">Todos los tenants</option>
          <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
            {{ tenant.slug }}
          </option>
        </select>
      </div>

      <div v-if="loading" class="empty-state">
        <p>Cargando reglas...</p>
      </div>
      <div v-else-if="filteredRules.length === 0" class="empty-state">
        <p>No hay reglas creadas</p>
      </div>
      <div v-else class="list">
        <div v-for="rule in filteredRules" :key="rule.id" class="list-item">
          <div class="list-item-content">
            <div class="list-item-title-row">
              <span class="badge tenant">{{ rule.tenant?.slug }}</span>
              <span :class="['badge', 'mode-' + rule.mode]">{{ rule.mode }}</span>
              <strong>{{ rule.metricId }}</strong>
            </div>
            <span class="list-item-subtitle">
              Planta: {{ rule.plant?.plantId || 'todas' }} · 
              PLC: {{ rule.plc?.plcThingName || 'todos' }} · 
              Agregado: {{ rule.aggregate || 'last' }} · 
              Retención: {{ rule.retentionDays }}d
            </span>
          </div>
          <div class="list-item-actions">
            <button class="btn-icon" title="Editar" @click="editRule(rule)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn-icon danger" title="Eliminar" @click="deleteRule(rule)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import api from '../services/api';

const props = defineProps({
  tenants: { type: Array, default: () => [] },
});

// Data
const rules = ref([]);
const plants = ref([]);
const plcs = ref([]);
const loading = ref(false);
const error = ref('');
const editingId = ref(null);

// Selectors
const selectedTenantId = ref('');
const selectedPlantId = ref('');
const selectedPlcId = ref('');
const filterTenantId = ref('');

// Form
const form = ref({
  metricId: '',
  mode: 'hourly',
  aggregate: 'avg',
  retentionDays: 30,
});

// Computed
const showAggregate = computed(() => 
  form.value.mode === 'hourly' || form.value.mode === 'both'
);

const filteredPlants = computed(() => 
  plants.value.filter(p => p.tenantId === selectedTenantId.value)
);

// Los PLCs ya vienen filtrados por planta desde la API
const filteredPlcs = computed(() => plcs.value);

const filteredRules = computed(() => {
  if (!filterTenantId.value) return rules.value;
  const tenant = props.tenants.find(t => t.id === filterTenantId.value);
  return rules.value.filter(r => r.tenant?.slug === tenant?.slug);
});

const selectedTenantSlug = computed(() => {
  const tenant = props.tenants.find(t => t.id === selectedTenantId.value);
  return tenant?.slug || '';
});

// API calls
const loadRules = async () => {
  loading.value = true;
  error.value = '';
  try {
    rules.value = await api.getPersistRules({});
  } catch (err) {
    console.error(err);
    error.value = 'No se pudieron cargar las reglas.';
  } finally {
    loading.value = false;
  }
};

const loadPlants = async () => {
  try {
    plants.value = await api.getPlantsAdmin();
  } catch (err) {
    console.error(err);
  }
};

const loadPlcs = async (tenantId, plantId) => {
  if (!tenantId || !plantId) {
    plcs.value = [];
    return;
  }
  try {
    plcs.value = await api.getPlcsAdmin(tenantId, plantId);
  } catch (err) {
    console.error(err);
    plcs.value = [];
  }
};

// Handlers
const handleTenantChange = () => {
  selectedPlantId.value = '';
  selectedPlcId.value = '';
  plcs.value = [];
};

const handlePlantChange = async () => {
  selectedPlcId.value = '';
  if (selectedTenantId.value && selectedPlantId.value) {
    await loadPlcs(selectedTenantId.value, selectedPlantId.value);
  } else {
    plcs.value = [];
  }
};

const resetForm = () => {
  editingId.value = null;
  selectedTenantId.value = '';
  selectedPlantId.value = '';
  selectedPlcId.value = '';
  form.value = {
    metricId: '',
    mode: 'hourly',
    aggregate: 'avg',
    retentionDays: 30,
  };
  plcs.value = [];
};

const editRule = async (rule) => {
  editingId.value = rule.id;
  
  // Find tenant
  const tenant = props.tenants.find(t => t.slug === rule.tenant?.slug);
  selectedTenantId.value = tenant?.id || '';
  
  // Find plant
  if (rule.plantId) {
    const plant = plants.value.find(p => p.id === rule.plantId);
    selectedPlantId.value = plant?.id || '';
    
    // Load PLCs for this plant
    if (selectedTenantId.value && selectedPlantId.value) {
      await loadPlcs(selectedTenantId.value, selectedPlantId.value);
    }
  } else {
    selectedPlantId.value = '';
  }
  
  // Find PLC
  if (rule.plcId) {
    selectedPlcId.value = rule.plcId;
  } else {
    selectedPlcId.value = '';
  }
  
  form.value = {
    metricId: rule.metricId || '',
    mode: rule.mode || 'hourly',
    aggregate: rule.aggregate || 'avg',
    retentionDays: rule.retentionDays || 30,
  };
};

const handleSubmit = async () => {
  if (!selectedTenantSlug.value) {
    error.value = 'Seleccioná un tenant antes de guardar.';
    return;
  }

  // Get the selected PLC for gatewayId
  const selectedPlc = plcs.value.find(p => p.id === selectedPlcId.value);

  // Enviamos siempre UUIDs - contrato claro de API
  const payload = {
    plantId: selectedPlantId.value || null,
    gatewayId: selectedPlc?.gatewayId || null,
    plcId: selectedPlcId.value || null,
    metricId: form.value.metricId,
    mode: form.value.mode,
    aggregate: showAggregate.value ? form.value.aggregate : null,
    retentionDays: form.value.retentionDays,
  };

  try {
    const params = { tenant: selectedTenantSlug.value };
    if (editingId.value) {
      await api.updatePersistRule(editingId.value, payload, params);
    } else {
      await api.createPersistRule(payload, params);
    }
    await loadRules();
    resetForm();
    error.value = '';
  } catch (err) {
    console.error(err);
    error.value = 'No se pudo guardar la regla.';
  }
};

const deleteRule = async (rule) => {
  if (!confirm('¿Eliminar esta regla?')) return;
  try {
    const tenantSlug = rule.tenant?.slug;
    if (!tenantSlug) {
      error.value = 'No se pudo determinar el tenant de la regla.';
      return;
    }
    await api.deletePersistRule(rule.id, { tenant: tenantSlug });
    await loadRules();
  } catch (err) {
    console.error(err);
    error.value = 'No se pudo eliminar la regla.';
  }
};

// Init
onMounted(async () => {
  await loadPlants();
  await loadRules();
});
</script>

<style scoped>
.persist-rules {
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.section-header h1 {
  font-size: 2rem;
  font-weight: 600;
  color: #f5f5f7;
  margin: 0;
  letter-spacing: -0.5px;
}

.section-header p {
  font-size: 0.95rem;
  color: #86868b;
  margin: 0.25rem 0 0 0;
}

/* Form Card */
.form-card {
  background: #0d0d0d;
  border: 1px solid #1d1d1f;
  border-radius: 16px;
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
}

.form-card h3 {
  font-size: 1.1rem;
  font-weight: 500;
  color: #f5f5f7;
  margin: 0 0 1.5rem 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-size: 0.85rem;
  color: #86868b;
  font-weight: 500;
}

.form-field input,
.form-field select {
  height: 44px;
  padding: 0 1rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  color: #f5f5f7;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: #424245;
  background: #252525;
}

.form-field input:disabled,
.form-field select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.form-field input::placeholder {
  color: #48484a;
}

.form-field .helper {
  font-size: 0.75rem;
  color: #48484a;
}

.input-with-suffix {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-with-suffix input {
  flex: 1;
  max-width: 100px;
}

.input-with-suffix .suffix {
  color: #86868b;
  font-size: 0.9rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  grid-column: 1 / -1;
  margin-top: 0.5rem;
}

/* Buttons */
.btn-primary {
  height: 44px;
  padding: 0 1.5rem;
  background: #f5f5f7;
  border: none;
  border-radius: 10px;
  color: #000000;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-primary:hover {
  background: #ffffff;
}

.btn-primary:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 44px;
  padding: 0 1rem;
  background: transparent;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  color: #86868b;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-ghost:hover {
  background: #1d1d1f;
  color: #f5f5f7;
  border-color: #3d3d3d;
}

.btn-icon {
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #48484a;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
}

.list-item:hover .btn-icon {
  opacity: 1;
}

.btn-icon:hover {
  background: #1d1d1f;
  color: #86868b;
}

.btn-icon.danger:hover {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

/* Error */
.error-message {
  padding: 1rem;
  background: rgba(255, 59, 48, 0.1);
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 10px;
  color: #ff3b30;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}

/* List */
.list-container {
  background: #0d0d0d;
  border: 1px solid #1d1d1f;
  border-radius: 16px;
  overflow: hidden;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #1d1d1f;
}

.list-header h3 {
  font-size: 1rem;
  font-weight: 500;
  color: #f5f5f7;
  margin: 0;
}

.filter-select {
  height: 36px;
  padding: 0 0.75rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 8px;
  color: #86868b;
  font-size: 0.8rem;
  min-width: 140px;
}

.list {
  display: flex;
  flex-direction: column;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #1d1d1f;
  transition: background 0.15s ease;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:hover {
  background: #141414;
}

.list-item-content {
  flex: 1;
  min-width: 0;
}

.list-item-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.25rem;
}

.list-item-title-row strong {
  color: #f5f5f7;
  font-size: 0.95rem;
}

.list-item-subtitle {
  display: block;
  font-size: 0.8rem;
  color: #48484a;
}

.list-item-actions {
  display: flex;
  gap: 0.5rem;
}

/* Badges */
.badge {
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
}

.badge.tenant {
  background: rgba(255, 255, 255, 0.1);
  color: #86868b;
}

.badge.mode-none {
  background: rgba(142, 142, 147, 0.2);
  color: #8e8e93;
}

.badge.mode-raw {
  background: rgba(255, 149, 0, 0.2);
  color: #ff9500;
}

.badge.mode-hourly {
  background: rgba(52, 199, 89, 0.2);
  color: #34c759;
}

.badge.mode-both {
  background: rgba(0, 122, 255, 0.2);
  color: #007aff;
}

/* Empty State */
.empty-state {
  padding: 3rem 2rem;
  text-align: center;
}

.empty-state p {
  color: #48484a;
  font-size: 0.95rem;
}

/* Responsive */
@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    gap: 1rem;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .list-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .filter-select {
    width: 100%;
  }

  .list-item-title-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
