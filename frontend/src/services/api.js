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

  // Machines
  async getMachines() {
    const response = await apiClient.get('/api/machines');
    return response.data;
  },

  async getMachinesByPlant(plant) {
    const response = await apiClient.get(`/api/machines/${plant}`);
    return response.data;
  },

  async getMachine(plant, machineId) {
    const response = await apiClient.get(`/api/machines/${plant}/${machineId}`);
    return response.data;
  },

  async getMachineState(plant, machineId) {
    const response = await apiClient.get(`/api/machines/${plant}/${machineId}/state`);
    return response.data;
  },

  // Plants (legacy: /sites)
  async getPlants() {
    const response = await apiClient.get('/api/sites');
    return response.data;
  },

  // Telemetry
  async getTelemetry(plant, machineId, params = {}) {
    const response = await apiClient.get(`/api/telemetry/${plant}/${machineId}`, { params });
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

  async getAlarmsForMachine(plant, machineId, params = {}) {
    const response = await apiClient.get(`/api/alarms/${plant}/${machineId}`, { params });
    return response.data;
  },

  async acknowledgeAlarm(alarmId) {
    const response = await apiClient.post(`/api/alarms/${alarmId}/acknowledge`);
    return response.data;
  },
};

export default api;
