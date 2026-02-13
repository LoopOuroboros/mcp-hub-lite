import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@utils/http'

export interface SystemConfig {
  system: {
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
  }
  security: {
    allowedNetworks: string[]
    maxConcurrentConnections: number
    connectionTimeout: number
    idleConnectionTimeout: number
    maxConnections: number
  }
  observability: {
    tracing: {
      enabled: boolean
      exporter: 'console' | 'otlp'
      endpoint: string
      sampleRate: number
    }
  }
  [key: string]: unknown
}

export const useSystemStore = defineStore('system', () => {
  const config = ref<SystemConfig>({
    system: {
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
      }
    },
    security: {
      allowedNetworks: [],
      maxConcurrentConnections: 50,
      connectionTimeout: 30000,
      idleConnectionTimeout: 300000,
      maxConnections: 50
    },
    observability: {
      tracing: {
        enabled: false,
        exporter: 'console',
        endpoint: 'http://localhost:4318/v1/traces',
        sampleRate: 1.0
      }
    }
  })
  
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  async function fetchConfig() {
    loading.value = true
    try {
      const data = await http.get<SystemConfig>('/web/config')

      // Merge with default/current config - 修复属性路径错误
      config.value = {
        ...config.value,
        ...data,
        system: {
          ...config.value.system,
          ...(data.system || {}),
          logging: {
            ...config.value.system.logging,
            ...(data.system?.logging || {}),
            rotation: {
              ...config.value.system.logging.rotation,
              ...(data.system?.logging?.rotation || {})
            }
          }
        },
        security: {
          ...config.value.security,
          ...(data.security || {})
        },
        observability: {
          ...config.value.observability,
          ...(data.observability || {}),
          tracing: {
            ...config.value.observability.tracing,
            ...(data.observability?.tracing || {})
          }
        }
      }
      return config.value
    } catch (e: unknown) {
      const errorObj = e as Error;
      error.value = errorObj.message || 'Failed to fetch config'
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
      
    } catch (e: unknown) {
      const errorObj = e as Error;
      error.value = errorObj.message || 'Failed to update config'
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
