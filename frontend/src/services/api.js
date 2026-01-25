import axios from 'axios';
import { getCurrentUser } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const user = getCurrentUser();
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const api = {
  // Health
  async getHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  },

  async getTenantMe() {
    const response = await apiClient.get('/api/tenants/me');
    return response.data;
  },

  async getPublicDashboard(tenantSlug, plantId, plcThingName) {
    const response = await apiClient.get(`/tenants/${tenantSlug}/plants/${plantId}/plcs/${plcThingName}/dashboard`);
    return response.data;
  },

  // Admin access
  async getAdminAccess() {
    const response = await apiClient.get('/api/admin/access');
    return response.data;
  },

  // Admin AI
  async getAIGlobalConfig() {
    const response = await apiClient.get('/api/admin/ai/global-config');
    return response.data;
  },

  async updateAIGlobalConfig(payload) {
    const response = await apiClient.put('/api/admin/ai/global-config', payload);
    return response.data;
  },

  async getAITenantConfig(tenantId) {
    const response = await apiClient.get(`/api/admin/ai/tenants/${tenantId}/config`);
    return response.data;
  },

  async updateAITenantConfig(tenantId, aiConfig) {
    const response = await apiClient.put(`/api/admin/ai/tenants/${tenantId}/config`, { aiConfig });
    return response.data;
  },

  async getAIPlantConfig(plantId) {
    const response = await apiClient.get(`/api/admin/ai/plants/${plantId}/config`);
    return response.data;
  },

  async updateAIPlantConfig(plantId, aiConfig) {
    const response = await apiClient.put(`/api/admin/ai/plants/${plantId}/config`, { aiConfig });
    return response.data;
  },

  async getCompanyOverviewAccess(tenantId) {
    const response = await apiClient.get(`/api/admin/ai/tenants/${tenantId}/company-overview-access`);
    return response.data;
  },

  async addCompanyOverviewEmail(tenantId, email) {
    const response = await apiClient.post(`/api/admin/ai/tenants/${tenantId}/company-overview-access`, { email });
    return response.data;
  },

  async removeCompanyOverviewEmail(tenantId, emailLower) {
    const response = await apiClient.delete(`/api/admin/ai/tenants/${tenantId}/company-overview-access/${encodeURIComponent(emailLower)}`);
    return response.data;
  },

  async getMetricCatalog(tenantId, params = {}) {
    const response = await apiClient.get(`/api/admin/ai/tenants/${tenantId}/metric-catalog`, { params });
    return response.data;
  },

  async updateMetricCatalogEntry(id, payload) {
    const response = await apiClient.put(`/api/admin/ai/metric-catalog/${id}`, payload);
    return response.data;
  },

  async bootstrapMetricCatalog(tenantId) {
    const response = await apiClient.post(`/api/admin/ai/tenants/${tenantId}/metric-catalog/bootstrap`);
    return response.data;
  },

  async regenerateAIPlant(plantId) {
    const response = await apiClient.post(`/api/admin/ai/regenerate/plant/${plantId}`);
    return response.data;
  },

  async regenerateAICompany(tenantId) {
    const response = await apiClient.post(`/api/admin/ai/regenerate/company/${tenantId}`);
    return response.data;
  },

  async getTenants() {
    const response = await apiClient.get('/api/admin/tenants');
    return response.data;
  },

  async createTenant(payload) {
    const response = await apiClient.post('/api/admin/tenants', payload);
    return response.data;
  },

  async updateTenant(tenantId, payload) {
    const response = await apiClient.put(`/api/admin/tenants/${tenantId}`, payload);
    return response.data;
  },

  async deleteTenant(tenantId) {
    const response = await apiClient.delete(`/api/admin/tenants/${tenantId}`);
    return response.data;
  },

  async getPlantsAdmin(params = {}) {
    const response = await apiClient.get('/api/admin/plants', { params });
    return response.data;
  },

  async createPlant(payload) {
    const response = await apiClient.post('/api/admin/plants', payload);
    return response.data;
  },

  async updatePlant(plantId, payload) {
    const response = await apiClient.put(`/api/admin/plants/${plantId}`, payload);
    return response.data;
  },

  async deletePlant(plantId) {
    const response = await apiClient.delete(`/api/admin/plants/${plantId}`);
    return response.data;
  },

  async getPlcsAdmin(tenantId, plantId) {
    const response = await apiClient.get(`/api/admin/tenants/${tenantId}/plants/${plantId}/plcs`);
    return response.data;
  },

  async getAllPlcsAdmin(params = {}) {
    const response = await apiClient.get('/api/admin/plcs', { params });
    return response.data;
  },

  async deletePlc(plcId) {
    const response = await apiClient.delete(`/api/admin/plcs/${plcId}`);
    return response.data;
  },

  async getDashboardByPlc(plcInternalId) {
    const response = await apiClient.get(`/api/admin/plcs/${plcInternalId}/dashboard`);
    return response.data;
  },

  async getPlcStateAdmin(plcInternalId) {
    const response = await apiClient.get(`/api/admin/plcs/${plcInternalId}/state`);
    return response.data;
  },

  async createDashboard(plcInternalId, payload) {
    const response = await apiClient.post(`/api/admin/plcs/${plcInternalId}/dashboard`, payload);
    return response.data;
  },

  async updateDashboard(dashboardId, payload) {
    const response = await apiClient.put(`/api/admin/dashboards/${dashboardId}`, payload);
    return response.data;
  },

  async deleteDashboard(dashboardId) {
    const response = await apiClient.delete(`/api/admin/dashboards/${dashboardId}`);
    return response.data;
  },

  async createDashboardWidget(dashboardId, payload) {
    const response = await apiClient.post(`/api/admin/dashboards/${dashboardId}/widgets`, payload);
    return response.data;
  },

  async updateDashboardWidget(widgetId, payload) {
    const response = await apiClient.put(`/api/admin/widgets/${widgetId}`, payload);
    return response.data;
  },

  async deleteDashboardWidget(widgetId) {
    const response = await apiClient.delete(`/api/admin/widgets/${widgetId}`);
    return response.data;
  },

  async reorderDashboardWidgets(dashboardId, items) {
    const response = await apiClient.post(`/api/admin/dashboards/${dashboardId}/widgets/reorder`, { items });
    return response.data;
  },

  async cloneDashboard(targetPlcId, sourcePlcId) {
    const response = await apiClient.post(`/api/admin/plcs/${targetPlcId}/dashboard/clone-from/${sourcePlcId}`);
    return response.data;
  },

  async getUsersAdmin() {
    const response = await apiClient.get('/api/admin/users');
    return response.data;
  },

  async createUserAdmin(payload) {
    const response = await apiClient.post('/api/admin/users', payload);
    return response.data;
  },

  async updateUserClaims(uid, payload) {
    const response = await apiClient.put(`/api/admin/users/${uid}/claims`, payload);
    return response.data;
  },

  async deleteUser(uid) {
    const response = await apiClient.delete(`/api/admin/users/${uid}`);
    return response.data;
  },

  // PLCs
  async getPlcs() {
    const response = await apiClient.get('/api/plcs');
    return response.data;
  },

  async getPlcsByPlant(plant) {
    const response = await apiClient.get(`/api/plcs/${plant}`);
    return response.data;
  },

  async getPlcsByPlantId(plantId) {
    const response = await apiClient.get(`/api/plcs/by-plant/${plantId}`);
    return response.data;
  },

  async getPlc(plant, plcThingName) {
    const response = await apiClient.get(`/api/plcs/${plant}/${plcThingName}`);
    return response.data;
  },

  async getPlcState(plant, plcThingName) {
    const response = await apiClient.get(`/api/plcs/${plant}/${plcThingName}/state`);
    return response.data;
  },

  // AI (user)
  async getAIPlantInsight(plantId) {
    const response = await apiClient.get(`/api/ai/insights/${plantId}`);
    return response.data;
  },

  async getAICompanyInsight() {
    const response = await apiClient.get(`/api/ai/insights/company`);
    return response.data;
  },

  // Plants (legacy: /sites)
  async getPlants() {
    const response = await apiClient.get('/api/sites');
    return response.data;
  },

  // Telemetry
  async getTelemetry(plant, plcThingName, params = {}) {
    const response = await apiClient.get(`/api/telemetry/${plant}/${plcThingName}`, { params });
    return response.data;
  },

  async getLatestTelemetry(limit = 100) {
    const response = await apiClient.get('/api/telemetry/latest', { params: { limit } });
    return response.data;
  },

  // Alarms
  async getAlarms(params = {}) {
    const response = await apiClient.get('/api/alarms', { params });
    return response.data;
  },

  async getAlarmsForPlc(plant, plcThingName, params = {}) {
    const response = await apiClient.get(`/api/alarms/${plant}/${plcThingName}`, { params });
    return response.data;
  },

  async acknowledgeAlarm(alarmId) {
    const response = await apiClient.post(`/api/alarms/${alarmId}/acknowledge`);
    return response.data;
  },

  // Persist rules (admin)
  async getPersistRules(params = {}) {
    const response = await apiClient.get('/api/persist-rules', { params });
    return response.data;
  },

  async createPersistRule(payload, params = {}) {
    const response = await apiClient.post('/api/persist-rules', payload, { params });
    return response.data;
  },

  async updatePersistRule(id, payload, params = {}) {
    const response = await apiClient.put(`/api/persist-rules/${id}`, payload, { params });
    return response.data;
  },

  async deletePersistRule(id, params = {}) {
    const response = await apiClient.delete(`/api/persist-rules/${id}`, { params });
    return response.data;
  },

  // Chart data - para widgets de gráficos
  /**
   * Obtiene datos formateados para gráficos
   * @param {Object} params
   * @param {string} params.metricId - ID de la métrica (requerido)
   * @param {string} [params.plcId] - UUID del PLC (opcional)
   * @param {string} [params.source='aggregated'] - 'raw' | 'aggregated'
   * @param {string} [params.from] - Fecha inicio ISO string
   * @param {string} [params.to] - Fecha fin ISO string
   * @param {string} [params.groupBy='hour'] - 'minute' | 'hour' | 'day' | 'week' | 'month'
   * @param {string} [params.aggregate='avg'] - 'avg' | 'sum' | 'min' | 'max' | 'last' | 'count'
   * @param {number} [params.limit=100] - Máximo de puntos de datos
   */
  async getChartData(params = {}) {
    const response = await apiClient.get('/api/telemetry/chart-data', { params });
    return response.data;
  },
};

export default api;
