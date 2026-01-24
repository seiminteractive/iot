<template>
  <div class="gauge-container">
    <div class="gauge-title">{{ formatTitle(label) }}</div>
    <VChart :option="option" autoresize style="height: 220px; width: 100%" />
  </div>
</template>

<script>
import { computed } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { LabelLayout } from 'echarts/features';

use([GaugeChart, CanvasRenderer, LabelLayout]);

export default {
  name: 'GaugeChart',
  components: {
    VChart,
  },
  props: {
    label: {
      type: String,
      required: true,
    },
    value: {
      type: Number,
      required: true,
    },
    max: {
      type: Number,
      default: 100,
    },
    unit: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    function formatTitle(text) {
      // Remover guiones bajos y capitalizar cada palabra
      return text
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }

    function formatValue(value) {
      return (Math.round(value * 10) / 10).toFixed(1);
    }

    const option = computed(() => ({
      series: [
        {
          type: 'gauge',
          startAngle: 225,
          endAngle: -45,
          radius: '90%',
          center: ['50%', '50%'],
          min: 0,
          max: props.max,
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 12,
              color: [
                [1, '#7c3aed'],
              ],
            },
          },
          pointer: {
            itemStyle: {
              color: '#ffffff',
            },
            length: '70%',
            width: 6,
          },
          axisTick: {
            distance: -12,
            length: 6,
            lineStyle: {
              color: '#ffffff',
              width: 1,
            },
          },
          splitLine: {
            distance: -12,
            length: 20,
            lineStyle: {
              color: '#ffffff',
              width: 1,
            },
          },
          axisLabel: {
            color: '#ffffff',
            distance: 12,
            fontSize: 9,
          },
          detail: {
            valueAnimation: true,
            formatter: (value) => {
              const formatted = (Math.round(value * 10) / 10).toFixed(1);
              return formatted + (props.unit ? ' ' + props.unit : '');
            },
            color: '#ffffff',
            fontSize: 16,
            offsetCenter: [0, '65%'],
          },
          data: [{ value: props.value }],
        },
      ],
    }));

    return {
      option,
      formatTitle,
      formatValue,
    };
  },
};
</script>

<style scoped>
.gauge-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, #111111 0%, #0a0a0a 100%);
  border: 1px solid #222222;
  border-radius: 12px;
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  transition: all 0.3s ease;
}

.gauge-container:hover {
  border-color: #333333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.gauge-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: -0.3px;
  text-align: center;
  width: 100%;
}

.gauge-unit {
  font-size: 0.85rem;
  color: #888888;
  font-weight: 500;
}

@media (max-width: 640px) {
  .gauge-container {
    padding: 1rem;
  }
  
  .gauge-title {
    font-size: 0.95rem;
  }
}
</style>
