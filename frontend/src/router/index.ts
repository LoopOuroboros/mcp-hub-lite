import { createRouter, createWebHistory } from 'vue-router';
import ServerManager from '../views/ServerManager.vue';
import ToolSearch from '../views/ToolSearch.vue';
import Dashboard from '../views/Dashboard.vue';
import Settings from '../views/Settings.vue';
import About from '../views/About.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Dashboard',
      component: Dashboard
    },
    {
      path: '/servers',
      name: 'ServerManager',
      component: ServerManager
    },
    {
      path: '/tools',
      name: 'ToolSearch',
      component: ToolSearch
    },
    {
      path: '/settings',
      name: 'Settings',
      component: Settings
    },
    {
      path: '/about',
      name: 'About',
      component: About
    }
  ]
});

export default router;
