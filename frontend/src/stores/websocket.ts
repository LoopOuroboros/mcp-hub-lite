/**
 * WebSocket 状态管理 Store
 * 管理与后端的 WebSocket 连接和事件处理
 */

import { defineStore } from 'pinia'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { WebSocketClient, createWebSocketClient } from '@utils/websocket'
import type { ServerMessage } from '@utils/websocket'
import { useServerStore } from '@stores/server'
import type { ServerStatus } from '@stores/server'
import { useToolCallsStore } from '@stores/tool-calls'
import { useSystemStore } from '@stores/system'
import { useClientStore } from '@stores/client'

// 从共享类型导入 WebSocket 事件类型常量
import { WEB_SOCKET_EVENT_TYPES } from '@shared/types/websocket.types'

export const useWebSocketStore = defineStore('websocket', () => {
  const connected = ref(false)
  const wsClient = ref<WebSocketClient | null>(null)
  const serverStore = useServerStore()

  /**
   * 获取服务器的历史日志
   */
  function fetchLogs(serverId: string, limit: number = 100, since?: number): void {
    if (wsClient.value) {
      wsClient.value.send({
        type: 'fetch-logs',
        serverId,
        limit,
        since
      })
    }
  }

  function connect(): void {
    // 构建 WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/ws`

    const ws = createWebSocketClient(url)

    ws.connect(
      (message: ServerMessage) => {
        handleServerMessage(message)
      },
      () => {
        // 连接成功
        connected.value = true
        console.log('WebSocket connected')

        // 订阅服务器状态和日志事件
        ws.send({
          type: 'subscribe',
          eventTypes: [
            WEB_SOCKET_EVENT_TYPES.SERVER_STATUS,
            WEB_SOCKET_EVENT_TYPES.LOG,
            WEB_SOCKET_EVENT_TYPES.TOOLS,
            WEB_SOCKET_EVENT_TYPES.RESOURCES,
            WEB_SOCKET_EVENT_TYPES.SERVER_ADDED,
            WEB_SOCKET_EVENT_TYPES.SERVER_UPDATED,
            WEB_SOCKET_EVENT_TYPES.SERVER_DELETED,
            WEB_SOCKET_EVENT_TYPES.SERVER_CONNECTED,
            WEB_SOCKET_EVENT_TYPES.SERVER_DISCONNECTED,
            WEB_SOCKET_EVENT_TYPES.TOOL_CALL_STARTED,
            WEB_SOCKET_EVENT_TYPES.TOOL_CALL_COMPLETED,
            WEB_SOCKET_EVENT_TYPES.TOOL_CALL_ERROR,
            WEB_SOCKET_EVENT_TYPES.CONFIGURATION_UPDATED,
            WEB_SOCKET_EVENT_TYPES.CLIENT_CONNECTED,
            WEB_SOCKET_EVENT_TYPES.CLIENT_DISCONNECTED
          ]
        })
      },
      () => {
        // 连接关闭
        connected.value = false
        console.log('WebSocket disconnected')
      },
      (error: Event) => {
        // 连接错误
        console.error('WebSocket error:', error)
      }
    )

    wsClient.value = ws
  }

  function disconnect(): void {
    wsClient.value?.disconnect()
    wsClient.value = null
    connected.value = false
  }

  const toolCallsStore = useToolCallsStore()
  const systemStore = useSystemStore()
  const clientStore = useClientStore()

  function handleServerMessage(message: ServerMessage): void {
    console.log('Received WebSocket message:', message)

    switch (message.type) {
      case WEB_SOCKET_EVENT_TYPES.SERVER_STATUS:
        handleServerStatusChange(message)
        break
      case WEB_SOCKET_EVENT_TYPES.LOG:
        handleLogEntry(message)
        break
      case WEB_SOCKET_EVENT_TYPES.TOOLS:
        handleToolsUpdated(message)
        break
      case WEB_SOCKET_EVENT_TYPES.RESOURCES:
        handleResourcesUpdated(message)
        break
      case WEB_SOCKET_EVENT_TYPES.SERVER_ADDED:
        handleServerAdded(message)
        break
      case WEB_SOCKET_EVENT_TYPES.SERVER_UPDATED:
        handleServerUpdated(message)
        break
      case WEB_SOCKET_EVENT_TYPES.SERVER_DELETED:
        handleServerDeleted(message)
        break
      case WEB_SOCKET_EVENT_TYPES.SERVER_CONNECTED:
        handleServerConnected(message)
        break
      case WEB_SOCKET_EVENT_TYPES.SERVER_DISCONNECTED:
        handleServerDisconnected(message)
        break
      case WEB_SOCKET_EVENT_TYPES.TOOL_CALL_STARTED:
        toolCallsStore.handleToolCallStarted(message.data)
        break
      case WEB_SOCKET_EVENT_TYPES.TOOL_CALL_COMPLETED:
        toolCallsStore.handleToolCallCompleted(message.data)
        break
      case WEB_SOCKET_EVENT_TYPES.TOOL_CALL_ERROR:
        toolCallsStore.handleToolCallError(message.data)
        break
      case WEB_SOCKET_EVENT_TYPES.CONFIGURATION_UPDATED:
        handleConfigurationUpdated(message)
        break
      case WEB_SOCKET_EVENT_TYPES.CLIENT_CONNECTED:
        handleClientConnected(message)
        break
      case WEB_SOCKET_EVENT_TYPES.CLIENT_DISCONNECTED:
        handleClientDisconnected(message)
        break
      case WEB_SOCKET_EVENT_TYPES.PONG:
        // 心跳响应，忽略
        break
      default:
        console.warn('Unknown WebSocket message type:', (message as any).type)
    }
  }

  function handleConfigurationUpdated(message: any): void {
    console.log('Configuration updated:', message.data)
    systemStore.fetchConfig()
  }

  function handleClientConnected(message: any): void {
    console.log('Client connected:', message.data)
    clientStore.fetchClients()
  }

  function handleClientDisconnected(message: any): void {
    console.log('Client disconnected:', message.data)
    clientStore.fetchClients()
  }

  function handleServerStatusChange(message: any): void {
    const { serverId, status, error } = message.data
    serverStore.updateServerStatus(serverId, mapStatus(status))

    if (error) {
      console.error(`Server ${serverId} error:`, error)
    }
  }

  function handleLogEntry(message: any): void {
    const { serverId, logs } = message.data
    const server = serverStore.servers.find(s => s.id === serverId)
    if (server && logs && logs.length > 0) {
      // 如果是完整日志（大于1条），替换现有日志
      if (logs.length > 1) {
        server.logs = logs
      } else {
        // 增量日志，追加到现有日志
        const logEntry = logs[0]
        if (logEntry && logEntry.timestamp) {
          server.logs.push({
            timestamp: logEntry.timestamp,
            level: logEntry.level,
            message: logEntry.message
          })
        }
      }

      // 限制日志条数，防止内存泄漏
      const maxLogs = 1000
      if (server.logs.length > maxLogs) {
        server.logs.splice(0, server.logs.length - maxLogs)
      }
    }
  }

  function handleToolsUpdated(message: any): void {
    const { serverId, tools } = message.data
    const server = serverStore.servers.find(s => s.id === serverId)
    if (server) {
      server.tools = tools
      server.toolsCount = tools.length
    }
  }

  function handleResourcesUpdated(message: any): void {
    const { serverId, resources } = message.data
    const server = serverStore.servers.find(s => s.id === serverId)
    if (server) {
      server.resources = resources
      server.resourcesCount = resources.length
    }
  }

  function handleServerAdded(message: any): void {
    console.log('Server added:', message.data)
    serverStore.fetchServers()
  }

  // 服务器更新事件发射器

  function handleServerUpdated(message: any): void {
    console.log('Server updated:', message.data)
    serverStore.fetchServers()
  }

  function handleServerDeleted(message: any): void {
    console.log('Server deleted:', message.data)
    serverStore.fetchServers()
  }

  function handleServerConnected(message: any): void {
    const { serverId } = message.data
    serverStore.updateServerStatus(serverId, 'online')
  }

  function handleServerDisconnected(message: any): void {
    const { serverId } = message.data
    serverStore.updateServerStatus(serverId, 'offline')
  }

  function mapStatus(status: string): ServerStatus {
    const validStatuses: ServerStatus[] = ['online', 'offline', 'error', 'starting', 'stopping']
    return validStatuses.includes(status as ServerStatus) ? (status as ServerStatus) : 'starting'
  }

  // 组件挂载时连接
  onMounted(() => {
    connect()
  })

  // 组件卸载前断开连接
  onBeforeUnmount(() => {
    disconnect()
  })

  return {
    connected,
    connect,
    disconnect,
    fetchLogs
  }
})
