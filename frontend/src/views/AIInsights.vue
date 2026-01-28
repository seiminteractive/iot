<template>
  <div class="ai-insights">
    <!-- Header with gradient accent -->
    <header class="header">
      <div class="header-content">
        <div class="header-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h1v3h2v-3h1a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2z"/>
            <circle cx="12" cy="9" r="2"/>
          </svg>
        </div>
        <div>
          <h1>Inteligencia Artificial</h1>
          <p>Análisis y recomendaciones automáticas</p>
        </div>
      </div>
      <div class="header-controls">
        <select 
          v-if="mode === 'plant' && plants.length > 1" 
          :value="currentPlantId" 
          @change="onPlantChange($event.target.value)"
          class="select-modern"
        >
          <option value="" disabled>Seleccionar planta</option>
          <option v-for="p in plants" :key="p.id" :value="p.id">
            {{ p.name || p.plantId }}
          </option>
        </select>
        <select v-if="companyAllowed" v-model="mode" class="select-modern">
          <option value="plant">Vista Planta</option>
          <option value="company">Vista Compañía</option>
        </select>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-shimmer">
        <div class="shimmer-line long"></div>
        <div class="shimmer-line medium"></div>
        <div class="shimmer-line short"></div>
      </div>
      <p class="loading-text">Cargando insights...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p class="error-title">Error al cargar</p>
      <p class="error-message">{{ error }}</p>
    </div>

    <!-- Plant Mode -->
    <div v-else-if="mode === 'plant'">
      <!-- No plant selected -->
      <EmptyState
        v-if="!currentPlantId && plants.length > 1"
        icon="select"
        title="Seleccioná una planta"
        subtitle="Elegí una planta del selector para ver su análisis de IA."
      />
      <!-- No plants assigned -->
      <EmptyState
        v-else-if="!currentPlantId && plants.length === 0"
        icon="lock"
        title="Sin acceso a plantas"
        subtitle="No tenés plantas asignadas. Contactá al administrador."
      />
      <!-- IA Disabled -->
      <EmptyState
        v-else-if="isDisabled"
        icon="off"
        title="IA no activa"
        :subtitle="insight?.message || 'La inteligencia artificial no está habilitada para esta planta.'"
      />
      <!-- Pending -->
      <EmptyState
        v-else-if="isPending"
        icon="pending"
        title="Preparando análisis"
        :subtitle="insight?.message || 'El primer reporte se está generando. Volvé pronto.'"
      />
      <!-- Content -->
      <div v-else-if="insight?.contentJson" class="insight-content">
        <!-- Summary Card -->
        <div class="summary-card">
          <div class="summary-header">
            <div class="summary-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div>
              <h2>Resumen General</h2>
              <span class="summary-meta">Generado automáticamente</span>
            </div>
          </div>
          <p class="summary-text">{{ insight.contentJson.summary }}</p>
        </div>

        <!-- PLC Cards -->
        <div class="plc-grid">
          <div 
            v-for="plc in (insight.contentJson.byPlc || [])" 
            :key="plc.plcId" 
            class="plc-card"
          >
            <div class="plc-header">
              <div class="plc-info">
                <div class="plc-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="4" y="4" width="16" height="16" rx="2"/>
                    <path d="M9 9h6M9 13h6M9 17h4"/>
                  </svg>
                </div>
                <span class="plc-name">{{ plc.plcName }}</span>
              </div>
              <span class="status-badge" :class="statusClass(plc.status)">
                <span class="status-dot"></span>
                {{ statusLabel(plc.status) }}
              </span>
            </div>

            <!-- Highlights -->
            <div v-if="(plc.highlights || []).length" class="plc-section">
              <h4 class="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Métricas destacadas
              </h4>
              <div class="metrics-grid">
                <div v-for="(h, idx) in plc.highlights" :key="idx" class="metric-item">
                  <span class="metric-label">{{ h.label }}</span>
                  <span class="metric-value">{{ h.value }}</span>
                  <span v-if="h.trend" class="metric-trend" :class="trendClass(h.trend)">
                    {{ h.trend }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Alerts -->
            <div v-if="(plc.alerts || []).length" class="plc-section">
              <h4 class="section-title alerts-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Alertas
              </h4>
              <div class="alerts-list">
                <div v-for="(a, idx) in plc.alerts" :key="idx" class="alert-item" :class="alertClass(a.severity)">
                  <span class="alert-severity">{{ a.severity }}</span>
                  <span class="alert-desc">{{ a.description }}</span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div v-if="(plc.actions || []).length" class="plc-section">
              <h4 class="section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                Acciones recomendadas
              </h4>
              <ul class="actions-list">
                <li v-for="(action, idx) in plc.actions" :key="idx">{{ action }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Company Mode -->
    <div v-else>
      <EmptyState
        v-if="isDisabled"
        icon="off"
        title="Vista de compañía no activa"
        :subtitle="insight?.message || 'El resumen ejecutivo no está habilitado.'"
      />
      <EmptyState
        v-else-if="isPending"
        icon="pending"
        title="Preparando resumen ejecutivo"
        :subtitle="insight?.message || 'El primer análisis de compañía se está generando.'"
      />
      <div v-else-if="insight?.contentJson" class="insight-content">
        <!-- Executive Summary -->
        <div class="summary-card executive">
          <div class="summary-header">
            <div class="summary-icon executive-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 21V8l7-5 7 5v13"/>
                <path d="M9 21V12h6v9"/>
              </svg>
            </div>
            <div>
              <h2>Resumen Ejecutivo</h2>
              <span class="summary-meta">Panorama general de la compañía</span>
            </div>
          </div>
          <p class="summary-text">{{ insight.contentJson.summary }}</p>
        </div>

        <!-- Ranking -->
        <div v-if="(insight.contentJson.ranking || []).length" class="ranking-card">
          <h3 class="ranking-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 15l-2 5-2-5 2-3 2 3z"/>
              <path d="M12 2v13"/>
              <path d="M20 12l-8 3-8-3"/>
            </svg>
            Ranking de Plantas
          </h3>
          <div class="ranking-list">
            <div 
              v-for="(row, idx) in insight.contentJson.ranking" 
              :key="row.plantId" 
              class="ranking-item"
              :class="{ 'top-three': idx < 3 }"
            >
              <div class="rank-position" :class="'rank-' + (idx + 1)">
                {{ row.position || idx + 1 }}
              </div>
              <div class="rank-info">
                <span class="rank-name">{{ row.plantName }}</span>
              </div>
              <span class="status-badge" :class="statusClass(row.status)">
                <span class="status-dot"></span>
                {{ statusLabel(row.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import api from '../services/api';

const props = defineProps({
  tenant: Object,
  plants: { type: Array, default: () => [] },
  selectedPlant: Object,
  isAdmin: Boolean,
});

const emit = defineEmits(['update:selectedPlant']);

const currentPlantId = computed(() => props.selectedPlant?.id || '');

function onPlantChange(plantId) {
  const plant = props.plants.find(p => p.id === plantId);
  if (plant) {
    emit('update:selectedPlant', plant);
  }
}

onMounted(() => {
  if (props.plants.length === 1 && !props.selectedPlant?.id) {
    emit('update:selectedPlant', props.plants[0]);
  }
});

watch(() => props.plants, (newPlants) => {
  if (newPlants.length === 1 && !props.selectedPlant?.id) {
    emit('update:selectedPlant', newPlants[0]);
  }
}, { immediate: true });

const EmptyState = {
  props: {
    icon: { type: String, default: 'default' },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
  },
  template: `
    <div class="empty-state">
      <div class="empty-icon-wrapper">
        <svg v-if="icon === 'select'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
        <svg v-else-if="icon === 'lock'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        <svg v-else-if="icon === 'off'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <svg v-else-if="icon === 'pending'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h1v3h2v-3h1a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2z"/>
        </svg>
      </div>
      <h3 class="empty-title">{{ title }}</h3>
      <p class="empty-subtitle">{{ subtitle }}</p>
    </div>
  `,
};

const mode = ref('plant');
const loading = ref(false);
const error = ref('');
const insight = ref(null);
const companyAllowed = ref(false);

const isPending = computed(() => insight.value && insight.value.status === 'pending');
const isDisabled = computed(() => insight.value && insight.value.status === 'disabled');

function statusClass(status) {
  if (status === 'critical') return 'status-critical';
  if (status === 'warning') return 'status-warning';
  return 'status-ok';
}

function statusLabel(status) {
  if (status === 'critical') return 'Crítico';
  if (status === 'warning') return 'Atención';
  return 'Normal';
}

function trendClass(trend) {
  if (trend?.includes('↑') || trend?.includes('subió')) return 'trend-up';
  if (trend?.includes('↓') || trend?.includes('bajó')) return 'trend-down';
  return 'trend-neutral';
}

function alertClass(severity) {
  if (severity?.toLowerCase() === 'critical' || severity?.toLowerCase() === 'crítico') return 'alert-critical';
  if (severity?.toLowerCase() === 'warning' || severity?.toLowerCase() === 'advertencia') return 'alert-warning';
  return 'alert-info';
}

async function loadCompanyEligibility() {
  try {
    const res = await api.getAICompanyInsight();
    companyAllowed.value = true;
    if (res?.status === 'disabled') {
      companyAllowed.value = false;
    }
  } catch (e) {
    companyAllowed.value = false;
  }
}

async function load() {
  error.value = '';
  insight.value = null;
  
  if (mode.value === 'company') {
    loading.value = true;
    try {
      const res = await api.getAICompanyInsight();
      insight.value = res;
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Error';
      if (e?.response?.status === 403) {
        companyAllowed.value = false;
        mode.value = 'plant';
        return;
      }
      error.value = msg;
    } finally {
      loading.value = false;
    }
  } else {
    const plantId = props.selectedPlant?.id;
    if (!plantId) {
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      const res = await api.getAIPlantInsight(plantId);
      insight.value = res;
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Error';
      error.value = msg;
    } finally {
      loading.value = false;
    }
  }
}

watch(() => props.selectedPlant?.id, load, { immediate: true });
watch(mode, load);

void loadCompanyEligibility();
</script>

<style scoped>
.ai-insights {
  padding: 20px;
  padding-bottom: 120px;
  max-width: 900px;
  margin: 0 auto;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%);
  border: 1px solid rgba(139, 92, 246, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-icon svg {
  width: 24px;
  height: 24px;
  color: rgba(167, 139, 250, 0.95);
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.02em;
  margin: 0;
}

.header p {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 2px 0 0;
}

.header-controls {
  display: flex;
  gap: 10px;
}

.select-modern {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.select-modern:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.select-modern:focus {
  border-color: rgba(139, 92, 246, 0.5);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
}

/* Loading State */
.loading-state {
  padding: 48px 24px;
  text-align: center;
}

.loading-shimmer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.shimmer-line {
  height: 16px;
  background: linear-gradient(90deg, rgba(255,255,255,0.06) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
  margin: 0 auto;
}

.shimmer-line.long { width: 80%; }
.shimmer-line.medium { width: 60%; }
.shimmer-line.short { width: 40%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.loading-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
}

/* Error State */
.error-state {
  padding: 48px 24px;
  text-align: center;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 16px;
}

.error-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-icon svg {
  width: 24px;
  height: 24px;
  color: #ef4444;
}

.error-title {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
}

.error-message {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}

/* Empty State */
.empty-state {
  padding: 64px 24px;
  text-align: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
}

.empty-icon-wrapper {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-icon-wrapper svg {
  width: 28px;
  height: 28px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 8px;
}

.empty-subtitle {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  max-width: 320px;
  margin: 0 auto;
  line-height: 1.5;
}

/* Insight Content */
.insight-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Summary Card */
.summary-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 24px;
}

.summary-card.executive {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%);
  border-color: rgba(139, 92, 246, 0.2);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.summary-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.summary-icon svg {
  width: 22px;
  height: 22px;
  color: rgba(255, 255, 255, 0.7);
}

.summary-icon.executive-icon {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
}

.summary-icon.executive-icon svg {
  color: rgba(167, 139, 250, 0.95);
}

.summary-header h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.summary-meta {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.summary-text {
  font-size: 0.95rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

/* PLC Grid */
.plc-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plc-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 20px;
  transition: all 0.2s ease;
}

.plc-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.plc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.plc-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plc-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.plc-icon svg {
  width: 18px;
  height: 18px;
  color: rgba(255, 255, 255, 0.6);
}

.plc-name {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-ok {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
.status-ok .status-dot { background: #10b981; }

.status-warning {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}
.status-warning .status-dot { background: #f59e0b; }

.status-critical {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}
.status-critical .status-dot { background: #ef4444; }

/* PLC Sections */
.plc-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 12px;
}

.section-title svg {
  width: 14px;
  height: 14px;
}

.alerts-title {
  color: rgba(245, 158, 11, 0.9);
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.metric-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.metric-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #ffffff;
}

.metric-trend {
  font-size: 0.7rem;
  font-weight: 500;
}

.trend-up { color: #10b981; }
.trend-down { color: #ef4444; }
.trend-neutral { color: rgba(255, 255, 255, 0.5); }

/* Alerts List */
.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 0.85rem;
}

.alert-critical {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.alert-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.alert-info {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.alert-severity {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
}

.alert-desc {
  color: rgba(255, 255, 255, 0.85);
  flex: 1;
}

/* Actions List */
.actions-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions-list li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(16, 185, 129, 0.06);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 10px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
}

.actions-list li::before {
  content: '→';
  color: #10b981;
  font-weight: 700;
}

/* Ranking Card */
.ranking-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 24px;
}

.ranking-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 20px;
}

.ranking-title svg {
  width: 20px;
  height: 20px;
  color: rgba(167, 139, 250, 0.8);
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  transition: all 0.2s ease;
}

.ranking-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.ranking-item.top-three {
  background: rgba(139, 92, 246, 0.06);
  border-color: rgba(139, 92, 246, 0.15);
}

.rank-position {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
}

.rank-1 {
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  color: #000;
}

.rank-2 {
  background: linear-gradient(135deg, #c0c0c0 0%, #a8a8a8 100%);
  color: #000;
}

.rank-3 {
  background: linear-gradient(135deg, #cd7f32 0%, #b5651d 100%);
  color: #fff;
}

.rank-info {
  flex: 1;
}

.rank-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #ffffff;
}

/* Responsive */
@media (max-width: 640px) {
  .ai-insights {
    padding: 16px;
    padding-bottom: 100px;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-controls {
    width: 100%;
  }

  .select-modern {
    flex: 1;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
