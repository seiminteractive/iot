<template>
  <div class="login-page">
    <!-- Background -->
    <div class="bg-image"></div>
    <div class="bg-overlay"></div>
    
    <!-- Decorative elements -->
    <div class="decor-left-text">
      <span>MONITOREO</span>
    </div>
    
    <div class="decor-dots-right">
      <span></span>
      <span class="active"></span>
      <span></span>
      <span></span>
    </div>
    
    <div class="decor-corner-tl">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
        <line x1="12" y1="2" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>
    </div>
    
    <div class="decor-corner-br">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
      </svg>
    </div>
    
    <!-- Logo top left -->
    <div class="logo-fixed">
      <img src="../assets/MARCA-14.png" alt="SEIM Interactive" />
    </div>
    
    <!-- Social links bottom left - styled like reference -->
    <div class="social-links">
      <a href="https://instagram.com/seiminteractive" target="_blank" class="social-link">Instagram</a>
      <a href="https://seiminteractive.com" target="_blank" class="social-link active">Web</a>
      <a href="https://linkedin.com/company/seiminteractive" target="_blank" class="social-link">LinkedIn</a>
      <span class="social-line"></span>
    </div>
    
    <!-- Main content area -->
    <div class="content-area">
      <!-- Left: Hero text -->
      <div class="hero-text">
        <h1 class="main-title">
          <span class="line">Industrial</span>
          <span class="line">Telemetry</span>
        </h1>
        <p class="subtitle">Potenciado por Inteligencia Artificial</p>
        <p class="description">
          Monitoreo industrial avanzado con IoT para recolección y análisis 
          de datos en tiempo real. Integración con inteligencia artificial 
          para insights predictivos y optimización de operaciones.
        </p>
      </div>
    </div>
    
    <!-- Blur fade transition -->
    <div class="blur-fade"></div>
    
    <!-- Right: Glass panel with login -->
    <div class="glass-panel">
      <div class="panel-content">
        <div class="login-header">
          <h2>Iniciar Sesión</h2>
          <p>Accede a tu panel de control</p>
        </div>
        
        <form @submit.prevent="handleSubmit" class="login-form">
          <div class="input-group">
            <label>Correo electrónico</label>
            <div class="input-wrapper">
              <input
                v-model="email"
                type="email"
                placeholder="usuario@empresa.com"
                required
                autocomplete="email"
              />
            </div>
          </div>

          <div class="input-group">
            <label>Contraseña</label>
            <div class="input-wrapper">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                required
                autocomplete="current-password"
              />
              <button type="button" class="toggle-pass" @click="showPassword = !showPassword">
                <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <div v-if="errorMessage" class="error-msg">
            {{ errorMessage }}
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            <span v-else>INGRESAR</span>
          </button>
        </form>
        
        <div class="panel-footer">
          <div class="secure-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span>Conexión cifrada</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Top right info -->
    <div class="top-right-info">
      <span class="info-label">DEVELOPED BY</span>
      <span class="info-value">SEIM INTERACTIVE</span>
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
const showPassword = ref(false);

const emit = defineEmits(['login-success']);

const handleSubmit = async () => {
  errorMessage.value = '';
  loading.value = true;

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
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  position: relative;
  overflow: hidden;
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0a0a0a;
}

/* Background */
.bg-image {
  position: absolute;
  inset: 0;
  background-image: url('../assets/fondoLoginIot.jpeg');
  background-size: cover;
  background-position: center;
  z-index: 0;
}

.bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, transparent 70%);
  z-index: 1;
}

/* Logo */
.logo-fixed {
  position: absolute;
  top: 2.5rem;
  left: 3rem;
  z-index: 100;
}

.logo-fixed img {
  width: 10rem;
}

/* Decorative left vertical text */
.decor-left-text {
  position: absolute;
  left: 3rem;
  top: 50%;
  transform: translateY(-50%) rotate(-90deg);
  transform-origin: left center;
  z-index: 50;
}

.decor-left-text span {
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.5em;
  color: rgba(255,255,255,0.25);
  white-space: nowrap;
}

/* Dots right decorative */
.decor-dots-right {
  position: absolute;
  right: 2rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 200;
}

.decor-dots-right span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.15);
  transition: all 0.3s ease;
}

.decor-dots-right span.active {
  background: rgba(255,255,255,0.7);
  box-shadow: 0 0 12px rgba(255,255,255,0.4);
}

/* Corner decorations */
.decor-corner-tl {
  position: absolute;
  top: 2.5rem;
  right: 3rem;
  z-index: 200;
}

.decor-corner-tl svg {
  width: 18px;
  height: 18px;
  color: rgba(255,255,255,0.3);
}

.decor-corner-br {
  position: absolute;
  bottom: 2.5rem;
  right: 3rem;
  z-index: 200;
}

.decor-corner-br svg {
  width: 22px;
  height: 22px;
  color: rgba(255,255,255,0.25);
}

/* Social links - reference style */
.social-links {
  position: absolute;
  bottom: 2.5rem;
  left: 3rem;
  display: flex;
  align-items: center;
  gap: 2.5rem;
  z-index: 100;
}

.social-link {
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: rgba(255,255,255,0.4);
  text-decoration: none;
  transition: all 0.3s ease;
  position: relative;
}

.social-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 1px;
  background: rgba(255,255,255,0.6);
  transition: width 0.3s ease;
}

.social-link:hover::after,
.social-link.active::after {
  width: 100%;
}

.social-link:hover,
.social-link.active {
  color: rgba(255,255,255,0.85);
}

.social-line {
  width: 120px;
  height: 1px;
  background: linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1));
  margin-left: 0.5rem;
}

/* Top right info */
.top-right-info {
  position: absolute;
  top: 2.5rem;
  right: 6rem;
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  z-index: 200;
}

.info-label {
  font-size: 0.65rem;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: rgba(255,255,255,0.3);
}

.info-value {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.65);
  font-weight: 600;
}

/* Content area - left side */
.content-area {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 50%;
  display: flex;
  align-items: center;
  z-index: 50;
  padding-left: 10rem;
}

.hero-text {
  position: relative;
}

.main-title {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.main-title .line {
  font-size: 5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #ffffff;
  line-height: 1.05;
}

.title-x {
  position: absolute;
  right: -2.5rem;
  top: 45%;
  transform: translateY(-50%);
  font-size: 2rem;
  color: rgba(255,255,255,0.4);
  font-weight: 300;
}

.subtitle {
  margin-top: 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.15em;
  color: rgba(168, 141, 255, 1);
  text-transform: uppercase;
}

.description {
  max-width: 420px;
  margin-top: 1.25rem;
  font-size: 1rem;
  font-weight: 300;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.75);
}

/* Blur fade - soft gradient for smooth transition */
.blur-fade {
  position: absolute;
  right: 40%;
  top: 0;
  bottom: 0;
  width: 18%;
  z-index: 95;
  pointer-events: none;
  background: linear-gradient(90deg, 
    transparent 0%,
    rgba(255, 255, 255, 0.01) 40%,
    rgba(255, 255, 255, 0.03) 70%,
    rgba(255, 255, 255, 0.05) 100%
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  mask-image: linear-gradient(90deg, transparent 0%, black 100%);
  -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 100%);
}

/* Glass panel - liquid glass effect */
.glass-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.04) 0%,
    rgba(255, 255, 255, 0.01) 50%,
    rgba(255, 255, 255, 0.02) 100%
  );
  backdrop-filter: blur(50px) saturate(140%);
  -webkit-backdrop-filter: blur(50px) saturate(140%);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 340px;
  padding: 2rem;
}

.login-header h2 {
  font-size: 1.85rem;
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 0.5rem;
  letter-spacing: -0.01em;
}

.login-header p {
  font-size: 0.95rem;
  font-weight: 300;
  color: rgba(255,255,255,0.45);
  margin-bottom: 2.5rem;
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.input-group label {
  font-size: 0.8rem;
  font-weight: 400;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.02em;
}

.input-wrapper {
  position: relative;
}

.input-wrapper input {
  width: 100%;
  padding: 1rem 1.25rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  color: #ffffff;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 400;
  transition: all 0.25s ease;
  outline: none;
}

.input-wrapper input::placeholder {
  color: rgba(255,255,255,0.25);
}

.input-wrapper input:focus {
  background: rgba(255,255,255,0.07);
  border-color: rgba(167, 139, 250, 0.4);
  box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.1);
}

.toggle-pass {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: rgba(255,255,255,0.3);
  transition: color 0.2s;
}

.toggle-pass:hover {
  color: rgba(255,255,255,0.6);
}

.toggle-pass svg {
  width: 20px;
  height: 20px;
}

/* Error */
.error-msg {
  padding: 0.85rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 0.85rem;
  text-align: center;
}

/* Submit */
.submit-btn {
  width: 100%;
  padding: 1rem;
  margin-top: 0.5rem;
  background: #ffffff;
  border: none;
  border-radius: 10px;
  color: #0a0a0a;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: all 0.25s ease;
}

.submit-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.92);
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: #0a0a0a;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Footer */
.panel-footer {
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.secure-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: rgba(255,255,255,0.35);
  font-size: 0.75rem;
  font-weight: 400;
}

.secure-note svg {
  width: 16px;
  height: 16px;
}

/* Responsive */
@media (max-width: 1200px) {
  .content-area {
    padding-left: 8rem;
  }
  
  .main-title .line {
    font-size: 4rem;
  }
}

@media (max-width: 1024px) {
  .content-area {
    display: none;
  }
  
  .blur-fade {
    display: none;
  }
  
  .glass-panel {
    width: 100%;
  }
  
  .decor-left-text {
    display: none;
  }
  
  .top-right-info {
    display: none;
  }
  
  .decor-corner-tl {
    display: none;
  }
}

@media (max-width: 480px) {
  .logo-fixed {
    top: 1.5rem;
    left: 1.5rem;
  }
  
  .logo-fixed img {
    height: 40px;
  }
  
  .panel-content {
    padding: 1.5rem;
    max-width: 100%;
  }
  
  .login-header h2 {
    font-size: 1.5rem;
  }
  
  .social-links,
  .decor-dots-right,
  .decor-corner-br {
    display: none;
  }
}
</style>
