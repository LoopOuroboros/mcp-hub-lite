import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@utils/http'
import { useWebSocketStore } from '@stores/websocket'
import type { McpServerConfig, ServerInstanceConfig, LogEntry, Server } from '@shared-models/server.model'
import type { ServerStatus } from '@shared-types/common.types'
import type { Tool } from '@shared-models/tool.model'
import type { Resource } from '@shared-models/resource.model'

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

export type { Server, ServerStatus, McpServerConfig, ServerInstanceConfig, LogEntry, Tool, Resource }

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
    running: servers.value.filter(s => s.status === 'online').length,
    errors: servers.value.filter(s => s.status === 'error').length
  }))

  function selectServer(id: string | null) {
    selectedServerId.value = id
  }

  async function fetchServers() {
    loading.value = true
    error.value = null
    try {
      const [serverConfigs, serverInstances, statuses] = await Promise.all([
        http.get<Array<{ name: string; config: McpServerConfig }>>('/web/servers'),
        http.get<Record<string, ServerInstanceConfig[]>>('/web/server-instances'),
        http.get<McpStatus[]>('/web/mcp/status')
      ])

      const existingLogs = new Map(servers.value.map(s => [s.id, s.logs]))
      const existingTools = new Map(servers.value.map(s => [s.id, s.tools]))
      const existingResources = new Map(servers.value.map(s => [s.id, s.resources]))

      // 显示所有服务器配置，包括没有实例的
      const combinedServers: Server[] = []

      serverConfigs.forEach(({ name: serverName, config: serverConfig }) => {
        // 获取该服务器名称对应的所有实例
        const instances = serverInstances[serverName] || []

        if (instances.length > 0) {
          // 有实例的情况 - 保持原有逻辑
          instances.forEach((instanceConfig) => {
            const serverId = instanceConfig.id // 使用实例ID作为服务器唯一ID
            const statusInfo = statuses.find(s => s.id === serverId)?.status

            // 根据 config.enabled 和 statusInfo 来判断状态
            let status: ServerStatus
            if (statusInfo?.connected) {
              status = 'online'
            } else if (statusInfo?.error) {
              status = 'error'
            } else if (serverConfig.enabled) {
              // 如果配置为 enabled 但尚未连接，显示为 starting
              status = 'starting'
            } else {
              status = 'offline'
            }

            combinedServers.push({
              id: serverId,
              name: serverName,
              status,
              type: serverConfig.type === 'sse' || serverConfig.type === 'streamable-http' ? 'remote' : 'local',
              config: serverConfig,
              instance: instanceConfig,
              logs: existingLogs.get(serverId) || [],
              tools: existingTools.get(serverId),
              resources: existingResources.get(serverId),
              uptime: statusInfo?.connected ? 'Active' : undefined,
              startTime: statusInfo?.startTime,
              pid: statusInfo?.pid,
              toolsCount: statusInfo?.toolsCount,
              resourcesCount: statusInfo?.resourcesCount,
              version: statusInfo?.version
            })
          })
        } else {
          // 没有实例的情况 - 创建一个虚拟实例用于显示
          const serverId = `config-${serverName}-${Date.now()}`

          // 根据配置的 enabled 状态确定显示状态
          let status: ServerStatus
          if (serverConfig.enabled) {
            status = 'starting' // 配置为启用但未启动
          } else {
            status = 'offline' // 配置为禁用
          }

          combinedServers.push({
            id: serverId,
            name: serverName,
            status,
            type: serverConfig.type === 'sse' || serverConfig.type === 'streamable-http' ? 'remote' : 'local',
            config: serverConfig,
            instance: {
              id: serverId,
              timestamp: Date.now(),
              hash: 'config-only'
            },
            logs: existingLogs.get(serverId) || [],
            tools: existingTools.get(serverId),
            resources: existingResources.get(serverId),
            uptime: undefined,
            startTime: undefined,
            pid: undefined,
            toolsCount: 0,
            resourcesCount: 0,
            version: undefined
          })
        }
      })

      servers.value = combinedServers
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to fetch servers'
      } else {
        error.value = String(e) || 'Failed to fetch servers'
      }
      console.error('Fetch servers error:', e)
    } finally {
      loading.value = false
    }
  }

  async function addServer(serverData: Partial<Server>) {
    loading.value = true
    try {
      // 第一步：创建服务器基础配置
      const serverBasePayload = {
        name: serverData.name || 'Unnamed Server',
        config: serverData.config || {}
      }

      await http.post<{ name: string; config: McpServerConfig }>('/web/servers', serverBasePayload)

      // 第二步：添加服务器实例配置（现在自动在后端完成）

      // 如果启用了自动启动，立即更新状态为 starting，提供更好的用户体验
      if (serverData.config?.enabled) {
        await fetchServers() // 先获取服务器列表以获取新服务器的 ID
        const newServer = servers.value.find(s => s.name === serverData.name)
        if (newServer) {
          updateServerStatus(newServer.id, 'starting')

          // 等待连接完成（使用 setTimeout 避免阻塞 UI）
          setTimeout(async () => {
            await fetchServers() // 再次获取服务器状态，确保显示最终状态
          }, 1000)
        }
      } else {
        await fetchServers()
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to add server'
      } else {
        error.value = String(e) || 'Failed to add server'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateServer(id: string, serverData: Partial<Server>) {
    loading.value = true
    try {
      const server = servers.value.find(s => s.id === id)
      if (!server) {
        throw new Error('Server not found')
      }

      if (serverData.name && serverData.name !== server.name) {
        // 更新服务器基础配置（名称）
        await http.put(`/web/servers/${server.name}`, { name: serverData.name })
      }

      if (serverData.config) {
        // 更新服务器配置
        const payload: Partial<McpServerConfig> = {}
        if (serverData.config.command) payload.command = serverData.config.command
        if (serverData.config.args) payload.args = serverData.config.args
        if (serverData.config.env) payload.env = serverData.config.env
        if (serverData.config.url) payload.url = serverData.config.url
        if (serverData.config.timeout !== undefined) payload.timeout = serverData.config.timeout
        if (serverData.config.enabled !== undefined) payload.enabled = serverData.config.enabled
        if (serverData.config.allowedTools !== undefined) payload.allowedTools = serverData.config.allowedTools
        if (serverData.config.type) payload.type = serverData.config.type
        if (serverData.config.tags) payload.tags = serverData.config.tags

        await http.put(`/web/servers/${server.name}`, payload)
      }

      await fetchServers()
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to update server'
      } else {
        error.value = String(e) || 'Failed to update server'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function startServer(id: string) {
    try {
      const server = servers.value.find(s => s.id === id)
      if (!server) {
        throw new Error('Server not found')
      }

      // 立即更新状态为 starting，提供更好的用户体验
      updateServerStatus(id, 'starting')

      let actualServerId = id

      // 如果是配置-only的服务器（虚拟ID），需要创建实例
      if (id.startsWith('config-')) {
        // 创建服务器实例
        const response = await http.post<ServerInstanceConfig>(`/web/server-instances/${server.name}`, {})
        actualServerId = response.id
      }

      // 连接服务器（使用实际的实例ID）
      await http.post(`/web/mcp/servers/${actualServerId}/connect`, {})
      await fetchServers()
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to start server'
      } else {
        error.value = String(e) || 'Failed to start server'
      }
      // 失败时更新为 error 状态
      updateServerStatus(id, 'error')
      throw e
    }
  }

  async function stopServer(id: string) {
    try {
      const server = servers.value.find(s => s.id === id)
      if (!server) {
        throw new Error('Server not found')
      }

      // 如果是配置-only的服务器，不需要断开连接
      if (id.startsWith('config-')) {
        await fetchServers()
        return
      }

      // 断开服务器连接（使用实例ID）
      await http.post(`/web/mcp/servers/${id}/disconnect`, {})
      await fetchServers()
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to stop server'
      } else {
        error.value = String(e) || 'Failed to stop server'
      }
      throw e
    }
  }

  async function deleteServer(id: string) {
    try {
      const server = servers.value.find(s => s.id === id)
      if (server) {
        // 如果是配置-only的服务器（虚拟ID），直接删除整个服务器配置
        if (id.startsWith('config-')) {
          await http.delete(`/web/servers/${server.name}`)
        } else {
          // 检查是否还有其他实例
          const serverInstances = await http.get<Record<string, ServerInstanceConfig[]>>('/web/server-instances')
          const instances = serverInstances[server.name] || []

          if (instances.length > 1) {
            // 如果还有其他实例，只删除该实例
            const instanceIndex = instances.findIndex(inst => inst.id === id)
            if (instanceIndex !== -1) {
              await http.delete(`/web/server-instances/${server.name}/${instanceIndex}`)
            }
          } else {
            // 如果是最后一个实例，删除整个服务器
            await http.delete(`/web/servers/${server.name}`)
          }
        }
      }

      await fetchServers()
      if (selectedServerId.value === id) {
        selectedServerId.value = null
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to delete server'
      } else {
        error.value = String(e) || 'Failed to delete server'
      }
      throw e
    }
  }

  async function importServersFromJson(jsonData: { mcpServers: Record<string, unknown> }) {
    loading.value = true
    try {
      // 转换为新的配置结构
      const formattedData = {
        mcpServers: Object.entries(jsonData.mcpServers).map(([key, config]) => ({
          name: key,
          config: config
        }))
      }

      const response = await http.post<{
        code: number
        message: string
        data: {
          success: Server[]
          errors: { name: string; error: string }[]
        }
      }>('/web/servers/batch', formattedData)

      await fetchServers()
      return response.data
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to import servers'
      } else {
        error.value = String(e) || 'Failed to import servers'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  function updateServerStatus(id: string, status: ServerStatus) {
    const server = servers.value.find(s => s.id === id)
    if (server) {
      server.status = status
    }
  }

  async function fetchTools(serverId: string) {
    try {
      const tools = await http.get<Tool[]>(`/web/mcp/servers/${serverId}/tools`)
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
      const resources = await http.get<Resource[]>(`/web/mcp/servers/${serverId}/resources`)
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

  /**
   * 使用 WebSocket 获取服务器日志
   * 不再使用 HTTP 请求，改为通过 WebSocket 订阅和获取
   */
  function fetchLogs(serverId: string) {
    // 获取 WebSocket store 实例
    const wsStore = useWebSocketStore()
    wsStore.fetchLogs(serverId, 100) // 获取最新的 100 条日志
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

  function fetchAllLogs() {
    servers.value.forEach(s => fetchLogs(s.id))
  }

  async function readResource(serverName: string, uri: string) {
    try {
      const url = `/web/servers/${encodeURIComponent(serverName)}/resources/read?uri=${encodeURIComponent(uri)}`
      const response = await http.get<{ contents: { uri: string; mimeType: string; text?: string; blob?: string }[] }>(url)
      return response.contents[0]
    } catch (e: unknown) {
      console.error('Failed to read resource:', e)
      throw e
    }
  }

  async function fetchAllResources() {
    try {
      const response = await http.get<{ resources: Record<string, Resource[]> }>('/web/resources')
      return response.resources
    } catch (e: unknown) {
      console.error('Failed to fetch all resources:', e)
      throw e
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
    importServersFromJson,
    updateServerStatus,
    fetchTools,
    fetchResources,
    fetchLogs,
    fetchAllLogs,
    clearLogs,
    readResource,
    fetchAllResources
  }
})
