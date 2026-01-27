/**
 * WebSocket 状态管理 Store
 * 管理与后端的 WebSocket 连接和事件处理
 */

import { defineStore } from 'pinia'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { WebSocketClient, createWebSocketClient } from '../utils/websocket'
import type { ServerMessage } from '../utils/websocket'
import { useServerStore } from './server'
import { useToolCallsStore } from './tool-calls'
import { useSystemStore } from './system'
import { useClientStore } from './client'

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
            'server-status',
            'logs',
            'tools',
            'resources',
            'server-added',
            'server-updated',
            'server-deleted',
            'server-connected',
            'server-disconnected',
            'tool-call-started',
            'tool-call-completed',
            'tool-call-error',
            'configuration-updated',
            'client-connected',
            'client-disconnected'
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
      case 'server-status':
        handleServerStatusChange(message)
        break
      case 'log':
        handleLogEntry(message)
        break
      case 'tools':
        handleToolsUpdated(message)
        break
      case 'resources':
        handleResourcesUpdated(message)
        break
      case 'server-added':
        handleServerAdded(message)
        break
      case 'server-updated':
        handleServerUpdated(message)
        break
      case 'server-deleted':
        handleServerDeleted(message)
        break
      case 'server-connected':
        handleServerConnected(message)
        break
      case 'server-disconnected':
        handleServerDisconnected(message)
        break
      case 'tool-call-started':
        toolCallsStore.handleToolCallStarted(message.data)
        break
      case 'tool-call-completed':
        toolCallsStore.handleToolCallCompleted(message.data)
        break
      case 'tool-call-error':
        toolCallsStore.handleToolCallError(message.data)
        break
      case 'configuration-updated':
        handleConfigurationUpdated(message)
        break
      case 'client-connected':
        handleClientConnected(message)
        break
      case 'client-disconnected':
        handleClientDisconnected(message)
        break
      case 'pong':
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
    const { serverId, status, error, timestamp } = message.data
    serverStore.updateServerStatus(serverId, mapStatus(status))

    if (error) {
      console.error(`Server ${serverId} error:`, error)
    }
  }

  function handleLogEntry(message: any): void {
    const { serverId, logs } = message.data
    const server = serverStore.servers.find(s => s.id === serverId)
    if (server) {
      // 如果是完整日志（大于1条），替换现有日志
      if (logs.length > 1) {
        server.logs = logs
      } else {
        // 增量日志，追加到现有日志
        server.logs.push({
          timestamp: logs[0].timestamp,
          level: logs[0].level,
          message: logs[0].message
        })
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
    serverStore.updateServerStatus(serverId, 'running')
  }

  function handleServerDisconnected(message: any): void {
    const { serverId } = message.data
    serverStore.updateServerStatus(serverId, 'stopped')
  }

  function mapStatus(status: string): 'running' | 'stopped' | 'error' | 'starting' {
    switch (status) {
      case 'online':
        return 'running'
      case 'offline':
        return 'stopped'
      case 'error':
        return 'error'
      default:
        return 'starting'
    }
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
