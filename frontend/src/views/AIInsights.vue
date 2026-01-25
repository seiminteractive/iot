<template>
  <div class="ai-insights">
    <header class="header">
      <div>
        <h1>IA</h1>
        <p class="muted">Insights pre-calculados para operar mejor</p>
      </div>
    </header>

    <div class="card">
      <div class="toolbar">
        <h3 class="card-title">Resumen</h3>
        <div class="controls">
          <select v-model="mode" class="select">
            <option value="plant">Planta</option>
            <option v-if="companyAllowed" value="company">Compañía</option>
          </select>
        </div>
      </div>

      <div v-if="mode === 'plant'">
        <EmptyState
          v-if="!selectedPlant?.id"
          title="Elegí una planta"
          subtitle="Seleccioná una planta para ver su reporte de IA."
          hint="Los reportes se generan automáticamente cada cierto tiempo y se guardan en el sistema."
        />
        <div v-else>
          <div v-if="loading" class="muted">Cargando insight de planta...</div>
          <div v-else-if="error" class="error">{{ error }}</div>
          <EmptyState
            v-else-if="isDisabled"
            title="IA desactivada"
            :subtitle="insight?.message || 'La IA no está activa para esta planta.'"
            hint="Un admin supremo puede activarla desde Admin → IA."
          />
          <EmptyState
            v-else-if="isPending"
            title="Todavía no hay reportes"
            :subtitle="insight?.message || 'Estamos preparando el primer reporte.'"
            hint="Cuando el job de IA corra y haya datos, vas a ver el resumen acá."
          />
          <div v-else class="content">
            <h2 class="h2">Resumen General</h2>
            <p class="p">{{ insight.contentJson.summary }}</p>

            <div v-for="plc in (insight.contentJson.byPlc || [])" :key="plc.plcId" class="plc-card">
              <div class="plc-header">
                <span class="plc-name">{{ plc.plcName }}</span>
                <span class="badge" :class="badgeClass(plc.status)">{{ plc.status }}</span>
              </div>
              <ul class="list" v-if="(plc.highlights || []).length">
                <li v-for="(h, idx) in plc.highlights" :key="idx">
                  <strong>{{ h.label }}</strong>: {{ h.value }} <span class="muted">{{ h.trend }}</span>
                </li>
              </ul>
              <ul class="list" v-if="(plc.alerts || []).length">
                <li v-for="(a, idx) in plc.alerts" :key="idx" class="alert">
                  <strong>{{ a.severity }}</strong>: {{ a.description }}
                </li>
              </ul>
              <ul class="list" v-if="(plc.actions || []).length">
                <li v-for="(a, idx) in plc.actions" :key="idx">
                  {{ a }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div v-else>
        <div v-if="loading" class="muted">Cargando resumen de compañía...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <EmptyState
          v-else-if="isDisabled"
          title="Resumen de compañía desactivado"
          :subtitle="insight?.message || 'El resumen de compañía no está habilitado.'"
          hint="Un admin supremo puede habilitarlo y configurar quiénes lo ven (allowlist)."
        />
        <EmptyState
          v-else-if="isPending"
          title="Todavía no hay reportes"
          :subtitle="insight?.message || 'Estamos preparando el primer resumen ejecutivo.'"
          hint="Cuando el job de IA corra, vas a ver el resumen de compañía acá."
        />
        <div v-else class="content">
          <h2 class="h2">Resumen Ejecutivo</h2>
          <p class="p">{{ insight.contentJson.summary }}</p>
          <div v-if="(insight.contentJson.ranking || []).length" class="rank">
            <h2 class="h2">Ranking</h2>
            <ol class="list">
              <li v-for="row in insight.contentJson.ranking" :key="row.plantId">
                <strong>#{{ row.position }} {{ row.plantName }}</strong>
                <span class="badge" :class="badgeClass(row.status)">{{ row.status }}</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import api from '../services/api';

const props = defineProps({
  tenant: Object,
  selectedPlant: Object,
  isAdmin: Boolean,
});

const EmptyState = {
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    hint: { type: String, default: '' },
  },
  template: `
    <div class="empty">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a7 7 0 0 0-4 12.74V17a2 2 0 0 0 2 2h1v3h2v-3h1a2 2 0 0 0 2-2v-2.26A7 7 0 0 0 12 2z"/>
          <path d="M9 17h6"/>
        </svg>
      </div>
      <div class="empty-title">{{ title }}</div>
      <div class="empty-subtitle">{{ subtitle }}</div>
      <div v-if="hint" class="empty-hint">{{ hint }}</div>
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

function badgeClass(status) {
  if (status === 'critical') return 'critical';
  if (status === 'warning') return 'warning';
  return 'ok';
}

async function loadCompanyEligibility() {
  try {
    const res = await api.getAICompanyInsight();
    // If user is allowlisted, endpoint returns 200 even if pending/disabled
    companyAllowed.value = true;
    // If company is disabled, we shouldn't offer the tab to users (per requirements)
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
  loading.value = true;
  try {
    if (mode.value === 'company') {
      const res = await api.getAICompanyInsight();
      insight.value = res;
    } else {
      if (!props.selectedPlant?.id) return;
      const res = await api.getAIPlantInsight(props.selectedPlant.id);
      insight.value = res;
    }
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || 'Error';
    // If company not allowed, fall back to plant mode
    if (mode.value === 'company' && e?.response?.status === 403) {
      companyAllowed.value = false;
      mode.value = 'plant';
      return;
    }
    error.value = msg;
  } finally {
    loading.value = false;
  }
}

watch(() => props.selectedPlant?.id, load, { immediate: true });
watch(mode, load);

void loadCompanyEligibility();
</script>

<style scoped>
.ai-insights {
  padding: 16px 16px 120px;
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header h1 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 2px;
}

.muted {
  color: rgba(255, 255, 255, 0.7);
}

.card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 14px;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.select {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: white;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.content {
  margin-top: 10px;
}

.h2 {
  font-size: 13px;
  margin: 10px 0 6px;
}

.p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}

.plc-card {
  margin-top: 10px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.plc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.plc-name {
  font-weight: 700;
  font-size: 12px;
}

.badge {
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  text-transform: uppercase;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.badge.ok {
  background: rgba(16, 185, 129, 0.15);
  color: rgba(16, 185, 129, 0.95);
}
.badge.warning {
  background: rgba(245, 158, 11, 0.15);
  color: rgba(245, 158, 11, 0.95);
}
.badge.critical {
  background: rgba(239, 68, 68, 0.15);
  color: rgba(239, 68, 68, 0.95);
}

.list {
  margin-top: 8px;
  padding-left: 18px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
  line-height: 1.35;
}

.alert {
  color: rgba(255, 255, 255, 0.9);
}

.error {
  color: rgba(239, 68, 68, 0.95);
  font-size: 12px;
  margin-top: 8px;
}

.empty {
  margin-top: 12px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(0, 0, 0, 0.22);
  display: grid;
  gap: 8px;
  text-align: left;
}
.empty-icon {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.06);
}
.empty-icon svg {
  width: 18px;
  height: 18px;
  color: rgba(255, 255, 255, 0.9);
}
.empty-title {
  font-size: 13px;
  font-weight: 800;
}
.empty-subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.4;
}
.empty-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.4;
}

.kv {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.k {
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
}

.v {
  font-size: 12px;
  font-weight: 600;
}

.hint {
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  line-height: 1.4;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
}
</style>

