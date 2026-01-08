<template>
  <div class="status-light-container">
    <div class="light-label">{{ label }}</div>
    <div :class="['status-light', statusColor, isActive ? 'active' : 'inactive']"></div>
    <div class="light-status">{{ isActive ? 'Activo' : 'Inactivo' }}</div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'StatusLight',
  props: {
    label: {
      type: String,
      required: true,
    },
    value: {
      type: [Boolean, Number],
      required: true,
    },
    color: {
      type: String,
      default: 'yellow', // 'yellow', 'red', 'green'
    },
  },
  setup(props) {
    const isActive = computed(() => {
      if (typeof props.value === 'boolean') return props.value;
      return props.value > 0;
    });

    const statusColor = computed(() => props.color);

    return {
      isActive,
      statusColor,
    };
  },
};
</script>

<style scoped>
.status-light-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 1px solid #222222;
  border-radius: 12px;
  padding: 1rem;
  min-width: 130px;
  transition: all 0.3s ease;
}

.status-light-container:hover {
  border-color: #333333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.light-label {
  font-size: 0.85rem;
  color: #888888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
  text-align: center;
}

.status-light {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  transition: all 0.3s ease;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

.status-light.yellow {
  background: #fbbf24;
}

.status-light.yellow.active {
  box-shadow: 0 0 20px #fbbf24, inset 0 0 10px rgba(0, 0, 0, 0.2);
}

.status-light.yellow.inactive {
  background: #78350f;
  opacity: 0.4;
}

.status-light.red {
  background: #ef4444;
}

.status-light.red.active {
  box-shadow: 0 0 20px #ef4444, inset 0 0 10px rgba(0, 0, 0, 0.2);
}

.status-light.red.inactive {
  background: #7f1d1d;
  opacity: 0.4;
}

.status-light.green {
  background: #10b981;
}

.status-light.green.active {
  box-shadow: 0 0 20px #10b981, inset 0 0 10px rgba(0, 0, 0, 0.2);
}

.status-light.green.inactive {
  background: #064e3b;
  opacity: 0.4;
}

.status-light.blue {
  background: #3b82f6;
}

.status-light.blue.active {
  box-shadow: 0 0 20px #3b82f6, inset 0 0 10px rgba(0, 0, 0, 0.2);
}

.status-light.blue.inactive {
  background: #1e3a8a;
  opacity: 0.4;
}

@media (max-width: 768px) {
  .status-light-container {
    padding: 0.75rem;
    min-width: auto;
    gap: 0.5rem;
  }

  .light-label {
    font-size: 0.65rem;
    text-transform: uppercase;
  }

  .status-light {
    width: 40px;
    height: 40px;
  }

  .light-status {
    font-size: 0.65rem;
  }
}

.light-status {
  font-size: 0.8rem;
  color: #888888;
  font-weight: 500;
}
</style>
