<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-container">
        <img src="../assets/image.png" alt="Granix Logo" class="logo" />
      </div>

      <h1 class="title">Iniciar Sesión</h1>
      <p class="subtitle">Sistema de Telemetría Industrial</p>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label for="email">Correo Electrónico</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="usuario@ejemplo.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group">
          <label for="password">Contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

        <button type="submit" class="submit-button" :disabled="loading">
          <span v-if="loading">Cargando...</span>
          <span v-else>Ingresar</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { loginWithEmail } from '../services/authService';

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const loading = ref(false);

const emit = defineEmits(['login-success']);

const handleSubmit = async () => {
  errorMessage.value = '';
  loading.value = true;

  // Validaciones básicas
  if (!email.value || !password.value) {
    errorMessage.value = 'Por favor completa todos los campos.';
    loading.value = false;
    return;
  }

  try {
    const result = await loginWithEmail(email.value, password.value);

    if (result.success) {
      emit('login-success', result.user);
    } else {
      errorMessage.value = result.error;
    }
  } catch (error) {
    errorMessage.value = 'Error inesperado. Intenta nuevamente.';
    console.error('Error en handleSubmit:', error);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
  padding: 1rem;
}

.login-card {
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 1px solid #222222;
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.logo {
  height: 80px;
  width: auto;
}

.title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 0.95rem;
  color: #888888;
  text-align: center;
  margin-bottom: 2rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #cccccc;
}

.form-group input {
  padding: 0.875rem;
  background: #1a1a1a;
  border: 1px solid #333333;
  border-radius: 8px;
  color: #ffffff;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #8a2be2;
  box-shadow: 0 0 0 3px rgba(138, 43, 226, 0.1);
}

.form-group input::placeholder {
  color: #555555;
}

.error-message {
  padding: 0.875rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.3);
  border-radius: 8px;
  color: #ef4444;
  font-size: 0.9rem;
  text-align: center;
}

.submit-button {
  padding: 1rem;
  background: linear-gradient(135deg, #e81010 0%, #9f0f0f 100%);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 0.5rem;
}

.submit-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #e81010 0%, #9f0f0f 100%);
  box-shadow: 0 4px 12px rgba(138, 43, 226, 0.3);
  transform: translateY(-1px);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .login-card {
    padding: 2rem 1.5rem;
  }

  .logo {
    height: 10rem;
  }

  .title {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 0.85rem;
  }
}
</style>
