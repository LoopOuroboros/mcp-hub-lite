import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@utils/http'
import type { ClientInfo } from '@shared-types/client.types'

export const useClientStore = defineStore('client', () => {
  const clients = ref<ClientInfo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchClients() {
    loading.value = true
    error.value = null
    try {
      clients.value = await http.get<ClientInfo[]>('/api/clients')
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to fetch clients'
      } else {
        error.value = 'Failed to fetch clients'
      }
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
