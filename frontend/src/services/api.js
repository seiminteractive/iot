import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const api = {
  // Health
  async getHealth() {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // Machines
  async getMachines() {
    const response = await apiClient.get('/api/machines');
    return response.data;
  },

  async getMachinesBySite(site) {
    const response = await apiClient.get(`/api/machines/${site}`);
    return response.data;
  },

  async getMachine(site, machineId) {
    const response = await apiClient.get(`/api/machines/${site}/${machineId}`);
    return response.data;
  },

  async getMachineState(site, machineId) {
    const response = await apiClient.get(`/api/machines/${site}/${machineId}/state`);
    return response.data;
  },

  // Sites
  async getSites() {
    const response = await apiClient.get('/api/sites');
    return response.data;
  },

  // Telemetry
  async getTelemetry(site, machineId, params = {}) {
    const response = await apiClient.get(`/api/telemetry/${site}/${machineId}`, { params });
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

  async getAlarmsForMachine(site, machineId, params = {}) {
    const response = await apiClient.get(`/api/alarms/${site}/${machineId}`, { params });
    return response.data;
  },

  async acknowledgeAlarm(alarmId) {
    const response = await apiClient.post(`/api/alarms/${alarmId}/acknowledge`);
    return response.data;
  },
};

export default api;
