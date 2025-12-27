import { createRouter, createWebHistory } from 'vue-router';
import ServerManager from '../views/ServerManager.vue';
import ToolExplorer from '../views/ToolExplorer.vue';

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
    },
    {
      path: '/tools',
      name: 'ToolExplorer',
      component: ToolExplorer
    }
  ]
});

export default router;
