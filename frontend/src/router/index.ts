import { createRouter, createWebHistory } from 'vue-router';
import ServerManager from '../views/ServerManager.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/servers'
    },
    {
      path: '/servers',
      name: 'ServerManager',
      component: ServerManager
    }
  ]
});

export default router;
