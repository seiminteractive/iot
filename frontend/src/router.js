import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';

// Reutilizamos `App.vue` como "shell" (auth + tabs + builder).
// La ruta dedicada del builder permite F5 sin perder estado.
const routes = [
  { path: '/', name: 'home', component: App },
  { path: '/admin/dashboards/:plcId/edit', name: 'dashboardBuilder', component: App },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

