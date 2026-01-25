<template>
  <div class="ai-admin">
    <header class="section-header">
      <div>
        <h1>IA</h1>
        <p>Configuración de Insights (system prompt, catálogo, reportes de planta y compañía)</p>
      </div>
      <button class="btn-ghost" @click="refreshAll" :disabled="loading.global || loading.tenant">
        Actualizar
      </button>
    </header>

    <!-- Global -->
    <div class="card-group">
      <div class="card-header">
        <h3>Configuración Global</h3>
        <p class="card-desc">Controles maestros del módulo de IA</p>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Módulo de IA</span>
          <span class="setting-hint">Activa o desactiva la generación de reportes para todo el sistema</span>
        </div>
        <label class="toggle-label">
          <input type="checkbox" class="toggle-input" v-model="globalEnabled" />
          <span class="toggle-switch"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Versión del prompt</span>
          <span class="setting-hint">Incrementar al modificar el system prompt</span>
        </div>
        <input class="compact-input" v-model="globalForm.ai_system_prompt_v" placeholder="1" />
      </div>

      <div class="prompt-section">
        <label class="prompt-label">System Prompt</label>
        <textarea 
          v-model="globalForm.ai_system_prompt" 
          rows="5" 
          placeholder="Eres un asistente experto en análisis industrial e IoT..."
          class="prompt-textarea"
        ></textarea>
      </div>

      <div class="card-footer">
        <button class="btn-primary" @click="saveGlobal" :disabled="loading.global">
          Guardar
        </button>
      </div>
    </div>

    <!-- Tenant -->
    <div class="card-group">
      <div class="card-header">
        <h3>Configuración por Tenant</h3>
        <p class="card-desc">Seleccioná un tenant para configurar IA, reportes y métricas</p>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Tenant</span>
        </div>
        <select v-model="selectedTenantId" class="select-compact">
          <option value="" disabled>Seleccionar...</option>
          <option v-for="t in tenants" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </div>

      <div v-if="!selectedTenantId" class="empty-state-inline">
        <p>Seleccioná un tenant para continuar</p>
      </div>

      <template v-else>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">IA habilitada</span>
            <span class="setting-hint">Activa la generación de reportes para este tenant</span>
          </div>
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" v-model="tenantForm.enabled" />
            <span class="toggle-switch"></span>
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Reporte de compañía</span>
            <span class="setting-hint">Genera un resumen ejecutivo global</span>
          </div>
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" v-model="tenantForm.companyEnabled" />
            <span class="toggle-switch"></span>
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Frecuencia de actualización</span>
          </div>
          <select v-model="tenantForm.companyRefreshInterval" class="select-compact">
            <option value="every12h">Cada 12 horas</option>
            <option value="every24h">Cada 24 horas</option>
            <option value="every2d">Cada 2 días</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quincenal</option>
          </select>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Modelo de IA</span>
          </div>
          <input class="compact-input wide" v-model="tenantForm.defaultModel" placeholder="gpt-4o-mini" />
        </div>

        <div class="prompt-section">
          <label class="prompt-label">Prompt para reporte de compañía</label>
          <textarea 
            v-model="tenantForm.companyPrompt" 
            rows="4" 
            placeholder="Genera un resumen ejecutivo con los KPIs más relevantes..."
            class="prompt-textarea"
          ></textarea>
        </div>

        <div class="card-footer">
          <button class="btn-ghost" @click="regenerateCompany" :disabled="loading.regen || !tenantForm.companyEnabled">
            Regenerar reporte
          </button>
          <button class="btn-primary" @click="saveTenant" :disabled="loading.tenant">
            Guardar
          </button>
        </div>
      </template>
    </div>

    <!-- Allowlist -->
    <div class="card-group" v-if="selectedTenantId">
      <div class="card-header">
        <h3>Acceso al reporte de compañía</h3>
        <p class="card-desc">Emails autorizados a ver el resumen ejecutivo</p>
      </div>

      <div class="setting-row">
        <input v-model="newEmail" placeholder="email@empresa.com" class="input-inline" />
        <button class="btn-primary btn-sm" @click="addEmail" :disabled="!newEmail || loading.allowlist">
          Agregar
        </button>
      </div>

      <div v-if="allowlist.length === 0" class="empty-state-inline">
        <p>No hay emails autorizados</p>
      </div>
      <div v-else class="email-list">
        <div v-for="row in allowlist" :key="row.id" class="email-row">
          <span class="email-text">{{ row.emailLower }}</span>
          <button class="btn-icon-danger" @click="removeEmail(row.emailLower)" :disabled="loading.allowlist">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Metric Catalog -->
    <div class="card-group" v-if="selectedTenantId">
      <div class="card-header">
        <div>
          <h3>Catálogo de Métricas</h3>
          <p class="card-desc">Configura qué métricas incluir en los reportes de IA</p>
        </div>
        <button class="btn-ghost btn-sm" @click="bootstrapCatalog" :disabled="loading.catalog">
          Importar métricas
        </button>
      </div>

      <div v-if="catalog.length === 0" class="empty-state-inline">
        <p>No hay métricas. Usá "Importar métricas" para cargar desde las reglas existentes.</p>
      </div>
      <div v-else class="metric-list">
        <div v-for="m in catalog" :key="m.id" class="metric-item">
          <div class="metric-main">
            <div class="metric-info">
              <span class="metric-name">{{ m.label }}</span>
              <span class="metric-key">{{ m.metricId }}</span>
            </div>
            <div class="metric-controls">
              <div class="metric-field-inline">
                <label>Label</label>
                <input v-model="m._editLabel" />
              </div>
              <div class="metric-field-inline narrow">
                <label>Prioridad</label>
                <input v-model.number="m._editPriority" type="number" />
              </div>
            </div>
          </div>
          <div class="metric-actions">
            <div class="metric-toggles-row">
              <label class="mini-toggle" :class="{ active: m._editEnabled }">
                <input type="checkbox" v-model="m._editEnabled" />
                <span>IA</span>
              </label>
              <template v-if="m._editEnabled">
                <label class="mini-toggle" :class="{ active: m._editKeyForCEO }">
                  <input type="checkbox" v-model="m._editKeyForCEO" />
                  <span>CEO</span>
                </label>
                <label class="mini-toggle" :class="{ active: m._editKeyForPlant }">
                  <input type="checkbox" v-model="m._editKeyForPlant" />
                  <span>Planta</span>
                </label>
              </template>
            </div>
            <button class="btn-primary btn-sm" @click="saveMetric(m)" :disabled="loading.catalog">
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Plant config -->
    <div class="card-group" v-if="selectedTenantId">
      <div class="card-header">
        <h3>Configuración por Planta</h3>
        <p class="card-desc">Activa IA y configura el reporte para cada planta</p>
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">Planta</span>
        </div>
        <select v-model="selectedPlantId" class="select-compact">
          <option value="" disabled>Seleccionar...</option>
          <option v-for="p in plantsForTenant" :key="p.id" :value="p.id">
            {{ p.name || p.plantId }} · {{ p.province }}
          </option>
        </select>
      </div>

      <div v-if="!selectedPlantId" class="empty-state-inline">
        <p>Seleccioná una planta para configurar</p>
      </div>

      <div v-else-if="loading.plant" class="empty-state-inline">
        <p>Cargando...</p>
      </div>

      <template v-else>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">IA habilitada</span>
            <span class="setting-hint">Genera reportes automáticos para esta planta</span>
          </div>
          <label class="toggle-label">
            <input type="checkbox" class="toggle-input" v-model="plantForm.enabled" />
            <span class="toggle-switch"></span>
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Frecuencia de actualización</span>
          </div>
          <select v-model="plantForm.refreshInterval" class="select-compact">
            <option value="every6h">Cada 6 horas</option>
            <option value="every12h">Cada 12 horas</option>
            <option value="every24h">Cada 24 horas</option>
            <option value="every2d">Cada 2 días</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Métricas a incluir</span>
            <span class="setting-hint">Cantidad de métricas top por prioridad</span>
          </div>
          <input class="compact-input" v-model.number="plantForm.metricOverrides.topN" type="number" min="1" />
        </div>

        <div class="prompt-section">
          <label class="prompt-label">Prompt del reporte</label>
          <textarea 
            v-model="plantForm.prompt" 
            rows="4" 
            placeholder="Genera un reporte operativo por PLC con alertas y recomendaciones..."
            class="prompt-textarea"
          ></textarea>
        </div>

        <div class="card-footer">
          <button class="btn-ghost" @click="regeneratePlant" :disabled="loading.regen || !plantForm.enabled">
            Regenerar reporte
          </button>
          <button class="btn-primary" @click="savePlant" :disabled="loading.plant">
            Guardar
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import api from '../services/api';

const props = defineProps({
  tenants: { type: Array, default: () => [] },
  plants: { type: Array, default: () => [] },
});

const selectedTenantId = ref('');
const selectedPlantId = ref('');

const loading = ref({
  global: false,
  tenant: false,
  allowlist: false,
  catalog: false,
  plant: false,
  regen: false,
});

const globalForm = ref({
  ai_enabled: 'false',
  ai_system_prompt_v: '1',
  ai_system_prompt: '',
});

// Computed for toggle (string 'true'/'false' -> boolean)
const globalEnabled = computed({
  get: () => globalForm.value.ai_enabled === 'true',
  set: (v) => { globalForm.value.ai_enabled = v ? 'true' : 'false'; },
});

const tenantForm = ref({
  enabled: false,
  companyEnabled: false,
  companyRefreshInterval: 'weekly',
  defaultModel: 'gpt-4o-mini',
  companyPrompt: '',
});

const allowlist = ref([]);
const newEmail = ref('');
const catalog = ref([]);

const plantForm = ref({
  enabled: false,
  refreshInterval: 'every12h',
  metricOverrides: { topN: 12 },
  prompt: '',
});

const plantsForTenant = computed(() => props.plants.filter((p) => p.tenantId === selectedTenantId.value));

function hydrateCatalogRows(rows) {
  return rows.map((m) => ({
    ...m,
    _editLabel: m.label,
    _editUnit: m.unit || '',
    _editPriority: m.aiPriority,
    _editEnabled: m.enabledForAI,
    _editKeyForCEO: m.keyForCEO,
    _editKeyForPlant: m.keyForPlant,
  }));
}

async function refreshGlobal() {
  loading.value.global = true;
  try {
    const data = await api.getAIGlobalConfig();
    globalForm.value.ai_enabled = data.ai_enabled ?? 'false';
    globalForm.value.ai_system_prompt = data.ai_system_prompt ?? '';
    globalForm.value.ai_system_prompt_v = data.ai_system_prompt_v ?? '1';
  } finally {
    loading.value.global = false;
  }
}

async function saveGlobal() {
  loading.value.global = true;
  try {
    await api.updateAIGlobalConfig(globalForm.value);
  } finally {
    loading.value.global = false;
  }
}

async function loadTenant() {
  if (!selectedTenantId.value) return;
  loading.value.tenant = true;
  try {
    const { aiConfig } = await api.getAITenantConfig(selectedTenantId.value);
    const cfg = aiConfig || {};
    tenantForm.value.enabled = cfg.enabled === true;
    tenantForm.value.companyEnabled = cfg.companyEnabled === true;
    tenantForm.value.companyRefreshInterval = cfg.companyRefreshInterval || 'weekly';
    tenantForm.value.defaultModel = cfg.defaultModel || 'gpt-4o-mini';
    tenantForm.value.companyPrompt = cfg.companyPrompt || '';

    loading.value.allowlist = true;
    allowlist.value = await api.getCompanyOverviewAccess(selectedTenantId.value);
    loading.value.allowlist = false;

    loading.value.catalog = true;
    const rows = await api.getMetricCatalog(selectedTenantId.value);
    catalog.value = hydrateCatalogRows(rows);
    loading.value.catalog = false;
  } finally {
    loading.value.tenant = false;
  }
}

async function saveTenant() {
  if (!selectedTenantId.value) return;
  loading.value.tenant = true;
  try {
    await api.updateAITenantConfig(selectedTenantId.value, {
      enabled: tenantForm.value.enabled,
      companyEnabled: tenantForm.value.companyEnabled,
      companyRefreshInterval: tenantForm.value.companyRefreshInterval,
      defaultModel: tenantForm.value.defaultModel,
      companyPrompt: tenantForm.value.companyPrompt,
      profiles: { plant: { topN: 12 } },
    });
  } finally {
    loading.value.tenant = false;
  }
}

async function addEmail() {
  if (!selectedTenantId.value || !newEmail.value) return;
  loading.value.allowlist = true;
  try {
    await api.addCompanyOverviewEmail(selectedTenantId.value, newEmail.value);
    newEmail.value = '';
    allowlist.value = await api.getCompanyOverviewAccess(selectedTenantId.value);
  } finally {
    loading.value.allowlist = false;
  }
}

async function removeEmail(emailLower) {
  if (!selectedTenantId.value) return;
  loading.value.allowlist = true;
  try {
    await api.removeCompanyOverviewEmail(selectedTenantId.value, emailLower);
    allowlist.value = await api.getCompanyOverviewAccess(selectedTenantId.value);
  } finally {
    loading.value.allowlist = false;
  }
}

async function bootstrapCatalog() {
  if (!selectedTenantId.value) return;
  loading.value.catalog = true;
  try {
    await api.bootstrapMetricCatalog(selectedTenantId.value);
    const rows = await api.getMetricCatalog(selectedTenantId.value);
    catalog.value = hydrateCatalogRows(rows);
  } finally {
    loading.value.catalog = false;
  }
}

async function saveMetric(m) {
  loading.value.catalog = true;
  try {
    await api.updateMetricCatalogEntry(m.id, {
      label: m._editLabel,
      unit: m._editUnit || null,
      aiPriority: Number.isFinite(m._editPriority) ? m._editPriority : 0,
      enabledForAI: !!m._editEnabled,
      keyForCEO: !!m._editKeyForCEO,
      keyForPlant: !!m._editKeyForPlant,
    });
  } finally {
    loading.value.catalog = false;
  }
}

async function loadPlantConfig() {
  if (!selectedPlantId.value) return;
  loading.value.plant = true;
  try {
    const { aiConfig } = await api.getAIPlantConfig(selectedPlantId.value);
    const cfg = aiConfig || {};
    plantForm.value.enabled = cfg.enabled === true;
    plantForm.value.refreshInterval = cfg.refreshInterval || 'every12h';
    plantForm.value.metricOverrides = cfg.metricOverrides || { topN: 12 };
    plantForm.value.prompt = cfg.prompt || '';
  } finally {
    loading.value.plant = false;
  }
}

async function savePlant() {
  if (!selectedPlantId.value) return;
  loading.value.plant = true;
  try {
    await api.updateAIPlantConfig(selectedPlantId.value, {
      enabled: plantForm.value.enabled,
      refreshInterval: plantForm.value.refreshInterval,
      metricOverrides: plantForm.value.metricOverrides,
      prompt: plantForm.value.prompt,
    });
  } finally {
    loading.value.plant = false;
  }
}

async function regeneratePlant() {
  if (!selectedPlantId.value) return;
  loading.value.regen = true;
  try {
    await api.regenerateAIPlant(selectedPlantId.value);
  } finally {
    loading.value.regen = false;
  }
}

async function regenerateCompany() {
  if (!selectedTenantId.value) return;
  loading.value.regen = true;
  try {
    await api.regenerateAICompany(selectedTenantId.value);
  } finally {
    loading.value.regen = false;
  }
}

async function refreshAll() {
  await refreshGlobal();
  await loadTenant();
}

watch(selectedTenantId, async () => {
  selectedPlantId.value = '';
  await loadTenant();
});

watch(selectedPlantId, async () => {
  if (selectedPlantId.value) {
    await loadPlantConfig();
  }
});

onMounted(() => {
  void refreshGlobal();
});
</script>

<style scoped>
/* Card Group - Apple Settings Style */
.card-group {
  background: #0d0d0d;
  border: 1px solid #1d1d1f;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 2rem;
}

.card-header {
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.card-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #f5f5f7;
  margin: 0;
}

.card-desc {
  font-size: 0.8rem;
  color: #86868b;
  margin-top: 0.2rem;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  gap: 1rem;
}

.setting-row:last-of-type {
  border-bottom: none;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-size: 0.9rem;
  color: #f5f5f7;
  font-weight: 500;
}

.setting-hint {
  display: block;
  font-size: 0.75rem;
  color: #86868b;
  margin-top: 0.15rem;
}

.compact-input {
  width: 80px;
  height: 36px;
  padding: 0 0.75rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 8px;
  color: #f5f5f7;
  font-size: 0.9rem;
  text-align: center;
}

.compact-input:focus {
  outline: none;
  border-color: #424245;
  background: #252525;
}

.prompt-section {
  padding: 1rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.prompt-label {
  display: block;
  font-size: 0.75rem;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.prompt-textarea {
  width: 100%;
  padding: 0.75rem 1rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  color: #f5f5f7;
  font-size: 0.85rem;
  line-height: 1.5;
  resize: vertical;
  min-height: 100px;
}

.prompt-textarea:focus {
  outline: none;
  border-color: #424245;
  background: #252525;
}

.prompt-textarea::placeholder {
  color: #48484a;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid #1d1d1f;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

/* Compact select */
.select-compact {
  min-width: 160px;
  height: 36px;
  padding: 0 0.75rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 8px;
  color: #f5f5f7;
  font-size: 0.85rem;
  cursor: pointer;
}

.select-compact:focus {
  outline: none;
  border-color: #424245;
}

.compact-input.wide {
  width: 140px;
  text-align: left;
}

/* Empty state inline */
.empty-state-inline {
  padding: 1.5rem 1.25rem;
  text-align: center;
}

.empty-state-inline p {
  color: #48484a;
  font-size: 0.85rem;
  margin: 0;
}

/* Input inline */
.input-inline {
  flex: 1;
  height: 36px;
  padding: 0 0.75rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 8px;
  color: #f5f5f7;
  font-size: 0.85rem;
}

.input-inline:focus {
  outline: none;
  border-color: #424245;
}

/* Button variants */
.btn-sm {
  height: 32px;
  padding: 0 0.875rem;
  font-size: 0.8rem;
}

.btn-icon-danger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #48484a;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-icon-danger:hover {
  background: rgba(255, 59, 48, 0.15);
  color: #ff453a;
}

/* Email list */
.email-list {
  padding: 0;
}

.email-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.email-row:last-child {
  border-bottom: none;
}

.email-text {
  font-size: 0.85rem;
  color: #f5f5f7;
}

/* Metric list */
.metric-list {
  padding: 0;
}

.metric-item {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.metric-item:last-child {
  border-bottom: none;
}

.metric-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.metric-info {
  flex: 1;
  min-width: 0;
}

.metric-name {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #f5f5f7;
}

.metric-key {
  display: block;
  font-size: 0.7rem;
  color: #48484a;
  margin-top: 0.15rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric-controls {
  display: flex;
  gap: 0.75rem;
}

.metric-field-inline {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.metric-field-inline label {
  font-size: 0.65rem;
  color: #86868b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.metric-field-inline input {
  width: 200px;
  height: 32px;
  padding: 0 0.625rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 6px;
  color: #f5f5f7;
  font-size: 0.8rem;
}

.metric-field-inline.narrow input {
  width: 70px;
  text-align: center;
}

.metric-field-inline input:focus {
  outline: none;
  border-color: #424245;
}

.metric-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metric-toggles-row {
  display: flex;
  gap: 0.5rem;
}

.mini-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.625rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-toggle input {
  display: none;
}

.mini-toggle span {
  font-size: 0.75rem;
  color: #86868b;
  user-select: none;
}

.mini-toggle.active {
  background: rgba(52, 199, 89, 0.15);
  border-color: rgba(52, 199, 89, 0.3);
}

.mini-toggle.active span {
  color: #34c759;
}

.mini-toggle:hover {
  border-color: #424245;
}


/* Toggle */
.toggle-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.toggle-input {
  display: none;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background: #2d2d2d;
  border-radius: 12px;
  transition: background 0.2s ease;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 20px;
  height: 20px;
  background: #86868b;
  border-radius: 50%;
  transition: transform 0.2s ease, background 0.2s ease;
}

.toggle-input:checked + .toggle-switch {
  background: #34c759;
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(20px);
  background: #ffffff;
}
</style>

