import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { http } from '@utils/http';
import { useWebSocketStore } from '@stores/websocket';
import type {
  ServerConfig,
  ServerInstanceConfig,
  LogEntry,
  Server,
  StatusInfo
} from '@shared-models/server.model';
import type { ServerStatus } from '@shared-types/common.types';
import type { Tool } from '@shared-models/tool.model';
import type { Resource } from '@shared-models/resource.model';

export type {
  Server,
  ServerStatus,
  ServerConfig,
  ServerInstanceConfig,
  LogEntry,
  Tool,
  Resource,
  StatusInfo
};

export const useServerStore = defineStore('server', () => {
  const servers = ref<Server[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedServerId = ref<string | null>(null);

  const selectedServer = computed(() => servers.value.find((s) => s.id === selectedServerId.value));

  const stats = computed(() => ({
    total: servers.value.length,
    running: servers.value.filter((s) => s.status === 'online').length,
    errors: servers.value.filter((s) => s.status === 'error').length
  }));

  function selectServer(id: string | null) {
    selectedServerId.value = id;
  }

  async function fetchServers() {
    loading.value = true;
    error.value = null;
    try {
      const [serverConfigs, serverInstances, statuses] = await Promise.all([
        http.get<Array<{ name: string; config: ServerConfig }>>('/web/servers'),
        http.get<Record<string, ServerInstanceConfig[]>>('/web/server-instances'),
        http.get<StatusInfo[]>('/web/mcp/status')
      ]);

      const existingLogs = new Map(servers.value.map((s) => [s.id, s.logs]));
      const existingTools = new Map(servers.value.map((s) => [s.id, s.tools]));
      const existingResources = new Map(servers.value.map((s) => [s.id, s.resources]));

      // Display all server configurations, including those without instances
      const combinedServers: Server[] = [];

      serverConfigs.forEach(({ name: serverName, config: serverConfig }) => {
        // Get all instances corresponding to this server name
        const instances = serverInstances[serverName] || [];

        if (instances.length > 0) {
          // Case with instances - keep original logic
          instances.forEach((instanceConfig) => {
            const serverId = instanceConfig.id; // Use instance ID as unique server ID
            const statusInfo = statuses.find((s) => s.id === serverId)?.status;

            // Determine status based on config.enabled and statusInfo
            let status: ServerStatus;
            if (statusInfo?.connected) {
              status = 'online';
            } else if (statusInfo?.error) {
              status = 'error';
            } else if (serverConfig.enabled) {
              // If configured as enabled but not yet connected, show as starting
              status = 'starting';
            } else {
              status = 'offline';
            }

            combinedServers.push({
              id: serverId,
              name: serverName,
              status,
              type:
                serverConfig.type === 'sse' || serverConfig.type === 'streamable-http'
                  ? 'remote'
                  : 'local',
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
            });
          });
        } else {
          // Case without instances - create a virtual instance for display
          const serverId = `config-${serverName}-${Date.now()}`;

          // Determine display status based on configured enabled state
          let status: ServerStatus;
          if (serverConfig.enabled) {
            status = 'starting'; // Configured as enabled but not started
          } else {
            status = 'offline'; // Configured as disabled
          }

          combinedServers.push({
            id: serverId,
            name: serverName,
            status,
            type:
              serverConfig.type === 'sse' || serverConfig.type === 'streamable-http'
                ? 'remote'
                : 'local',
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
          });
        }
      });

      servers.value = combinedServers;
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to fetch servers';
      } else {
        error.value = String(e) || 'Failed to fetch servers';
      }
      console.error('Fetch servers error:', e);
    } finally {
      loading.value = false;
    }
  }

  async function addServer(serverData: Partial<Server>) {
    loading.value = true;
    try {
      // Step 1: Create server base configuration
      const serverBasePayload = {
        name: serverData.name || 'Unnamed Server',
        config: serverData.config || {}
      };

      await http.post<{ name: string; config: ServerConfig }>('/web/servers', serverBasePayload);

      // Step 2: Add server instance configuration (now automatically handled by backend)

      // If auto-start is enabled, immediately update status to starting for better user experience
      if (serverData.config?.enabled) {
        await fetchServers(); // First fetch server list to get new server ID
        const newServer = servers.value.find((s) => s.name === serverData.name);
        if (newServer) {
          updateServerStatus(newServer.id, 'starting');

          // Wait for connection to complete (using setTimeout to avoid blocking UI)
          setTimeout(async () => {
            await fetchServers(); // Fetch server status again to ensure final state is displayed
          }, 1000);
        }
      } else {
        await fetchServers();
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to add server';
      } else {
        error.value = String(e) || 'Failed to add server';
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function updateServer(id: string, serverData: Partial<Server>) {
    loading.value = true;
    try {
      const server = servers.value.find((s) => s.id === id);
      if (!server) {
        throw new Error('Server not found');
      }

      if (serverData.name && serverData.name !== server.name) {
        // Update server base configuration (name)
        await http.put(`/web/servers/${server.name}`, { name: serverData.name });
      }

      if (serverData.config) {
        // Update server configuration
        const payload: Partial<ServerConfig> = {};
        if (serverData.config.command) payload.command = serverData.config.command;
        if (serverData.config.args) payload.args = serverData.config.args;
        if (serverData.config.env) payload.env = serverData.config.env;
        if (serverData.config.url) payload.url = serverData.config.url;
        if (serverData.config.timeout !== undefined) payload.timeout = serverData.config.timeout;
        if (serverData.config.enabled !== undefined) payload.enabled = serverData.config.enabled;
        if (serverData.config.allowedTools !== undefined)
          payload.allowedTools = serverData.config.allowedTools;
        if (serverData.config.type) payload.type = serverData.config.type;
        if (serverData.config.tags) payload.tags = serverData.config.tags;

        await http.put(`/web/servers/${server.name}`, payload);
      }

      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to update server';
      } else {
        error.value = String(e) || 'Failed to update server';
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function startServer(id: string) {
    try {
      const server = servers.value.find((s) => s.id === id);
      if (!server) {
        throw new Error('Server not found');
      }

      // Immediately update status to starting for better user experience
      updateServerStatus(id, 'starting');

      let actualServerId = id;

      // If it's a config-only server (virtual ID), need to create an instance
      if (id.startsWith('config-')) {
        // Create server instance
        const response = await http.post<ServerInstanceConfig>(
          `/web/server-instances/${server.name}`,
          {}
        );
        actualServerId = response.id;
      }

      // Connect server (using actual instance ID)
      await http.post(`/web/mcp/servers/${actualServerId}/connect`, {});
      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to start server';
      } else {
        error.value = String(e) || 'Failed to start server';
      }
      // Update to error state on failure
      updateServerStatus(id, 'error');
      throw e;
    }
  }

  async function stopServer(id: string) {
    try {
      const server = servers.value.find((s) => s.id === id);
      if (!server) {
        throw new Error('Server not found');
      }

      // If it's a config-only server, no need to disconnect
      if (id.startsWith('config-')) {
        await fetchServers();
        return;
      }

      // Disconnect server (using instance ID)
      await http.post(`/web/mcp/servers/${id}/disconnect`, {});
      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to stop server';
      } else {
        error.value = String(e) || 'Failed to stop server';
      }
      throw e;
    }
  }

  async function deleteServer(id: string) {
    try {
      const server = servers.value.find((s) => s.id === id);
      if (server) {
        // If it's a config-only server (virtual ID), delete the entire server configuration directly
        if (id.startsWith('config-')) {
          await http.delete(`/web/servers/${server.name}`);
        } else {
          // Check if there are other instances
          const serverInstances =
            await http.get<Record<string, ServerInstanceConfig[]>>('/web/server-instances');
          const instances = serverInstances[server.name] || [];

          if (instances.length > 1) {
            // If there are other instances, only delete this instance
            const instanceIndex = instances.findIndex((inst) => inst.id === id);
            if (instanceIndex !== -1) {
              await http.delete(`/web/server-instances/${server.name}/${instanceIndex}`);
            }
          } else {
            // If it's the last instance, delete the entire server
            await http.delete(`/web/servers/${server.name}`);
          }
        }
      }

      await fetchServers();
      if (selectedServerId.value === id) {
        selectedServerId.value = null;
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to delete server';
      } else {
        error.value = String(e) || 'Failed to delete server';
      }
      throw e;
    }
  }

  async function importServersFromJson(jsonData: { mcpServers: Record<string, unknown> }) {
    loading.value = true;
    try {
      // Convert to new config structure
      const formattedData = {
        mcpServers: Object.entries(jsonData.mcpServers).map(([key, config]) => ({
          name: key,
          config: config
        }))
      };

      const response = await http.post<{
        code: number;
        message: string;
        data: {
          success: Server[];
          errors: { name: string; error: string }[];
        };
      }>('/web/servers/batch', formattedData);

      await fetchServers();
      return response.data;
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to import servers';
      } else {
        error.value = String(e) || 'Failed to import servers';
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function updateServerStatus(id: string, status: ServerStatus) {
    const server = servers.value.find((s) => s.id === id);
    if (server) {
      server.status = status;
    }
  }

  async function fetchTools(serverId: string) {
    try {
      const tools = await http.get<Tool[]>(`/web/mcp/servers/${serverId}/tools`);
      const server = servers.value.find((s) => s.id === serverId);
      if (server) {
        server.tools = tools;
      }
      return tools;
    } catch (e) {
      console.error('Fetch tools error:', e);
      return [];
    }
  }

  async function fetchResources(serverId: string) {
    try {
      const resources = await http.get<Resource[]>(`/web/mcp/servers/${serverId}/resources`);
      const server = servers.value.find((s) => s.id === serverId);
      if (server) {
        server.resources = resources;
      }
      return resources;
    } catch (e) {
      console.error('Fetch resources error:', e);
      return [];
    }
  }

  /**
   * Fetch server logs using WebSocket
   * No longer use HTTP requests, instead subscribe and fetch via WebSocket
   */
  function fetchLogs(serverId: string) {
    // Get WebSocket store instance
    const wsStore = useWebSocketStore();
    wsStore.fetchLogs(serverId, 100); // Fetch the latest 100 log entries
  }

  async function clearLogs(serverId: string) {
    try {
      await http.delete(`/web/servers/${serverId}/logs`);
      const server = servers.value.find((s) => s.id === serverId);
      if (server) {
        server.logs = [];
      }
    } catch (e) {
      console.error('Clear logs error:', e);
    }
  }

  function fetchAllLogs() {
    servers.value.forEach((s) => fetchLogs(s.id));
  }

  async function readResource(serverName: string, uri: string) {
    try {
      const url = `/web/servers/${encodeURIComponent(serverName)}/resources/read?uri=${encodeURIComponent(uri)}`;
      const response = await http.get<{
        contents: { uri: string; mimeType: string; text?: string; blob?: string }[];
      }>(url);
      return response.contents[0];
    } catch (e: unknown) {
      console.error('Failed to read resource:', e);
      throw e;
    }
  }

  async function fetchAllResources() {
    try {
      const response = await http.get<{ resources: Record<string, Resource[]> }>('/web/resources');
      return response.resources;
    } catch (e: unknown) {
      console.error('Failed to fetch all resources:', e);
      throw e;
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
  };
});
