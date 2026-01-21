/// <reference types="vite/client" />
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ServerDashboard from '../views/ServerDashboard.vue'
import ToolsView from '../views/ToolsView.vue'
import ClientsView from '../views/ClientsView.vue'

const router = createRouter({
  history: createWebHistory((import.meta as any).env.BASE_URL),
  routes: [
    {
      path: '/',
      component: HomeView,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: ServerDashboard
        },
        {
          path: 'tools',
          name: 'tools',
          component: ToolsView
        },
        {
          path: 'clients',
          name: 'clients',
          component: ClientsView
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/SettingsView.vue')
        }
      ]
    }
  ]
})

export default router
