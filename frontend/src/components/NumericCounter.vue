<template>
  <div :class="['numeric-counter', colorClass]">
    <div class="counter-label">{{ label }}</div>
    <div class="counter-value">{{ value }}</div>
    <div class="counter-unit" v-if="unit">{{ unit }}</div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'NumericCounter',
  props: {
    label: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    color: {
      type: String,
      default: 'green', // 'green', 'red', 'blue', 'yellow'
    },
    unit: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const colorClass = computed(() => `color-${props.color}`);

    return {
      colorClass,
    };
  },
};
</script>

<style scoped>
.numeric-counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 2px solid #222222;
  border-radius: 12px;
  padding: 1rem;
  width: 100%;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.numeric-counter:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  transform: translateY(-2px);
}

.counter-label {
  font-size: 0.8rem;
  color: #888888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
  text-align: center;
}

.counter-value {
  font-size: 2.5rem;
  font-weight: 800;
  font-family: 'Monaco', 'Courier New', monospace;
  letter-spacing: -1px;
  line-height: 1;
}

.counter-unit {
  font-size: 0.75rem;
  color: #666666;
  font-weight: 500;
  letter-spacing: 0.3px;
}

/* Color variations */
.numeric-counter.color-green {
  border-color: #10b981;
}

.numeric-counter.color-green .counter-value {
  color: #10b981;
}

.numeric-counter.color-green:hover {
  border-color: #059669;
  box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
}

.numeric-counter.color-red {
  border-color: #ef4444;
}

.numeric-counter.color-red .counter-value {
  color: #ef4444;
}

.numeric-counter.color-red:hover {
  border-color: #dc2626;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);
}

.numeric-counter.color-blue {
  border-color: #3b82f6;
}

.numeric-counter.color-blue .counter-value {
  color: #3b82f6;
}

.numeric-counter.color-blue:hover {
  border-color: #2563eb;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
}

.numeric-counter.color-yellow {
  border-color: #fbbf24;
}

.numeric-counter.color-yellow .counter-value {
  color: #fbbf24;
}

.numeric-counter.color-yellow:hover {
  border-color: #f59e0b;
  box-shadow: 0 0 15px rgba(251, 191, 36, 0.2);
}
</style>
