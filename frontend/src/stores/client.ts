import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '../utils/http'

export interface ClientContext {
  clientId: string
  clientName?: string
  cwd?: string
  project?: string
  ip?: string
  userAgent?: string
  timestamp: number
  lastSeen?: number
  roots?: Array<{ uri: string; name?: string }>
}

export const useClientStore = defineStore('client', () => {
  const clients = ref<ClientContext[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchClients() {
    loading.value = true
    error.value = null
    try {
      clients.value = await http.get<ClientContext[]>('/api/clients')
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch clients'
      console.error('Failed to fetch clients:', e)
    } finally {
      loading.value = false
    }
  }

  return {
    clients,
    loading,
    error,
    fetchClients
  }
})
