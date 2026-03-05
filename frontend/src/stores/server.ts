/**
 * Server Store Module
 *
 * Pinia store for managing MCP server state and operations in the frontend application.
 * This store handles all server-related data fetching, state management, and CRUD operations.
 *
 * Features:
 * - Server configuration and instance management
 * - Real-time status tracking and updates
 * - Tool and resource discovery
 * - Log management via WebSocket integration
 * - Error handling and loading states
 * - Statistics computation for dashboard display
 *
 * The store integrates with both REST API endpoints and WebSocket connections
 * for comprehensive server management capabilities.
 */

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

// Re-export types for external consumption
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

/**
 * Creates and returns the server store instance
 *
 * @returns {Object} Pinia store object with state, getters, and actions
 */
export const useServerStore = defineStore('server', () => {
  /**
   * Reactive state variables
   *
   * @type {Ref<Server[]>} servers - Array of all managed servers
   * @type {Ref<boolean>} loading - Loading state indicator
   * @type {Ref<string|null>} error - Current error message or null
   * @type {Ref<string|null>} selectedServerId - ID of currently selected server
   */
  const servers = ref<Server[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedServerId = ref<string | null>(null);

  /**
   * Computed property that returns the currently selected server
   *
   * @returns {Server|undefined} Selected server object or undefined if not found
   */
  const selectedServer = computed(() => servers.value.find((s) => s.id === selectedServerId.value));

  /**
   * Computed property that provides server statistics
   *
   * @returns {Object} Statistics object with total, online, and error counts
   */
  const stats = computed(() => ({
    total: servers.value.length,
    online: servers.value.filter((s) => s.status === 'online').length,
    errors: servers.value.filter((s) => s.status === 'error').length
  }));

  /**
   * Selects a server by ID
   *
   * @param {string|null} id - Server ID to select or null to deselect
   */
  function selectServer(id: string | null) {
    selectedServerId.value = id;
  }

  /**
   * Fetches all servers from the backend API
   *
   * Combines server configurations, instances, and status information
   * to create a comprehensive view of all managed servers.
   * Handles both servers with active instances and configuration-only servers.
   *
   * @async
   * @returns {Promise<void>}
   */
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

  /**
   * Adds a new server configuration
   *
   * Creates both the base server configuration and handles instance creation
   * if auto-start is enabled. Provides immediate UI feedback during server startup.
   *
   * @async
   * @param {Partial<Server>} serverData - Server configuration data
   * @returns {Promise<void>}
   * @throws {Error} If server creation fails
   */
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

  /**
   * Updates an existing server configuration
   *
   * Handles both server name changes and configuration updates separately
   * to ensure proper API endpoint usage.
   *
   * @async
   * @param {string} id - Server ID to update
   * @param {Partial<Server>} serverData - Updated server data
   * @returns {Promise<void>}
   * @throws {Error} If server not found or update fails
   */
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
        if (serverData.config.description !== undefined)
          payload.description = serverData.config.description;

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

  /**
   * Starts a server instance
   *
   * Handles both regular server instances and config-only servers that need
   * instance creation before starting. Provides immediate UI feedback with
   * status updates.
   *
   * @async
   * @param {string} id - Server ID to start
   * @returns {Promise<void>}
   * @throws {Error} If server not found or start fails
   */
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

  /**
   * Stops a server instance
   *
   * Handles config-only servers by simply refreshing the server list,
   * and regular instances by calling the disconnect API endpoint.
   *
   * @async
   * @param {string} id - Server ID to stop
   * @returns {Promise<void>}
   * @throws {Error} If server not found or stop fails
   */
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

  /**
   * Deletes a server or server instance
   *
   * Handles both config-only servers (deletes entire configuration) and
   * regular instances (deletes instance or entire server if it's the last one).
   * Also handles cleanup of selected server state.
   *
   * @async
   * @param {string} id - Server ID to delete
   * @returns {Promise<void>}
   * @throws {Error} If deletion fails
   */
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

  /**
   * Imports multiple servers from JSON configuration
   *
   * Converts legacy JSON format to the new batch import format and
   * processes the import through the batch API endpoint.
   *
   * @async
   * @param {Object} jsonData - JSON data containing mcpServers object
   * @param {Record<string, unknown>} jsonData.mcpServers - Server configurations
   * @returns {Promise<Object>} Import results with success and error arrays
   * @throws {Error} If import fails
   */
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

  /**
   * Updates the status of a specific server
   *
   * Directly modifies the server status in the local state without API calls.
   * Used for immediate UI feedback during server operations.
   *
   * @param {string} id - Server ID to update
   * @param {ServerStatus} status - New status value
   */
  function updateServerStatus(id: string, status: ServerStatus) {
    const server = servers.value.find((s) => s.id === id);
    if (server) {
      server.status = status;
    }
  }

  /**
   * Fetches tools available from a specific server
   *
   * Retrieves tool definitions from the server and updates the local state.
   * Includes error handling to prevent crashes on failed requests.
   *
   * @async
   * @param {string} serverId - Server ID to fetch tools from
   * @returns {Promise<Tool[]>} Array of available tools
   */
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

  /**
   * Fetches resources available from a specific server
   *
   * Retrieves resource definitions from the server and updates the local state.
   * Includes error handling to prevent crashes on failed requests.
   *
   * @async
   * @param {string} serverId - Server ID to fetch resources from
   * @returns {Promise<Resource[]>} Array of available resources
   */
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

  /**
   * Clears logs for a specific server
   *
   * Makes an API call to clear server logs and updates local state.
   * Includes error handling to prevent crashes on failed requests.
   *
   * @async
   * @param {string} serverId - Server ID to clear logs for
   * @returns {Promise<void>}
   */
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

  /**
   * Fetches logs for all servers
   *
   * Iterates through all servers and fetches their logs via WebSocket.
   */
  function fetchAllLogs() {
    servers.value.forEach((s) => fetchLogs(s.id));
  }

  /**
   * Reads content from a specific resource URI
   *
   * Makes an API call to read resource content and returns the first content item.
   *
   * @async
   * @param {string} serverName - Server name containing the resource
   * @param {string} uri - Resource URI to read
   * @returns {Promise<Object>} Resource content object
   * @throws {Error} If reading fails
   */
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

  /**
   * Fetches all available resources across all servers
   *
   * Makes an API call to retrieve all resources and returns them grouped by server.
   *
   * @async
   * @returns {Promise<Record<string, Resource[]>>} Resources grouped by server name
   * @throws {Error} If fetching fails
   */
  async function fetchAllResources() {
    try {
      const response = await http.get<{ resources: Record<string, Resource[]> }>('/web/resources');
      return response.resources;
    } catch (e: unknown) {
      console.error('Failed to fetch all resources:', e);
      throw e;
    }
  }

  // Return public API
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
