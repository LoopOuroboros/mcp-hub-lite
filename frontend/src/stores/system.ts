import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '../utils/http'

export interface SystemConfig {
  host: string
  port: number
  language: string
  theme: string
  logging: {
    level: string
    rotation: {
      enabled: boolean
      maxAge: string
      maxSize: string
      compress: boolean
    }
  }
  security: {
    allowedNetworks: string[]
    maxConcurrentConnections: number
    connectionTimeout: number
    idleConnectionTimeout: number
    maxConnections: number
  }
  [key: string]: any
}

export const useSystemStore = defineStore('system', () => {
  const config = ref<SystemConfig>({
    host: 'localhost',
    port: 7788,
    language: 'zh',
    theme: 'system',
    logging: {
      level: 'info',
      rotation: {
        enabled: true,
        maxAge: '7d',
        maxSize: '100MB',
        compress: false
      }
    },
    security: {
      allowedNetworks: [],
      maxConcurrentConnections: 50,
      connectionTimeout: 30000,
      idleConnectionTimeout: 300000,
      maxConnections: 50
    }
  })
  
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  async function fetchConfig() {
    loading.value = true
    try {
      const data = await http.get<SystemConfig>('/web/config')
      
      // Merge with default/current config
      config.value = {
        ...config.value,
        ...data,
        logging: {
          ...config.value.logging,
          ...(data.logging || {}),
          rotation: {
            ...config.value.logging.rotation,
            ...(data.logging?.rotation || {})
          }
        },
        security: {
          ...config.value.security,
          ...(data.security || {})
        }
      }
      return config.value
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch config'
      console.error('Fetch config error:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateConfig(updates: Partial<SystemConfig>) {
    loading.value = true
    try {
      await http.put('/web/config', updates)
      
      // Merge updates into local state
      // Note: This is a shallow merge for top-level properties. 
      // For nested properties like logging.rotation, we rely on the component to pass the full object or we need deeper merge.
      // But typically updateConfig is called with the full object from SettingsView, 
      // or partial objects from Header (theme/language).
      
      // If updates contains nested objects (like logging), we should merge them carefully or replace them.
      // For simplicity, we assume updates are either full objects or top-level keys like theme/language.
      
      config.value = {
        ...config.value,
        ...updates
      }
      
    } catch (e: any) {
      error.value = e.message || 'Failed to update config'
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig
  }
})
