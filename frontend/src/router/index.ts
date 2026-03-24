/// <reference types="vite/client" />
import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@views/HomeView.vue'),
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@views/ServerDashboard.vue')
        },
        {
          path: 'servers',
          name: 'servers',
          component: () => import('@views/ServerListView.vue')
        },
        {
          path: 'servers/:name',
          name: 'server-detail',
          component: () => import('@components/ServerDetail.vue'),
          redirect: { name: 'server-detail-config' },
          children: [
            {
              path: 'config',
              name: 'server-detail-config',
              component: () => import('@components/ServerDetail.vue')
            },
            {
              path: 'tools',
              name: 'server-detail-tools',
              component: () => import('@components/ServerDetail.vue')
            },
            {
              path: 'resources',
              name: 'server-detail-resources',
              component: () => import('@components/ServerDetail.vue')
            }
          ]
        },
        {
          path: 'tools',
          name: 'tools',
          component: () => import('@views/ToolsView.vue')
        },
        {
          path: 'resources',
          name: 'resources',
          component: () => import('@views/ResourcesView.vue')
        },
        {
          path: 'sessions',
          name: 'sessions',
          component: () => import('@views/SessionsView.vue')
        },
        {
          path: 'servers/:name/resources/detail',
          name: 'resource-detail',
          component: () => import('@views/ResourceDetailView.vue')
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@views/SettingsView.vue')
        }
      ]
    }
  ]
});

export default router;
