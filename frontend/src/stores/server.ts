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
  ServerRuntimeConfig,
  ServerInstanceConfig,
  LogEntry,
  Server,
  StatusInfo,
  ServerConfig,
  ServerTemplate,
  ServerInstance
} from '@shared-models/server.model';
import type { ServerStatus } from '@shared-types/common.types';
import type { Tool } from '@shared-models/tool.model';
import type { Resource } from '@shared-models/resource.model';

// Re-export types for external consumption
export type {
  Server,
  ServerStatus,
  ServerRuntimeConfig,
  ServerInstanceConfig,
  LogEntry,
  Tool,
  Resource,
  StatusInfo,
  ServerConfig
};

/**
 * Server instance update payload interface
 */
export interface ServerInstanceUpdate {
  displayName?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  proxy?: { url: string };
  enabled?: boolean;
}

/**
 * Resolves the actual server configuration by merging template and instance
 *
 * @param template - The server template configuration
 * @param instance - The server instance configuration
 * @returns Merged server configuration
 */
function resolveInstanceConfig(
  template: ServerTemplate,
  instance: Partial<ServerInstance>
): ServerRuntimeConfig {
  return {
    command: template.command,
    args: template.args ?? [],
    env: { ...template.env, ...instance.env },
    headers: { ...template.headers, ...instance.headers },
    type: (template.type as 'stdio' | 'sse' | 'streamable-http' | 'http') || 'stdio',
    timeout: template.timeout ?? 60000,
    url: template.url,
    aggregatedTools: template.aggregatedTools ?? [],
    description: template.description,
    tags: instance.tags,
    proxy: instance.proxy ?? template.proxy,
    // v1.1 doesn't have enabled at template level, use instance level
    enabled: instance.enabled !== false
  };
}

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
   * Tracks in-flight start/stop operations to preserve optimistic transition states
   * across fetchServers() calls. Keyed by instance ID.
   */
  const pendingOperations = ref<
    Map<string, { status: 'starting' | 'stopping'; timestamp: number }>
  >(new Map());

  const PENDING_OP_STALE_MS = 30000;

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
      const [serverConfigs, statuses] = await Promise.all([
        http.get<Array<{ name: string; config: ServerConfig }>>('/web/servers'),
        http.get<StatusInfo[]>('/web/mcp/status')
      ]);

      const existingLogs = new Map(servers.value.map((s) => [s.id, s.logs]));
      const existingTools = new Map(servers.value.map((s) => [s.id, s.tools]));
      const existingResources = new Map(servers.value.map((s) => [s.id, s.resources]));

      // Display all server configurations, including those without instances
      const combinedServers: Server[] = [];

      serverConfigs.forEach(({ name: serverName, config: serverConfig }) => {
        // Handle backward compatibility for instanceSelectionStrategy in root level
        if (
          serverConfig &&
          typeof serverConfig === 'object' &&
          'instanceSelectionStrategy' in serverConfig &&
          serverConfig.instanceSelectionStrategy !== undefined
        ) {
          // Move instanceSelectionStrategy from root level to template
          interface LegacyServerConfig {
            instanceSelectionStrategy?: string;
            template: {
              instanceSelectionStrategy?: 'random' | 'round-robin' | 'tag-match-unique';
            };
          }
          const legacyConfig = serverConfig as LegacyServerConfig;
          const strategy = legacyConfig.instanceSelectionStrategy;
          if (typeof strategy === 'string') {
            serverConfig.template.instanceSelectionStrategy = strategy as
              | 'random'
              | 'round-robin'
              | 'tag-match-unique';
          }
          delete legacyConfig.instanceSelectionStrategy;
        }

        const template = serverConfig.template;
        const instances = serverConfig.instances || [];

        if (instances.length > 0) {
          // Case with instances - create ONE Server object aggregating all instances
          const serverId = serverName;

          // Compute per-instance status and build instances array
          const instanceConfigs: (ServerInstanceConfig & { status: ServerStatus })[] =
            instances.map((inst) => {
              const statusInfo = statuses.find((s) => s.id === inst.id)?.status;
              let instStatus: ServerStatus;
              if (statusInfo?.connected) {
                instStatus = 'online';
              } else if (statusInfo?.error) {
                instStatus = 'error';
              } else {
                // Preserve optimistic transition states from pending operations
                const pendingOp = pendingOperations.value.get(inst.id);
                if (pendingOp) {
                  instStatus = pendingOp.status;
                } else {
                  instStatus = 'offline';
                }
              }
              return {
                id: inst.id,
                timestamp: inst.timestamp ?? Date.now(),
                index: inst.index,
                displayName: inst.displayName,
                status: instStatus
              };
            });

          // Use first instance for resolved config and runtime info (guaranteed to exist since we're in the instances.length > 0 branch)
          const firstInstance = instances[0]!;
          const resolvedConfig = resolveInstanceConfig(template, firstInstance);

          // Aggregate status: any instance online → online, any instance error → error, else offline
          let anyOnline = false;
          let anyError = false;
          let totalToolsCount = 0;
          let totalResourcesCount = 0;
          let firstOnlineStartTime: number | undefined;
          let firstOnlinePid: number | undefined;
          let firstOnlineVersion: string | undefined;

          instances.forEach((inst) => {
            const statusInfo = statuses.find((s) => s.id === inst.id)?.status;
            if (statusInfo?.connected) {
              anyOnline = true;
              if (!firstOnlineStartTime) {
                firstOnlineStartTime = statusInfo.startTime;
                firstOnlinePid = statusInfo.pid;
                firstOnlineVersion = statusInfo.version;
              }
            } else if (statusInfo?.error) {
              anyError = true;
            }
            totalToolsCount += statusInfo?.toolsCount ?? 0;
            totalResourcesCount += statusInfo?.resourcesCount ?? 0;
          });

          const anyStarting = instanceConfigs.some((inst) => inst.status === 'starting');
          const status: ServerStatus = anyOnline
            ? 'online'
            : anyError
              ? 'error'
              : anyStarting
                ? 'starting'
                : 'offline';

          combinedServers.push({
            id: serverId,
            name: serverName,
            status,
            type:
              template.type === 'sse' ||
              template.type === 'streamable-http' ||
              template.type === 'http'
                ? 'remote'
                : 'local',
            config: resolvedConfig,
            instances: instanceConfigs,
            logs: existingLogs.get(serverId) || [],
            tools: existingTools.get(serverId),
            resources: existingResources.get(serverId),
            uptime: anyOnline ? 'Active' : undefined,
            startTime: firstOnlineStartTime ?? firstInstance.startTime,
            pid: firstOnlinePid ?? firstInstance.pid,
            toolsCount: totalToolsCount,
            resourcesCount: totalResourcesCount,
            version: firstOnlineVersion,
            rawV11Config: serverConfig
          });
        } else {
          // Case without instances - create a virtual instance for display
          const serverId = `config-${serverName}-${Date.now()}`;

          // Resolve base config from template
          const resolvedConfig = resolveInstanceConfig(template, { id: serverId });

          // Determine display status - v1.1 doesn't have template-level enabled,
          // default to offline for config-only servers
          const status: ServerStatus = 'offline';

          combinedServers.push({
            id: serverId,
            name: serverName,
            status,
            type:
              template.type === 'sse' ||
              template.type === 'streamable-http' ||
              template.type === 'http'
                ? 'remote'
                : 'local',
            config: resolvedConfig,
            instance: {
              id: serverId,
              timestamp: Date.now()
            },
            logs: existingLogs.get(serverId) || [],
            tools: existingTools.get(serverId),
            resources: existingResources.get(serverId),
            uptime: undefined,
            startTime: undefined,
            pid: undefined,
            toolsCount: 0,
            resourcesCount: 0,
            version: undefined,
            rawV11Config: serverConfig
          });
        }
      });

      servers.value = combinedServers;

      // Clean up stale pending operations
      const now = Date.now();
      for (const [id, op] of pendingOperations.value) {
        if (now - op.timestamp > PENDING_OP_STALE_MS) {
          pendingOperations.value.delete(id);
        }
      }
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

      await http.post<{ name: string; config: ServerRuntimeConfig }>(
        '/web/servers',
        serverBasePayload
      );

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
        // Update server configuration - use ServerTemplate type to include instanceSelectionStrategy
        const payload: Partial<ServerTemplate> = {};
        if (serverData.config.command) payload.command = serverData.config.command;
        if (serverData.config.args) payload.args = serverData.config.args;
        if (serverData.config.env) payload.env = serverData.config.env;
        if (serverData.config.headers !== undefined) payload.headers = serverData.config.headers;
        if (serverData.config.url) payload.url = serverData.config.url;
        if (serverData.config.timeout !== undefined) payload.timeout = serverData.config.timeout;
        if (serverData.config.aggregatedTools !== undefined)
          payload.aggregatedTools = serverData.config.aggregatedTools;
        if (serverData.config.type) payload.type = serverData.config.type;
        if (serverData.config.description !== undefined)
          payload.description = serverData.config.description;
        // Include instance selection strategy from template
        if (server.rawV11Config?.template.instanceSelectionStrategy !== undefined) {
          payload.instanceSelectionStrategy =
            server.rawV11Config.template.instanceSelectionStrategy;
        }

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
   * @param {string} id - Server/instance ID to start
   * @returns {Promise<void>}
   * @throws {Error} If start fails
   */
  /**
   * Finds a server by instance ID in the instances array
   *
   * @param {string} instanceId - The instance ID to search for
   * @returns {Server|undefined} The server containing the instance, or undefined
   */
  function findServerByInstanceId(instanceId: string) {
    for (const server of servers.value) {
      if (server.instances?.some((inst) => inst.id === instanceId)) {
        return server;
      }
    }
    return undefined;
  }

  async function startServer(id: string) {
    try {
      console.log('[startServer] Starting server/instance:', id);
      const server = servers.value.find((s) => s.id === id);
      let actualServerId = id;

      // If we found a server and it's a config-only server, need to create an instance
      if (server && id.startsWith('config-')) {
        // Immediately update status to starting for better user experience
        updateServerStatus(id, 'starting');

        // Create server instance
        const response = await http.post<ServerInstanceConfig>(
          `/web/server-instances/${server.name}`,
          {}
        );
        actualServerId = response.id;
      } else {
        // Try to find the server by instance in instances array to update status
        const serverByInstance = findServerByInstanceId(id);
        if (serverByInstance) {
          // Update the specific instance status
          const instance = serverByInstance.instances?.find((inst) => inst.id === id);
          if (instance) {
            instance.status = 'starting';
          }
          // Also update the aggregated server status
          updateServerStatus(serverByInstance.id, 'starting');
          console.log('[startServer] Updated instance status to starting:', id);
        }
      }

      // Track pending operation for UI transition state
      const pendingInstanceId = actualServerId;
      pendingOperations.value.set(pendingInstanceId, {
        status: 'starting',
        timestamp: Date.now()
      });

      // Connect server (using actual instance ID)
      await http.post(`/web/mcp/servers/${actualServerId}/connect`, {});
      await fetchServers();
    } catch (e: unknown) {
      // Revert status on failure
      try {
        await fetchServers();
      } catch (fetchErr) {
        console.error('Failed to fetch servers after start error:', fetchErr);
      }

      if (e instanceof Error) {
        error.value = e.message || 'Failed to start server';
      } else {
        error.value = String(e) || 'Failed to start server';
      }
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
   * @param {string} id - Server/instance ID to stop
   * @returns {Promise<void>}
   * @throws {Error} If stop fails
   */
  async function stopServer(id: string) {
    try {
      console.log('[stopServer] Stopping server/instance:', id);
      const server = servers.value.find((s) => s.id === id);

      // If it's a config-only server, no need to disconnect
      if (server && id.startsWith('config-')) {
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
   * Adds a new server instance for an existing server
   *
   * @async
   * @param {string} serverName - Name of the server to add an instance for
   * @returns {Promise<void>}
   * @throws {Error} If instance creation fails
   */
  async function addServerInstance(serverName: string) {
    loading.value = true;
    try {
      await http.post<ServerInstanceConfig>(`/web/server-instances/${serverName}`, {});
      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to add server instance';
      } else {
        error.value = String(e) || 'Failed to add server instance';
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Updates an existing server instance
   *
   * @async
   * @param {string} serverName - Name of the server
   * @param {number} index - Index of the instance to update
   * @param {Partial<ServerInstanceUpdate>} updates - Updates to apply to the instance
   * @returns {Promise<void>}
   * @throws {Error} If instance not found or update fails
   */
  async function updateServerInstance(
    serverName: string,
    index: number,
    updates: Partial<ServerInstanceUpdate>
  ) {
    loading.value = true;
    try {
      await http.put(`/web/server-instances/${serverName}/${index}`, updates);
      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to update server instance';
      } else {
        error.value = String(e) || 'Failed to update server instance';
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Removes a specific server instance by index
   *
   * @async
   * @param {string} serverName - Name of the server
   * @param {number} index - Index of the instance to remove
   * @returns {Promise<void>}
   * @throws {Error} If instance not found or removal fails
   */
  async function removeServerInstance(serverName: string, index: number) {
    loading.value = true;
    try {
      await http.delete(`/web/server-instances/${serverName}/${index}`);
      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to remove server instance';
      } else {
        error.value = String(e) || 'Failed to remove server instance';
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Reassigns indexes for all instances of a server
   * Makes indexes contiguous starting from 0
   *
   * @async
   * @param {string} serverName - Name of the server to reassign indexes for
   * @returns {Promise<void>}
   * @throws {Error} If reassignment fails
   */
  async function reassignInstanceIndexes(serverName: string) {
    loading.value = true;
    try {
      await http.post(`/web/server-instances/${serverName}/reassign-indexes`, {});
      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to reassign instance indexes';
      } else {
        error.value = String(e) || 'Failed to reassign instance indexes';
      }
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Starts all instances of a server
   *
   * @async
   * @param {string} serverName - Name of the server to start all instances for
   * @returns {Promise<void>}
   * @throws {Error} If starting fails
   */
  async function startAllServerInstances(serverName: string) {
    try {
      // Find the aggregated server object
      const aggregatedServer = servers.value.find((s) => s.name === serverName);
      if (!aggregatedServer?.instances) {
        return;
      }

      // Get all offline/error instances for this server
      const instancesToStart = aggregatedServer.instances.filter(
        (inst) => inst.status === 'offline' || inst.status === 'error'
      );

      // Update all instances to starting status for immediate UI feedback
      instancesToStart.forEach((instance) => {
        updateServerStatus(instance.id, 'starting');
        pendingOperations.value.set(instance.id, {
          status: 'starting',
          timestamp: Date.now()
        });
      });

      // Start each instance
      for (const instance of instancesToStart) {
        if (!instance.id.startsWith('config-')) {
          try {
            console.log('[startAllServerInstances] Starting instance:', instance.id);
            await http.post(`/web/mcp/servers/${instance.id}/connect`, {});
          } catch (e) {
            console.error(`Failed to start instance ${instance.id}:`, e);
          }
        }
      }

      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to start server instances';
      } else {
        error.value = String(e) || 'Failed to start server instances';
      }
      throw e;
    }
  }

  /**
   * Stops all instances of a server
   *
   * @async
   * @param {string} serverName - Name of the server to stop all instances for
   * @returns {Promise<void>}
   * @throws {Error} If stopping fails
   */
  async function stopAllServerInstances(serverName: string) {
    try {
      // Find the aggregated server object
      const aggregatedServer = servers.value.find((s) => s.name === serverName);
      if (!aggregatedServer?.instances) {
        return;
      }

      // Get all online/starting instances for this server
      const instancesToStop = aggregatedServer.instances.filter(
        (inst) => inst.status === 'online' || inst.status === 'starting'
      );

      // Stop each instance
      for (const instance of instancesToStop) {
        if (!instance.id.startsWith('config-')) {
          try {
            console.log('[stopAllServerInstances] Stopping instance:', instance.id);
            await http.post(`/web/mcp/servers/${instance.id}/disconnect`, {});
          } catch (e) {
            console.error(`Failed to stop instance ${instance.id}:`, e);
          }
        }
      }

      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to stop server instances';
      } else {
        error.value = String(e) || 'Failed to stop server instances';
      }
      throw e;
    }
  }

  /**
   * Restarts all instances of a server
   *
   * @async
   * @param {string} serverName - Name of the server to restart all instances for
   * @returns {Promise<void>}
   * @throws {Error} If restarting fails
   */
  async function restartAllServerInstances(serverName: string) {
    try {
      // Find the aggregated server object
      const aggregatedServer = servers.value.find((s) => s.name === serverName);
      if (!aggregatedServer?.instances) {
        return;
      }

      // Get all instances for this server
      const allInstances = aggregatedServer.instances;

      // Update all instances to starting status for immediate UI feedback
      allInstances.forEach((instance) => {
        updateServerStatus(instance.id, 'starting');
      });

      // Restart each instance
      for (const instance of allInstances) {
        if (!instance.id.startsWith('config-')) {
          try {
            console.log('[restartAllServerInstances] Restarting instance:', instance.id);
            // Stop first if it's online
            if (instance.status === 'online') {
              await http.post(`/web/mcp/servers/${instance.id}/disconnect`, {});
            }
            // Then start
            await http.post(`/web/mcp/servers/${instance.id}/connect`, {});
          } catch (e) {
            console.error(`Failed to restart instance ${instance.id}:`, e);
          }
        }
      }

      await fetchServers();
    } catch (e: unknown) {
      if (e instanceof Error) {
        error.value = e.message || 'Failed to restart server instances';
      } else {
        error.value = String(e) || 'Failed to restart server instances';
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
   * Recompute aggregated server status from its instances
   */
  function recomputeAggregatedStatus(s: Server) {
    let anyOnline = false;
    let anyError = false;
    let anyStarting = false;

    for (const inst of s.instances || []) {
      if (inst.status === 'online') {
        anyOnline = true;
        break;
      } else if (inst.status === 'error') {
        anyError = true;
      } else if (inst.status === 'starting') {
        anyStarting = true;
      }
    }

    if (anyOnline) {
      s.status = 'online';
    } else if (anyError) {
      s.status = 'error';
    } else if (anyStarting) {
      s.status = 'starting';
    } else {
      s.status = 'offline';
    }
  }

  /**
   * Locally adds a server instance (no HTTP call).
   * Used by WebSocket handler for cross-client sync.
   */
  function addInstanceLocal(serverName: string, instanceData: ServerInstance) {
    const server = servers.value.find((s) => s.name === serverName);
    if (!server?.rawV11Config) return;

    if (!server.rawV11Config.instances) {
      server.rawV11Config.instances = [];
    }
    server.rawV11Config.instances.push(instanceData);

    server.instances = server.rawV11Config.instances.map((inst) => {
      const existing = server.instances?.find((i) => i.id === inst.id);
      return {
        id: inst.id,
        timestamp: inst.timestamp ?? Date.now(),
        index: inst.index ?? 0,
        displayName: inst.displayName,
        status: (existing?.status as ServerStatus) ?? 'offline'
      };
    });

    recomputeAggregatedStatus(server);
  }

  /**
   * Locally updates a server instance (no HTTP call).
   * Used by WebSocket handler for cross-client sync.
   */
  function updateInstanceLocal(
    serverName: string,
    index: number,
    updates: Partial<ServerInstanceUpdate>
  ) {
    const server = servers.value.find((s) => s.name === serverName);
    if (!server?.rawV11Config?.instances) return;

    const inst = server.rawV11Config.instances.find((i) => i.index === index);
    if (inst) {
      Object.assign(inst, updates);
    }

    const aggInst = server.instances?.find((i) => i.index === index);
    if (aggInst && updates.displayName) {
      aggInst.displayName = updates.displayName;
    }
  }

  /**
   * Locally removes a server instance (no HTTP call).
   * Used by WebSocket handler for cross-client sync.
   */
  function removeInstanceLocal(serverName: string, index: number) {
    const server = servers.value.find((s) => s.name === serverName);
    if (!server?.rawV11Config?.instances) return;

    server.rawV11Config.instances = server.rawV11Config.instances.filter((i) => i.index !== index);

    if (server.instances) {
      server.instances = server.instances.filter((i) => i.index !== index);
    }

    if (server.rawV11Config.instances.length === 0) {
      const idx = servers.value.indexOf(server);
      if (idx !== -1) servers.value.splice(idx, 1);
      return;
    }

    recomputeAggregatedStatus(server);
  }

  /**
   * Updates the status of a specific server or instance
   *
   * Directly modifies the server status in the local state without API calls.
   * Used for immediate UI feedback during server operations.
   *
   * @param {string} id - Server ID or instance ID to update
   * @param {ServerStatus} status - New status value
   */
  function updateServerStatus(id: string, status: ServerStatus) {
    // Clear pending operation when reaching a terminal state
    if (status === 'online' || status === 'error' || status === 'offline') {
      pendingOperations.value.delete(id);
    }

    // First try to find by server ID
    const server = servers.value.find((s) => s.id === id);
    if (server) {
      server.status = status;
      return;
    }

    // If not found, try to find by instance ID
    const serverByInstance = findServerByInstanceId(id);
    if (serverByInstance) {
      // Update the specific instance status
      const instance = serverByInstance.instances?.find((inst) => inst.id === id);
      if (instance) {
        instance.status = status;
      }

      // Recompute the aggregated server status
      let anyOnline = false;
      let anyError = false;
      let anyStarting = false;

      for (const inst of serverByInstance.instances || []) {
        if (inst.status === 'online') {
          anyOnline = true;
          break;
        } else if (inst.status === 'error') {
          anyError = true;
        } else if (inst.status === 'starting') {
          anyStarting = true;
        }
      }

      if (anyOnline) {
        serverByInstance.status = 'online';
      } else if (anyError) {
        serverByInstance.status = 'error';
      } else if (anyStarting) {
        serverByInstance.status = 'starting';
      } else {
        serverByInstance.status = 'offline';
      }

      console.log(
        '[updateServerStatus] Updated instance status:',
        id,
        '->',
        status,
        'Aggregated:',
        serverByInstance.status
      );
    }
  }

  /**
   * Fetches tools available from a specific server
   *
   * Retrieves tool definitions from the server and updates the local state.
   * Includes error handling to prevent crashes on failed requests.
   *
   * @async
   * @param {string} serverName - Server name to fetch tools from
   * @returns {Promise<Tool[]>} Array of available tools
   */
  async function fetchTools(serverName: string) {
    try {
      const tools = await http.get<Tool[]>(`/web/mcp/servers/${serverName}/tools`);
      const server = servers.value.find((s) => s.name === serverName);
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
   * @param {string} serverName - Server name to fetch resources from
   * @returns {Promise<Resource[]>} Array of available resources
   */
  async function fetchResources(serverName: string) {
    try {
      const resources = await http.get<Resource[]>(`/web/mcp/servers/${serverName}/resources`);
      const server = servers.value.find((s) => s.name === serverName);
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
  function fetchLogs(serverId: string, instanceIndex: number = 0) {
    // Get WebSocket store instance
    const wsStore = useWebSocketStore();
    wsStore.fetchLogs(serverId, instanceIndex, 100); // Fetch the latest 100 log entries
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
    servers.value.forEach((s) => fetchLogs(s.id, 0));
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
      if (!response.contents || response.contents.length === 0) {
        throw new Error('Resource content is empty');
      }
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
    fetchAllResources,
    addServerInstance,
    updateServerInstance,
    removeServerInstance,
    addInstanceLocal,
    updateInstanceLocal,
    removeInstanceLocal,
    reassignInstanceIndexes,
    startAllServerInstances,
    stopAllServerInstances,
    restartAllServerInstances,
    findServerByInstanceId
  };
});
