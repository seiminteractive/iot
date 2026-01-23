<template>
  <!-- El editor ahora vive en una ruta dedicada con Vue Router -->

  <div class="admin-panel">
    <!-- TENANTS TAB -->
    <section v-if="tab === 'tenants'" class="section">
        <header class="section-header">
          <div>
            <h1>Tenants</h1>
            <p>Empresas registradas en el sistema</p>
          </div>
          <button class="btn-ghost" @click="refreshTenants">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Actualizar
          </button>
        </header>

        <!-- Create form -->
        <div class="form-card">
          <h3>Crear tenant</h3>
          <form @submit.prevent="handleCreateTenant" class="form-grid">
            <div class="form-field">
              <label for="tenant-slug">Slug</label>
              <input 
                id="tenant-slug"
                v-model="tenantForm.slug" 
                placeholder="ej: granix" 
                required 
              />
              <span class="helper">Identificador único. No editable luego.</span>
            </div>
            <div class="form-field">
              <label for="tenant-name">Nombre</label>
              <input 
                id="tenant-name"
                v-model="tenantForm.name" 
                placeholder="Nombre de la empresa" 
                required 
              />
            </div>
            <div class="form-field">
              <label for="tenant-icon">Icon URL</label>
              <input 
                id="tenant-icon"
                v-model="tenantForm.iconUrl" 
                placeholder="URL del logo (Firebase Storage)" 
              />
            </div>
            <div class="form-actions">
              <button 
                type="submit" 
                class="btn-primary"
                :disabled="!tenantForm.slug || !tenantForm.name"
              >
                Crear tenant
              </button>
            </div>
          </form>
        </div>

        <!-- Search -->
        <div class="search-bar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input 
            v-model="tenantSearch" 
            placeholder="Buscar por nombre o slug" 
            type="text"
          />
        </div>

        <!-- List -->
        <div class="list-container">
          <div v-if="filteredTenants.length === 0" class="empty-state">
            <p v-if="tenantSearch">No se encontraron tenants</p>
            <p v-else>Todavía no hay tenants creados</p>
          </div>
          <div v-else class="list">
            <div 
              v-for="tenant in filteredTenants" 
              :key="tenant.id" 
              class="list-item"
            >
              <div class="list-item-icon">
                <img v-if="tenant.iconUrl" :src="tenant.iconUrl" alt="" />
                <div v-else class="icon-placeholder">{{ tenant.slug[0]?.toUpperCase() }}</div>
              </div>
              <div class="list-item-content">
                <span class="list-item-title">{{ tenant.name }}</span>
                <span class="list-item-subtitle">{{ tenant.slug }}</span>
              </div>
              <div class="list-item-actions">
                <button class="btn-icon" title="Eliminar" @click="confirmDeleteTenant(tenant)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

    <!-- PLANTAS TAB -->
    <section v-if="tab === 'plants'" class="section">
        <header class="section-header">
          <div>
            <h1>Plantas</h1>
            <p>Ubicaciones industriales por empresa</p>
          </div>
          <button class="btn-ghost" @click="refreshPlants">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Actualizar
          </button>
        </header>

        <!-- Create form -->
        <div class="form-card">
          <h3>Crear planta</h3>
          <form @submit.prevent="handleCreatePlant" class="form-grid">
            <div class="form-field">
              <label for="plant-tenant">Tenant</label>
              <select 
                id="plant-tenant"
                v-model="plantForm.tenantId" 
                required
              >
                <option value="" disabled>Seleccionar empresa</option>
                <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
                  {{ tenant.name }} ({{ tenant.slug }})
                </option>
              </select>
            </div>
            <div class="form-field">
              <label for="plant-province">Provincia</label>
              <input 
                id="plant-province"
                v-model="plantForm.province" 
                placeholder="ej: Entre Ríos" 
                required 
                :disabled="!plantForm.tenantId"
              />
            </div>
            <div class="form-field">
              <label for="plant-id">Plant ID</label>
              <input 
                id="plant-id"
                v-model="plantForm.plantId" 
                placeholder="ej: planta-1" 
                required 
                :disabled="!plantForm.tenantId"
              />
              <span class="helper">Identificador técnico único</span>
            </div>
            <div class="form-field">
              <label for="plant-name">Nombre (opcional)</label>
              <input 
                id="plant-name"
                v-model="plantForm.name" 
                placeholder="Nombre visible de la planta" 
                :disabled="!plantForm.tenantId"
              />
            </div>
            <div class="form-actions">
              <button 
                type="submit" 
                class="btn-primary"
                :disabled="!plantForm.tenantId || !plantForm.province || !plantForm.plantId"
              >
                Crear planta
              </button>
            </div>
          </form>
        </div>

        <!-- Filters -->
        <div class="filters-bar">
          <div class="search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input 
              v-model="plantSearch" 
              placeholder="Buscar por planta, provincia o ID" 
              type="text"
            />
          </div>
          <select v-model="plantFilterTenant" class="filter-select">
            <option value="">Todos los tenants</option>
            <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
              {{ tenant.slug }}
            </option>
          </select>
        </div>

        <!-- List -->
        <div class="list-container">
          <div v-if="filteredPlants.length === 0" class="empty-state">
            <p v-if="plantSearch || plantFilterTenant">No se encontraron plantas</p>
            <p v-else>Todavía no hay plantas creadas</p>
          </div>
          <div v-else class="list">
            <div 
              v-for="plant in filteredPlants" 
              :key="plant.id" 
              class="list-item"
            >
              <div class="list-item-content">
                <span class="list-item-title">{{ plant.name || plant.plantId }}</span>
                <span class="list-item-subtitle">{{ plant.province }} · {{ plant.plantId }}</span>
              </div>
              <div class="list-item-badge">
                {{ plant.tenant?.slug || '—' }}
              </div>
              <div class="list-item-actions">
                <button class="btn-icon" title="Editar" @click="openEditPlant(plant)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-icon" title="Eliminar" @click="confirmDeletePlant(plant)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

    <!-- PLCs TAB -->
    <section v-if="tab === 'plcs'" class="section">
        <header class="section-header">
          <div>
            <h1>PLCs</h1>
            <p>Dispositivos detectados automáticamente por el sistema</p>
          </div>
        </header>

        <!-- Filters -->
        <div class="filters-bar">
          <div class="search-bar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input 
              v-model="plcSearch" 
              placeholder="Buscar por PLC ID, planta o empresa" 
              type="text"
            />
          </div>
          <select v-model="plcFilterTenant" class="filter-select" @change="plcFilterPlant = ''">
            <option value="">Todos los tenants</option>
            <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
              {{ tenant.slug }}
            </option>
          </select>
          <select v-model="plcFilterPlant" class="filter-select">
            <option value="">Todas las plantas</option>
            <option v-for="plant in plantsForPlcFilter" :key="plant.id" :value="plant.id">
              {{ plant.plantId }}
            </option>
          </select>
          <button class="btn-ghost" @click="loadAllPlcs">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            Cargar
          </button>
        </div>

        <!-- List -->
        <div class="list-container">
          <div v-if="!plcFilterTenant && !plcFilterPlant && allPlcs.length === 0" class="empty-state">
            <p>Seleccioná un tenant y planta para ver los PLCs</p>
          </div>
          <div v-else-if="filteredPlcs.length === 0" class="empty-state">
            <p>No se encontraron PLCs</p>
          </div>
          <div v-else class="list">
            <div 
              v-for="plc in filteredPlcs" 
              :key="plc.id" 
              class="list-item"
            >
              <div class="list-item-content">
                <span class="list-item-title">{{ plc.plcThingName }}</span>
                <span class="list-item-subtitle">
                  {{ plc.tenant?.slug || '—' }} · {{ plc.plant?.plantId || '—' }}
                </span>
              </div>
              <div :class="['status-badge', plc.isOnline ? 'online' : 'offline']">
                {{ plc.isOnline ? 'Activo' : 'Offline' }}
              </div>
              <div class="list-item-actions">
                <button class="btn-icon danger" title="Eliminar" @click="confirmDeletePlc(plc)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
    </section>

    <!-- USERS TAB -->
    <div v-if="tab === 'users'" class="section">
      <header class="section-header">
        <div>
          <h1>Usuarios</h1>
          <p>Gestión de usuarios y permisos</p>
        </div>
        <button class="btn-ghost" @click="refreshUsers">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Actualizar
        </button>
      </header>

      <div class="form-card">
        <h3>Crear usuario</h3>
        <form @submit.prevent="handleCreateUser" class="form-grid">
          <div class="form-field">
            <label for="user-email">Email</label>
            <input id="user-email" v-model="userForm.email" type="email" placeholder="usuario@empresa.com" required />
          </div>
          <div class="form-field">
            <label for="user-password">Contraseña</label>
            <input id="user-password" v-model="userForm.password" type="password" placeholder="••••••••" required />
          </div>
          <div class="form-field">
            <label for="user-tenant">Tenant</label>
            <select id="user-tenant" v-model="userForm.tenantId" required>
              <option value="" disabled>Seleccionar</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.slug">
                {{ tenant.slug }}
              </option>
            </select>
          </div>
          <div class="form-field">
            <label for="user-role">Rol</label>
            <select id="user-role" v-model="userForm.role" required>
              <option value="viewer">Viewer</option>
              <option value="plant_operator">Plant Operator</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-field full-width">
            <label for="user-plants">Acceso a plantas</label>
            <input id="user-plants" v-model="userForm.plantAccess" placeholder="planta-1, planta-2 o *" />
            <span class="helper">Separar con comas. Usar * para acceso total.</span>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="!userForm.email || !userForm.password">
              Crear usuario
            </button>
          </div>
        </form>
      </div>

      <div class="search-bar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input v-model="userSearch" placeholder="Buscar por email" type="text" />
      </div>

      <div class="list-container">
        <div v-if="filteredUsers.length === 0" class="empty-state">
          <p>No se encontraron usuarios</p>
        </div>
        <div v-else class="list">
          <div v-for="user in filteredUsers" :key="user.uid" class="list-item">
            <div class="list-item-content">
              <span class="list-item-title">{{ user.email }}</span>
              <span class="list-item-subtitle">{{ user.tenantId || '—' }} · {{ user.role || '—' }}</span>
            </div>
            <div class="list-item-badge">
              {{ user.plantAccess?.join(', ') || '*' }}
            </div>
            <div class="list-item-actions">
              <button class="btn-icon" title="Editar" @click="prefillClaims(user)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit claims modal inline -->
      <div v-if="claimsForm.uid" class="form-card" style="margin-top: 2rem;">
        <h3>Editar permisos</h3>
        <form @submit.prevent="handleUpdateClaims" class="form-grid">
          <div class="form-field">
            <label>UID</label>
            <input :value="claimsForm.uid" disabled />
          </div>
          <div class="form-field">
            <label>Tenant</label>
            <select v-model="claimsForm.tenantId">
              <option value="">Sin cambio</option>
              <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.slug">
                {{ tenant.slug }}
              </option>
            </select>
          </div>
          <div class="form-field">
            <label>Rol</label>
            <select v-model="claimsForm.role">
              <option value="">Sin cambio</option>
              <option value="viewer">Viewer</option>
              <option value="plant_operator">Plant Operator</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-field">
            <label>Acceso a plantas</label>
            <input v-model="claimsForm.plantAccess" placeholder="planta-1, planta-2 o *" />
          </div>
          <div class="form-field">
            <label class="checkbox-label">
              <input type="checkbox" v-model="claimsForm.disabled" />
              Deshabilitar usuario
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-ghost" @click="claimsForm.uid = ''">Cancelar</button>
            <button type="submit" class="btn-primary">Guardar cambios</button>
          </div>
        </form>
      </div>
    </div>

    <!-- PERSIST RULES TAB -->
    <div v-if="tab === 'persist'" class="section">
      <PersistRules :tenants="tenants" />
    </div>

    <!-- DASHBOARDS TAB -->
    <div v-if="tab === 'dashboards'" class="section">
      <header class="section-header">
        <div>
          <h1>Dashboards</h1>
          <p>Configuración de dashboards por PLC</p>
        </div>
      </header>

      <div class="filters-bar">
        <select v-model="selectedTenantId" @change="handleTenantSelection" class="filter-select">
          <option value="" disabled>Seleccionar tenant</option>
          <option v-for="tenant in tenants" :key="tenant.id" :value="tenant.id">
            {{ tenant.name }} ({{ tenant.slug }})
          </option>
        </select>
        <select v-model="selectedPlantId" @change="handlePlantSelection" class="filter-select" :disabled="!selectedTenantId">
          <option value="" disabled>Seleccionar planta</option>
          <option v-for="plant in plantsByTenant" :key="plant.id" :value="plant.id">
            {{ plant.name || plant.plantId }}
          </option>
        </select>
        <button class="btn-ghost" @click="refreshPlcs" :disabled="!selectedPlantId">
          Cargar PLCs
        </button>
      </div>

      <div class="list-container">
        <div v-if="!selectedPlantId" class="empty-state">
          <p>Seleccioná un tenant y planta para ver los PLCs</p>
        </div>
        <div v-else-if="plcs.length === 0" class="empty-state">
          <p>No hay PLCs en esta planta</p>
        </div>
        <div v-else class="list">
          <div v-for="plc in plcs" :key="plc.id" class="list-item">
            <div class="list-item-content">
              <span class="list-item-title">{{ plc.plcThingName }}</span>
              <span class="list-item-subtitle">{{ plc.name || 'Sin nombre' }}</span>
            </div>
            <div :class="['status-badge', plc.hasDashboard ? 'online' : 'offline']">
              {{ plc.hasDashboard ? 'Dashboard creado' : 'Sin dashboard' }}
            </div>
            <div class="list-item-actions">
              <button v-if="plc.hasDashboard" class="btn-small" @click="openDashboardBuilder(plc)">
                Editar
              </button>
              <button v-else class="btn-small primary" @click="createDashboardForPlc(plc)">
                Crear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <div v-if="deleteModal.show" class="modal-overlay" @click.self="deleteModal.show = false">
        <div class="modal">
          <h3>{{ deleteModal.title }}</h3>
          <p>{{ deleteModal.message }}</p>
          <div class="modal-actions">
            <button class="btn-ghost" @click="deleteModal.show = false">Cancelar</button>
            <button class="btn-danger" @click="executeDelete">Eliminar</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Plant modal -->
    <Teleport to="body">
      <div v-if="editPlantModal.show" class="modal-overlay" @click.self="editPlantModal.show = false">
        <div class="modal modal-form">
          <h3>Editar planta</h3>
          <form @submit.prevent="executeEditPlant">
            <div class="form-field">
              <label>Provincia</label>
              <input 
                v-model="editPlantModal.province" 
                placeholder="Ej: buenos-aires" 
                required
              />
            </div>
            <div class="form-field">
              <label>Plant ID</label>
              <input 
                v-model="editPlantModal.plantId" 
                placeholder="Identificador técnico" 
                required
              />
            </div>
            <div class="form-field">
              <label>Nombre (opcional)</label>
              <input 
                v-model="editPlantModal.name" 
                placeholder="Nombre visible de la planta"
              />
            </div>
            <div class="modal-actions">
              <button type="button" class="btn-ghost" @click="editPlantModal.show = false">Cancelar</button>
              <button type="submit" class="btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { GridStack } from 'gridstack';
import 'gridstack/dist/gridstack.min.css';
import api from '../services/api';
import PersistRules from './PersistRules.vue';

const router = useRouter();

const props = defineProps({
  tab: {
    type: String,
    required: true,
  },
});

// State
const tenants = ref([]);
const plants = ref([]);
const users = ref([]);
const plcs = ref([]);
const allPlcs = ref([]);

// Search & Filters
const tenantSearch = ref('');
const plantSearch = ref('');
const plantFilterTenant = ref('');
const plcSearch = ref('');
const plcFilterTenant = ref('');
const plcFilterPlant = ref('');
const userSearch = ref('');

// Forms
const tenantForm = ref({ slug: '', name: '', iconUrl: '' });
const plantForm = ref({ tenantId: '', province: '', plantId: '', name: '' });
const userForm = ref({ email: '', password: '', tenantId: '', role: 'viewer', plantAccess: '' });
const claimsForm = ref({ uid: '', tenantId: '', role: '', plantAccess: '', disabled: false });

// Dashboard
const selectedTenantId = ref('');
const selectedPlantId = ref('');
const selectedPlc = ref(null);
const dashboardForm = ref({ id: null, name: '', iconUrl: '', layoutVersion: 1 });
const widgets = ref([]);

// Delete modal
const deleteModal = ref({
  show: false,
  title: '',
  message: '',
  type: '',
  item: null,
});

// Edit Plant modal
const editPlantModal = ref({
  show: false,
  id: '',
  province: '',
  plantId: '',
  name: '',
});

// Computed
const filteredTenants = computed(() => {
  if (!tenantSearch.value) return tenants.value;
  const q = tenantSearch.value.toLowerCase();
  return tenants.value.filter(t => 
    t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
  );
});

const filteredPlants = computed(() => {
  let result = plants.value;
  if (plantFilterTenant.value) {
    result = result.filter(p => p.tenantId === plantFilterTenant.value);
  }
  if (plantSearch.value) {
    const q = plantSearch.value.toLowerCase();
    result = result.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      p.plantId.toLowerCase().includes(q) ||
      p.province.toLowerCase().includes(q)
    );
  }
  return result;
});

const plantsForPlcFilter = computed(() => {
  if (!plcFilterTenant.value) return plants.value;
  return plants.value.filter(p => p.tenantId === plcFilterTenant.value);
});

const filteredPlcs = computed(() => {
  let result = allPlcs.value;
  if (plcFilterTenant.value) {
    result = result.filter(p => p.tenantId === plcFilterTenant.value);
  }
  if (plcFilterPlant.value) {
    result = result.filter(p => p.plantId === plcFilterPlant.value);
  }
  if (plcSearch.value) {
    const q = plcSearch.value.toLowerCase();
    result = result.filter(p =>
      p.plcThingName.toLowerCase().includes(q) ||
      (p.tenant?.slug || '').toLowerCase().includes(q) ||
      (p.plant?.plantId || '').toLowerCase().includes(q)
    );
  }
  return result;
});

const filteredUsers = computed(() => {
  if (!userSearch.value) return users.value;
  const q = userSearch.value.toLowerCase();
  return users.value.filter(u => u.email.toLowerCase().includes(q));
});

const plantsByTenant = computed(() =>
  plants.value.filter(plant => plant.tenantId === selectedTenantId.value)
);

const selectedTenant = computed(() =>
  tenants.value.find(tenant => tenant.id === selectedTenantId.value) || null
);

const selectedPlant = computed(() =>
  plants.value.find(plant => plant.id === selectedPlantId.value) || null
);

// API calls
const refreshTenants = async () => {
  tenants.value = await api.getTenants();
};

const refreshPlants = async () => {
  plants.value = await api.getPlantsAdmin();
};

const refreshUsers = async () => {
  users.value = await api.getUsersAdmin();
};

const refreshPlcs = async () => {
  if (!selectedTenantId.value || !selectedPlantId.value) return;
  plcs.value = await api.getPlcsAdmin(selectedTenantId.value, selectedPlantId.value);
};

const refreshAllPlcs = async () => {
  allPlcs.value = await api.getAllPlcsAdmin();
};

const loadAllPlcs = async () => {
  // Si hay filtros, cargar con filtros; si no, cargar todos
  const params = {};
  if (plcFilterTenant.value) params.tenantId = plcFilterTenant.value;
  if (plcFilterPlant.value) params.plantId = plcFilterPlant.value;
  allPlcs.value = await api.getAllPlcsAdmin(params);
};

// Handlers
const handleCreateTenant = async () => {
  await api.createTenant({ ...tenantForm.value });
  tenantForm.value = { slug: '', name: '', iconUrl: '' };
  await refreshTenants();
};

const handleCreatePlant = async () => {
  await api.createPlant({ ...plantForm.value });
  plantForm.value = { tenantId: '', province: '', plantId: '', name: '' };
  await refreshPlants();
};

const handleCreateUser = async () => {
  await api.createUserAdmin({
    email: userForm.value.email,
    password: userForm.value.password,
    tenantId: userForm.value.tenantId,
    role: userForm.value.role,
    plantAccess: parsePlantAccess(userForm.value.plantAccess),
  });
  userForm.value = { email: '', password: '', tenantId: '', role: 'viewer', plantAccess: '' };
  await refreshUsers();
};

const handleUpdateClaims = async () => {
  await api.updateUserClaims(claimsForm.value.uid, {
    tenantId: claimsForm.value.tenantId || undefined,
    role: claimsForm.value.role || undefined,
    plantAccess: parsePlantAccess(claimsForm.value.plantAccess),
    disabled: claimsForm.value.disabled,
  });
  claimsForm.value = { uid: '', tenantId: '', role: '', plantAccess: '', disabled: false };
  await refreshUsers();
};

const prefillClaims = (user) => {
  claimsForm.value = {
    uid: user.uid,
    tenantId: user.tenantId || '',
    role: user.role || '',
    plantAccess: user.plantAccess?.join(',') || '',
    disabled: user.disabled || false,
  };
};

const handleTenantSelection = async () => {
  selectedPlantId.value = '';
  selectedPlc.value = null;
  plcs.value = [];
};

const handlePlantSelection = async () => {
  selectedPlc.value = null;
  await refreshPlcs();
};

// Dashboard
const openDashboardBuilder = async (plc) => {
  selectedPlc.value = plc;
  try {
    const dashboard = await api.getDashboardByPlc(plc.id);
    dashboardForm.value = {
      id: dashboard.id,
      name: dashboard.name,
      iconUrl: dashboard.iconUrl || '',
      layoutVersion: dashboard.layoutVersion || 1,
    };
    widgets.value = dashboard.widgets || [];
    // Navegar a ruta dedicada del editor (F5 mantiene estado)
    router.push({
      name: 'dashboardBuilder',
      params: { plcId: plc.id },
      query: { returnTab: 'admin', returnAdminTab: 'dashboards' },
    });
  } catch (error) {
    dashboardForm.value = { id: null, name: '', iconUrl: '', layoutVersion: 1 };
    widgets.value = [];
  }
};

const createDashboardForPlc = async (plc) => {
  selectedPlc.value = plc;
  const dashboard = await api.createDashboard(plc.id, { name: plc.plcThingName });
  dashboardForm.value = {
    id: dashboard.id,
    name: dashboard.name,
    iconUrl: dashboard.iconUrl || '',
    layoutVersion: dashboard.layoutVersion || 1,
  };
  widgets.value = [];
  router.push({
    name: 'dashboardBuilder',
    params: { plcId: plc.id },
    query: { returnTab: 'admin', returnAdminTab: 'dashboards' },
  });
  await refreshPlcs();
};

// El guardado lo maneja el builder en su ruta; al volver, la lista se puede refrescar

// Delete confirmations
const confirmDeleteTenant = (tenant) => {
  deleteModal.value = {
    show: true,
    title: 'Eliminar tenant',
    message: `¿Eliminar "${tenant.name}"? Esta acción no se puede deshacer.`,
    type: 'tenant',
    item: tenant,
  };
};

const confirmDeletePlant = (plant) => {
  deleteModal.value = {
    show: true,
    title: 'Eliminar planta',
    message: `¿Eliminar "${plant.name || plant.plantId}"? Se eliminarán todos los PLCs y datos asociados.`,
    type: 'plant',
    item: plant,
  };
};

const openEditPlant = (plant) => {
  editPlantModal.value = {
    show: true,
    id: plant.id,
    province: plant.province,
    plantId: plant.plantId,
    name: plant.name || '',
  };
};

const executeEditPlant = async () => {
  try {
    await api.updatePlant(editPlantModal.value.id, {
      province: editPlantModal.value.province,
      plantId: editPlantModal.value.plantId,
      name: editPlantModal.value.name,
    });
    editPlantModal.value.show = false;
    await refreshPlants();
  } catch (error) {
    console.error('Error updating plant:', error);
    alert(error.response?.data?.error || 'Error al actualizar la planta');
  }
};

const confirmDeletePlc = (plc) => {
  deleteModal.value = {
    show: true,
    title: 'Eliminar PLC',
    message: `¿Eliminar "${plc.plcThingName}"? Se perderán todos los datos de telemetría.`,
    type: 'plc',
    item: plc,
  };
};

const executeDelete = async () => {
  const { type, item } = deleteModal.value;
  try {
    if (type === 'tenant') {
      await api.deleteTenant(item.id);
      await refreshTenants();
      await refreshPlants();
    } else if (type === 'plant') {
      await api.deletePlant(item.id);
      await refreshPlants();
    } else if (type === 'plc') {
      await api.deletePlc(item.id);
      // Refresh PLCs list if we have context
      if (selectedTenantId.value && selectedPlantId.value) {
        plcs.value = await api.getPlcsAdmin(selectedTenantId.value, selectedPlantId.value);
      }
    }
  } catch (error) {
    console.error('Error deleting:', error);
  }
  deleteModal.value.show = false;
};

// Utils
const parsePlantAccess = (value) => {
  if (!value) return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

// Init
onMounted(async () => {
  await refreshTenants();
  await refreshPlants();
  await refreshUsers();
  await refreshAllPlcs();
});
</script>
<style scoped>
/* Base */
.admin-panel {
  min-height: 100vh;
  background: #000000;
  color: #f5f5f7;
  padding-bottom: 100px;
}

/* Section */
.section {
  padding: 2rem;
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

.form-field.full-width {
  grid-column: 1 / -1;
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

.btn-ghost:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.btn-small {
  height: 36px;
  padding: 0 1rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 8px;
  color: #f5f5f7;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-small:hover {
  background: #2d2d2d;
}

.btn-small.primary {
  background: #f5f5f7;
  color: #000000;
  border-color: #f5f5f7;
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

.btn-danger {
  height: 44px;
  padding: 0 1.5rem;
  background: #ff3b30;
  border: none;
  border-radius: 10px;
  color: #ffffff;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-danger:hover {
  background: #ff453a;
}

/* Search Bar */
.search-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1rem;
  height: 44px;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  flex: 1;
}

.search-bar svg {
  color: #48484a;
  flex-shrink: 0;
}

.search-bar input {
  flex: 1;
  background: none;
  border: none;
  color: #f5f5f7;
  font-size: 0.9rem;
  outline: none;
  height: 100%;
}

.search-bar input::placeholder {
  color: #48484a;
}

/* Filters Bar */
.filters-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.filter-select {
  height: 44px;
  padding: 0 1rem;
  background: #1d1d1f;
  border: 1px solid #2d2d2d;
  border-radius: 10px;
  color: #86868b;
  font-size: 0.85rem;
  min-width: 160px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-select:hover {
  border-color: #3d3d3d;
  color: #f5f5f7;
}

.filter-select:focus {
  outline: none;
  border-color: #424245;
}

/* List */
.list-container {
  background: #0d0d0d;
  border: 1px solid #1d1d1f;
  border-radius: 16px;
  overflow: hidden;
  margin-top: 2rem;
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

.list-item-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.list-item-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-placeholder {
  width: 100%;
  height: 100%;
  background: #2d2d2d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 600;
  color: #86868b;
}

.list-item-content {
  flex: 1;
  min-width: 0;
}

.list-item-title {
  display: block;
  font-size: 0.95rem;
  font-weight: 500;
  color: #f5f5f7;
}

.list-item-subtitle {
  display: block;
  font-size: 0.8rem;
  color: #48484a;
  margin-top: 0.15rem;
}

.list-item-badge {
  padding: 0.35rem 0.75rem;
  background: #1d1d1f;
  border-radius: 6px;
  font-size: 0.75rem;
  color: #86868b;
  font-weight: 500;
}

.list-item-actions {
  display: flex;
  gap: 0.5rem;
}

/* Status Badge */
.status-badge {
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.online {
  background: rgba(52, 199, 89, 0.15);
  color: #34c759;
}

.status-badge.offline {
  background: rgba(142, 142, 147, 0.15);
  color: #8e8e93;
}

/* Empty State */
.empty-state {
  padding: 4rem 2rem;
  text-align: center;
}

.empty-state p {
  color: #48484a;
  font-size: 0.95rem;
}

/* Checkbox */
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: #86868b;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #f5f5f7;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: #1d1d1f;
  border-radius: 16px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
}

.modal h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #f5f5f7;
  margin: 0 0 0.75rem 0;
}

.modal p {
  font-size: 0.95rem;
  color: #86868b;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.modal-form {
  max-width: 450px;
}

.modal-form form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-form .form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modal-form .form-field label {
  font-size: 0.85rem;
  color: #86868b;
  font-weight: 500;
}

.modal-form .form-field input {
  padding: 0.75rem 1rem;
  background: #0d0d0d;
  border: 1px solid #333;
  border-radius: 8px;
  color: #f5f5f7;
  font-size: 0.95rem;
  transition: border-color 0.2s;
}

.modal-form .form-field input:focus {
  outline: none;
  border-color: #8a2be2;
}

.modal-form .form-field input::placeholder {
  color: #555;
}

.modal-form .modal-actions {
  margin-top: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .section {
    padding: 1.5rem 1rem;
  }
  
  .catalog-tabs {
    padding: 0 1rem;
  }
  
  .form-grid {
    grid-template-columns: 1fr;
  }
  
  .filters-bar {
    flex-direction: column;
  }
  
  .filter-select {
    width: 100%;
  }
  
  .section-header {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>

