import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '../utils/http'

export interface ServerConfig {
  transport: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  timeout?: number
  enabled?: boolean
}

export interface LogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

export interface Server {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error'
  type: 'local' | 'remote'
  config: ServerConfig
  logs: LogEntry[]
  uptime?: string
  startTime?: number
  pid?: number
  tools?: any[]
  resources?: any[]
  toolsCount?: number
  resourcesCount?: number
  version?: string
}

interface McpServerConfig {
  id?: string
  name: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  type: string
  url?: string
  timeout?: number
  enabled?: boolean
}

interface McpStatus {
  id: string
  status: {
    connected: boolean
    error?: string
    lastCheck: number
    toolsCount: number
    resourcesCount: number
    pid?: number
    startTime?: number
    version?: string
  }
}

export const useServerStore = defineStore('server', () => {
  const servers = ref<Server[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedServerId = ref<string | null>(null)

  const selectedServer = computed(() => 
    servers.value.find(s => s.id === selectedServerId.value)
  )

  const stats = computed(() => ({
    total: servers.value.length,
    running: servers.value.filter(s => s.status === 'running').length,
    errors: servers.value.filter(s => s.status === 'error').length
  }))

  function selectServer(id: string | null) {
    selectedServerId.value = id
  }

  async function fetchServers() {
    loading.value = true
    error.value = null
    try {
      const [configs, statuses] = await Promise.all([
        http.get<McpServerConfig[]>('/web/servers'),
        http.get<McpStatus[]>('/web/mcp/status')
      ])

      servers.value = configs.map(config => {
        const statusInfo = statuses.find(s => s.id === config.id)?.status
        const status = statusInfo?.connected ? 'running' : (statusInfo?.error ? 'error' : 'stopped')

        return {
          id: config.id || '',
          name: config.name,
          status,
          type: config.type === 'sse' || config.type === 'streamable-http' ? 'remote' : 'local',
          config: {
            transport: (config.type as 'stdio' | 'sse' | 'streamable-http') || 'stdio',
            command: config.command,
            args: config.args,
            url: config.url,
            env: config.env,
            timeout: config.timeout,
            enabled: config.enabled ?? true
          },
          logs: [], // Logs API not yet available
          uptime: statusInfo?.connected ? 'Active' : undefined,
          startTime: statusInfo?.startTime,
          pid: statusInfo?.pid,
          toolsCount: statusInfo?.toolsCount,
          resourcesCount: statusInfo?.resourcesCount,
          version: statusInfo?.version
        }
      })
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch servers'
      console.error('Fetch servers error:', e)
    } finally {
      loading.value = false
    }
  }

  async function addServer(serverData: Partial<Server>) {
    loading.value = true
    try {
      const payload = {
        name: serverData.name,
        type: serverData.config?.transport || 'stdio',
        command: serverData.config?.command,
        args: serverData.config?.args,
        env: serverData.config?.env,
        timeout: serverData.config?.timeout,
        enabled: serverData.config?.enabled ?? true,
        longRunning: true
      }
      await http.post('/web/servers', payload)
      await fetchServers()
    } catch (e: any) {
      error.value = e.message || 'Failed to add server'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateServer(id: string, serverData: Partial<Server>) {
    loading.value = true
    try {
      const payload: any = {}
      if (serverData.name) payload.name = serverData.name
      if (serverData.config) {
        if (serverData.config.transport) payload.type = serverData.config.transport
        if (serverData.config.command) payload.command = serverData.config.command
        if (serverData.config.args) payload.args = serverData.config.args
        if (serverData.config.env) payload.env = serverData.config.env
        if (serverData.config.url) payload.url = serverData.config.url
        if (serverData.config.timeout !== undefined) payload.timeout = serverData.config.timeout
        if (serverData.config.enabled !== undefined) payload.enabled = serverData.config.enabled
      }
      
      console.log('Update server payload:', payload)
      await http.put(`/web/servers/${id}`, payload)
      await fetchServers()
    } catch (e: any) {
      error.value = e.message || 'Failed to update server'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function startServer(id: string) {
    try {
      await http.post(`/web/mcp/servers/${id}/connect`, {})
      await fetchServers()
    } catch (e: any) {
      error.value = e.message || 'Failed to start server'
      throw e
    }
  }

  async function stopServer(id: string) {
    try {
      await http.post(`/web/mcp/servers/${id}/disconnect`, {})
      await fetchServers()
    } catch (e: any) {
      error.value = e.message || 'Failed to stop server'
      throw e
    }
  }
  
  async function deleteServer(id: string) {
     try {
       await http.delete(`/web/servers/${id}`)
       await fetchServers()
       if (selectedServerId.value === id) {
         selectedServerId.value = null
       }
     } catch (e: any) {
       error.value = e.message || 'Failed to delete server'
       throw e
     }
  }

  function updateServerStatus(id: string, status: 'running' | 'stopped' | 'error') {
    const server = servers.value.find(s => s.id === id)
    if (server) {
      server.status = status
    }
  }

  async function fetchTools(serverId: string) {
    try {
      const tools = await http.get<any[]>(`/web/mcp/servers/${serverId}/tools`)
      const server = servers.value.find(s => s.id === serverId)
      if (server) {
        server.tools = tools
      }
      return tools
    } catch (e) {
      console.error('Fetch tools error:', e)
      return []
    }
  }

  async function fetchResources(serverId: string) {
    try {
      const resources = await http.get<any[]>(`/web/mcp/servers/${serverId}/resources`)
      const server = servers.value.find(s => s.id === serverId)
      if (server) {
        server.resources = resources
      }
      return resources
    } catch (e) {
      console.error('Fetch resources error:', e)
      return []
    }
  }

  async function fetchLogs(serverId: string) {
    try {
      const response = await http.get<{ data: LogEntry[] }>(`/web/servers/${serverId}/logs`)
      const server = servers.value.find(s => s.id === serverId)
      if (server) {
        server.logs = response.data
      }
    } catch (e) {
      console.error('Fetch logs error:', e)
    }
  }

  async function clearLogs(serverId: string) {
    try {
      await http.delete(`/web/servers/${serverId}/logs`)
      const server = servers.value.find(s => s.id === serverId)
      if (server) {
        server.logs = []
      }
    } catch (e) {
      console.error('Clear logs error:', e)
    }
  }

  return {
    servers,
    loading,
    error,
    selectedServerId,
    selectedServer,
    stats,
    selectServer,
    fetchServers,
    addServer,
    updateServer,
    startServer,
    stopServer,
    deleteServer,
    updateServerStatus,
    fetchTools,
    fetchResources,
    fetchLogs,
    clearLogs
  }
})
