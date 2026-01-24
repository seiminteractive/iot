import { createApp } from 'vue';
import Root from './Root.vue';
import { router } from './router';
import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';

const options = {
  position: 'bottom-right',
  timeout: 4000,
  closeButton: false,
  hideProgressBar: false,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  icon: true,
};

createApp(Root).use(router).use(Toast, options).mount('#app');
