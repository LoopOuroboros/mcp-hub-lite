import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ServerConfig {
  transport: 'stdio' | 'sse'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

export interface Server {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error'
  type: 'local' | 'remote'
  config: ServerConfig
  logs: string[]
  uptime?: string
  pid?: number
}

export const useServerStore = defineStore('server', () => {
  const servers = ref<Server[]>([
    {
      id: '1',
      name: 'Filesystem Server (Local)',
      status: 'running',
      type: 'local',
      config: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/username/Documents/Projects'],
        env: { NODE_ENV: 'development' }
      },
      uptime: '02:15:30',
      pid: 45120,
      logs: [
        '[SYSTEM - 10:00:01] Starting process: npx -y @modelcontextprotocol/server-filesystem...',
        '[STDOUT - 10:00:03] Filesystem server running on stdio.',
        '--> [MCP REQUEST] { "jsonrpc": "2.0", "id": 1, "method": "initialize" }',
        '<-- [MCP RESPONSE] { "jsonrpc": "2.0", "id": 1, "result": { "serverInfo": {...} } }'
      ]
    },
    {
      id: '2',
      name: 'PostgreSQL DB (Prod)',
      status: 'stopped',
      type: 'remote',
      config: {
        transport: 'sse',
        url: 'http://localhost:3000/sse'
      },
      logs: []
    },
    {
      id: '3',
      name: 'Brave Search (Web)',
      status: 'error',
      type: 'local',
      config: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search']
      },
      logs: [
        '[STDERR - 10:05:20] Error: API Key not found'
      ]
    }
  ])

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

  function addServer(server: Server) {
    servers.value.push(server)
  }

  function updateServerStatus(id: string, status: 'running' | 'stopped' | 'error') {
    const server = servers.value.find(s => s.id === id)
    if (server) {
      server.status = status
    }
  }

  return {
    servers,
    selectedServerId,
    selectedServer,
    stats,
    selectServer,
    addServer,
    updateServerStatus
  }
})
