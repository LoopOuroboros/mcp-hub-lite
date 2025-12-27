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

export const useServerStore = defineStore('server', () => {
  const servers = ref<McpServer[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchServers() {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetch('/api/servers');
      if (!response.ok) throw new Error('Failed to fetch servers');
      servers.value = await response.json();
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function addServer(server: McpServer) {
    loading.value = true;
    try {
      const response = await fetch('/api/servers', {
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
      const response = await fetch(`/api/servers/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete server');
      servers.value = servers.value.filter(s => s.id !== id);
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  return {
    servers,
    loading,
    error,
    fetchServers,
    addServer,
    removeServer
  };
});
