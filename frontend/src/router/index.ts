/// <reference types="vite/client" />
import { createRouter, createWebHistory } from 'vue-router'

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
          path: 'clients',
          name: 'clients',
          component: () => import('@views/ClientsView.vue')
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
})

export default router
