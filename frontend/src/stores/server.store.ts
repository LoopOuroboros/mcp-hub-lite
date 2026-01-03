import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface McpServer {
  id?: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface ServerStatus {
  connected: boolean;
  error?: string;
  lastCheck: number;
  toolsCount: number;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: any;
  serverId: string;
}

export const useServerStore = defineStore('server', () => {
  const servers = ref<McpServer[]>([]);
  const serverStatuses = ref<Record<string, ServerStatus>>({});
  const tools = ref<McpTool[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchServers() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/web/servers');
      if (!response.ok) throw new Error('Failed to fetch servers');
      servers.value = await response.json();
      await fetchStatus();
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchStatus() {
    try {
      const response = await fetch('/web/mcp/status');
      if (response.ok) {
        const data = await response.json();
        data.forEach((item: any) => {
          serverStatuses.value[item.id] = item.status;
        });
      }
    } catch (e) {
      console.error('Failed to fetch status', e);
    }
  }

  async function addServer(server: McpServer) {
    loading.value = true;
    try {
      const response = await fetch('/web/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(server)
      });
      if (!response.ok) throw new Error('Failed to add server');
      const newServer = await response.json();
      servers.value.push(newServer);
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function removeServer(id: string) {
    loading.value = true;
    try {
      const response = await fetch(`/web/servers/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete server');
      servers.value = servers.value.filter(s => s.id !== id);
      delete serverStatuses.value[id];
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function connectServer(id: string) {
    try {
        await fetch(`/web/mcp/servers/${id}/connect`, { method: 'POST' });
        await fetchStatus();
    } catch (e: any) {
        error.value = e.message;
    }
  }

  async function disconnectServer(id: string) {
    try {
        await fetch(`/web/mcp/servers/${id}/disconnect`, { method: 'POST' });
        await fetchStatus();
    } catch (e: any) {
        error.value = e.message;
    }
  }

  async function searchTools(query: string) {
    try {
        const response = await fetch(`/web/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
             const results = await response.json();
             tools.value = results.map((r: any) => r.tool);
        }
    } catch (e: any) {
        error.value = e.message;
    }
  }

  return {
    servers,
    serverStatuses,
    tools,
    loading,
    error,
    fetchServers,
    fetchStatus,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    searchTools
  };
});
