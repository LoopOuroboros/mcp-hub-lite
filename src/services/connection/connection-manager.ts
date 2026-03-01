import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { TransportFactory } from '@utils/transports/transport-factory.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { withSpan, createMcpSpanOptions } from '@utils/index.js';
import type { Tool, JsonSchema } from '@shared-models/tool.model.js';
import type { Resource } from '@shared-models/resource.model.js';
import { logStorage } from '@services/log-storage.service.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';
import { hubManager } from '@services/hub-manager.service.js';
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';
import type { ServerConfig } from '@config/config.schema.js';
import type { ServerInstanceConfig } from '@config/config.schema.js';
import { stringifyForLogging } from '@utils/json-utils.js';
import type { ServerStatus } from './types.js';
import { ToolCache } from './tool-cache.js';

/**
 * Manages MCP (Model Context Protocol) server connections and provides a unified interface
 * for tool and resource operations across multiple connected servers.
 *
 * This service handles the complete lifecycle of MCP server connections including:
 * - Establishing connections via various transport protocols (stdio, SSE, HTTP)
 * - Managing client instances and transport layers
 * - Caching tools and resources for performance optimization
 * - Providing both server ID-based and server name-based access patterns
 * - Handling connection events and error recovery
 * - Supporting bidirectional communication for tool execution
 *
 * The manager uses ToolCache for both server ID-level and server name-level
 * operations to optimize different access patterns while ensuring data consistency.
 *
 * @example
 * ```typescript
 * const manager = new McpConnectionManager();
 * await manager.connect(serverConfig);
 * const tools = await manager.getTools(serverId);
 * const result = await manager.callTool(serverId, 'tool-name', { param: 'value' });
 * ```
 */
export class McpConnectionManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, Transport> = new Map();
  private serverStatus: Map<string, ServerStatus> = new Map();
  private _toolCache: ToolCache = new ToolCache();
  private resourceCache: Map<string, Resource[]> = new Map();

  constructor() {
    // Listen for server deletion events and automatically disconnect
    eventBus.subscribe(EventTypes.SERVER_DELETED, (data: unknown) => {
      const serverName = data as string;
      // Find all instances by server name and disconnect them
      const serverInstances = hubManager.getServerInstanceByName(serverName);
      serverInstances.forEach((instance) => {
        this.disconnect(instance.id!).catch((err) => {
          logger.warn(`Failed to disconnect deleted server instance ${instance.id}:`, err, LOG_MODULES.CONNECTION_MANAGER);
        });
      });
    });
  }

  /**
   * Establishes a connection to an MCP server using the specified configuration.
   *
   * This method handles the complete connection process including transport creation,
   * client initialization, validation, and automatic tool/resource discovery.
   * It supports multiple transport protocols (stdio, SSE, streamable-http, http)
   * and provides comprehensive error handling with proper status tracking.
   *
   * For bidirectional transports (stdio, streamable-http, http), it automatically
   * fetches and caches available tools and resources upon successful connection.
   * SSE transports are unidirectional and skip this step for performance reasons.
   *
   * The method publishes SERVER_CONNECTED and SERVER_STATUS_CHANGE events upon
   * successful connection, and SERVER_STATUS_CHANGE events with error details
   * on failure.
   *
   * @param {ServerConfig & ServerInstanceConfig} server - Server configuration containing
   * connection details, transport type, and instance-specific parameters
   * @returns {Promise<boolean>} True if connection succeeds, false if it fails
   * @throws {Error} If server ID is missing or required configuration is invalid
   *
   * @example
   * ```typescript
   * const serverConfig = {
   *   id: 'my-server-1',
   *   type: 'stdio' as const,
   *   command: 'npx my-mcp-server',
   *   name: 'My MCP Server'
   * };
   * const success = await manager.connect(serverConfig);
   * if (success) {
   *   console.log('Connected successfully');
   * }
   * ```
   */
  public async connect(server: ServerConfig & ServerInstanceConfig): Promise<boolean> {
    // Use trace helper to wrap the entire connection process
    return withSpan<boolean>(
      'mcp.connection.connect',
      createMcpSpanOptions('connect', server.id || 'unknown', undefined, {
        'mcp.server.type': server.type,
        'mcp.server.name': 'unknown' // Will be updated with actual name after serverInfo is retrieved
      }),
      async () => {
        let serverInfo:
          | { name: string; config: ServerConfig; instance: ServerInstanceConfig }
          | undefined;
        try {
          logger.info(`Connecting to server [${server.id || 'unknown'}]...`, LOG_MODULES.CONNECTION_MANAGER);

          // Validate server configuration
          if (!server.id) {
            throw new Error('Server ID is required');
          }

          // First set starting state (connected: false, no error)
          this.serverStatus.set(server.id, {
            connected: false,
            lastCheck: Date.now(),
            toolsCount: 0,
            resourcesCount: 0
          });

          // Get server name from server instance ID (via hubManager.getServerById)
          serverInfo = hubManager.getServerById(server.id);
          if (!serverInfo) {
            throw new Error(`Server not found for instance: ${server.id}`);
          }

          if (server.type === 'stdio' && (!server.command || server.command.trim() === '')) {
            throw new Error('STDIO server requires a valid command');
          }

          if (
            (server.type === 'sse' ||
              server.type === 'streamable-http' ||
              server.type === 'http') &&
            (!server.url || server.url.trim() === '')
          ) {
            const displayType = server.type === 'http' ? 'streamable-http' : server.type;
            throw new Error(`${displayType.toUpperCase()} server requires a valid URL`);
          }

          // Create transport based on server type
          const transport = TransportFactory.createTransport({
            ...server,
            name: serverInfo.name
          });

          // Handle transport close events
          if ('onclose' in transport) {
            transport.onclose = () => {
              logger.info(`Transport closed for server [${server.id}]`, LOG_MODULES.CONNECTION_MANAGER);
              const currentStatus = this.serverStatus.get(server.id!);
              // Only update status if it was previously connected or starting
              if (currentStatus && (currentStatus.connected || !currentStatus.error)) {
                this.serverStatus.set(server.id!, {
                  connected: false,
                  lastCheck: Date.now(),
                  toolsCount: 0,
                  resourcesCount: 0,
                  error: 'Connection closed unexpectedly'
                });
              }
            };
          }

          // Add log listeners
          if ('onstdout' in transport) {
            transport.onstdout = () => {
              // Don't log raw JSON-RPC communication to logs or console to avoid log noise
              // Only view raw communication during development debugging
            };
          }
          if ('onstderr' in transport) {
            transport.onstderr = (data: string) => {
              // Use server ID and name for log storage
              const serverId = server?.id ?? 'unknown';
              const serverName = serverInfo!.name;
              logStorage.append(serverId, 'error', `[${serverName}] [STDERR] ${data}`);
            };
          }

          const client = new Client(
            {
              name: MCP_HUB_LITE_SERVER,
              version: '1.0.0'
            },
            {
              capabilities: {}
            }
          );

          await client.connect(transport);

          this.clients.set(server.id, client);
          this.transports.set(server.id, transport);
          this._toolCache.setNameMapping(serverInfo.name, server.id);

          // Get PID if available (only for stdio transport)
          let pid: number | undefined;
          if ('pid' in transport && typeof transport.pid === 'number') {
            pid = transport.pid;
          }

          // Get server version
          const clientServerInfo = client.getServerVersion();
          const serverVersion = clientServerInfo?.version || clientServerInfo?.name;

          // Update server instance info (merge pid and startTime)
          const serverName = serverInfo.name;
          const instances = hubManager.getServerInstanceByName(serverName);
          const instanceIndex = instances.findIndex((inst) => inst.id === server.id);
          if (instanceIndex !== -1) {
            hubManager.updateServerInstance(serverName, instanceIndex, {
              pid: pid,
              startTime: Date.now() // Startup time is the same as timestamp
            });
          }

          this.serverStatus.set(server.id, {
            connected: true,
            lastCheck: Date.now(),
            toolsCount: 0,
            resourcesCount: 0,
            pid: pid,
            startTime: Date.now(),
            version: serverVersion,
            hash: server.hash
          });

          logger.info(`Connected to server [${server.id}]`, LOG_MODULES.CONNECTION_MANAGER);

          // Publish server connected event
          eventBus.publish(EventTypes.SERVER_CONNECTED, {
            serverId: server.id,
            status: 'online',
            timestamp: Date.now()
          });

          // Publish server status change event
          eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
            serverId: server.id,
            status: 'online',
            timestamp: Date.now()
          });

          // Fetch tools and resources immediately (only for bidirectional transports)
          if (server.type !== 'sse') {
            const tools = await this.refreshTools(server.id);
            const resources = await this.refreshResources(server.id);

            // Publish tools and resources updated event
            eventBus.publish(EventTypes.TOOLS_UPDATED, {
              serverId: server.id,
              tools
            });

            eventBus.publish(EventTypes.RESOURCES_UPDATED, {
              serverId: server.id,
              resources
            });
          } else {
            logger.info('SSE transport is unidirectional, skipping tool/resource refresh', LOG_MODULES.CONNECTION_MANAGER);
          }

          return true;
        } catch (error) {
          logger.error(
            `Failed to connect to server ${serverInfo?.name || server.id || 'unknown'}:`,
            error,
            LOG_MODULES.CONNECTION_MANAGER
          );
          const serverId = server.id || 'unknown';
          this.serverStatus.set(serverId, {
            connected: false,
            error: error instanceof Error ? error.message : String(error),
            lastCheck: Date.now(),
            toolsCount: 0,
            resourcesCount: 0
          });

          // Publish server status change event (error state)
          eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
            serverId,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now()
          });

          return false;
        }
      }
    );
  }

  /**
   * Disconnects from an MCP server and cleans up all associated resources.
   *
   * This method performs a graceful shutdown by closing the client connection,
   * closing the transport layer, and removing all cached data including tools,
   * resources, and status information. It also updates the server name-level
   * tool cache to maintain consistency across multiple instances of the same server.
   *
   * The method publishes SERVER_DISCONNECTED and SERVER_STATUS_CHANGE events
   * upon completion and handles any errors during the disconnection process
   * without throwing exceptions.
   *
   * @param {string} serverId - Unique identifier of the server instance to disconnect
   * @returns {Promise<void>} Resolves when disconnection is complete
   *
   * @example
   * ```typescript
   * await manager.disconnect('my-server-1');
   * console.log('Server disconnected');
   * ```
   */
  public async disconnect(serverId: string): Promise<void> {
    logger.info(`Disconnecting from server [${serverId}]...`, LOG_MODULES.CONNECTION_MANAGER);

    const client = this.clients.get(serverId);
    const transport = this.transports.get(serverId);

    try {
      if (client) {
        try {
          await client.close();
        } catch (e) {
          logger.warn(`Error closing client for [${serverId}]:`, e, LOG_MODULES.CONNECTION_MANAGER);
        }
      }

      if (transport && typeof transport.close === 'function') {
        await transport.close();
      }
    } catch (error) {
      logger.error(`Error disconnecting server [${serverId}]:`, error, LOG_MODULES.CONNECTION_MANAGER);
    } finally {
      this.clients.delete(serverId);
      this.transports.delete(serverId);
      this._toolCache.clearTools(serverId);
      this.resourceCache.delete(serverId);
      this._toolCache.removeNameMappingById(serverId);

      this.serverStatus.set(serverId, {
        connected: false,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
      });

      // Publish server disconnected event
      eventBus.publish(EventTypes.SERVER_DISCONNECTED, {
        serverId,
        status: 'offline',
        timestamp: Date.now()
      });

      // Publish server status change event
      eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
        serverId,
        status: 'offline',
        timestamp: Date.now()
      });

      logger.info(`Disconnected from server [${serverId}]`, LOG_MODULES.CONNECTION_MANAGER);
    }
  }

  /**
   * Disconnects from all currently connected MCP servers concurrently.
   *
   * This method iterates through all active client connections and calls
   * disconnect() on each one, handling errors individually to ensure
   * that failure to disconnect from one server doesn't prevent disconnection
   * from others. All disconnections are performed in parallel for efficiency.
   *
   * @returns {Promise<void>} Resolves when all disconnection attempts complete
   *
   * @example
   * ```typescript
   * await manager.disconnectAll();
   * console.log('All servers disconnected');
   * ```
   */
  public async disconnectAll(): Promise<void> {
    logger.info('Disconnecting all servers...', LOG_MODULES.CONNECTION_MANAGER);
    const serverIds = Array.from(this.clients.keys());
    logger.info(`Found ${serverIds.length} connected server(s)`, LOG_MODULES.CONNECTION_MANAGER);

    const disconnectPromises = serverIds.map(async (id) => {
      logger.info(`Disconnecting server [${id}]...`, LOG_MODULES.CONNECTION_MANAGER);
      try {
        await this.disconnect(id);
        logger.info(`Successfully disconnected server [${id}]`, LOG_MODULES.CONNECTION_MANAGER);
      } catch (error) {
        logger.error(`Failed to disconnect server [${id}]:`, error, LOG_MODULES.CONNECTION_MANAGER);
      }
    });

    await Promise.all(disconnectPromises);
    logger.info('All servers disconnected', LOG_MODULES.CONNECTION_MANAGER);
  }

  /**
   * Refreshes the tool cache for a specific server by fetching the latest tool list.
   *
   * This method queries the connected MCP server for its current set of available tools,
   * updates both the server ID-level and server name-level caches, and maintains
   * accurate tool counts in the server status. It handles server name resolution
   * to ensure proper caching across multiple instances of the same server.
   *
   * @param {string} serverId - Unique identifier of the server instance to refresh
   * @returns {Promise<Tool[]>} Array of updated tools with server context
   * @throws {Error} If the server is not connected or tool listing fails
   *
   * @example
   * ```typescript
   * const tools = await manager.refreshTools('my-server-1');
   * console.log(`Found ${tools.length} tools`);
   * ```
   */
  public async refreshTools(serverId: string): Promise<Tool[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      const result = await client.listTools();
      const serverName = this._toolCache.getServerNameById(serverId);
      const tools: Tool[] = result.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as JsonSchema,
        serverName: serverName
      }));

      this._toolCache.setTools(serverId, tools, serverName !== 'unknown' ? serverName : undefined);

      // Update status
      const status = this.serverStatus.get(serverId);
      if (status) {
        status.toolsCount = tools.length;
        status.lastCheck = Date.now();
      }

      logger.info(`Refreshed tools for server [${serverId}]: ${tools.length} tools found`, LOG_MODULES.CONNECTION_MANAGER);
      return tools;
    } catch (error) {
      logger.error(`Failed to list tools for server [${serverId}]:`, error, LOG_MODULES.CONNECTION_MANAGER);
      throw error;
    }
  }

  /**
   * Refreshes the resource cache for a specific server by fetching available resources.
   *
   * This method queries the connected MCP server for its current set of available resources,
   * handling servers that don't support the resources functionality gracefully by returning
   * an empty array. It updates the resource cache and maintains accurate resource counts
   * in the server status.
   *
   * The method specifically handles "Method not found" errors (MCP error code -32601)
   * which indicate that the server doesn't implement the resources protocol, treating
   * this as a normal case rather than an error.
   *
   * @param {string} serverId - Unique identifier of the server instance to refresh
   * @returns {Promise<Resource[]>} Array of available resources, empty if unsupported
   * @throws {Error} If the server is not connected or resource listing fails unexpectedly
   *
   * @example
   * ```typescript
   * const resources = await manager.refreshResources('my-server-1');
   * console.log(`Found ${resources.length} resources`);
   * ```
   */
  public async refreshResources(serverId: string): Promise<Resource[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      // Check if client actually supports listResources method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (client as any).listResources !== 'function') {
        logger.warn(`Server [${serverId}] does not support resources listing`, LOG_MODULES.CONNECTION_MANAGER);
        return [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (client as any).listResources();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resources: Resource[] = result.resources.map((r: any) => ({
        name: r.name,
        uri: r.uri,
        mimeType: r.mimeType,
        description: r.description
      }));

      this.resourceCache.set(serverId, resources);

      // Update status
      const status = this.serverStatus.get(serverId);
      if (status) {
        status.resourcesCount = resources.length;
        status.lastCheck = Date.now();
      }

      logger.info(
        `Refreshed resources for server [${serverId}]: ${resources.length} resources found`,
        LOG_MODULES.CONNECTION_MANAGER
      );
      return resources;
    } catch (error: unknown) {
      // Check if error is "Method not found" (MCP error -32601), which means server doesn't implement resources
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (error && typeof error === 'object' && 'code' in error && (error as any).code === -32601) {
        logger.info(`Server [${serverId}] does not support resources functionality`, LOG_MODULES.CONNECTION_MANAGER);
      } else if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (error as any).message === 'string' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).message.includes('Method not found')
      ) {
        logger.info(`Server [${serverId}] does not support resources functionality`, LOG_MODULES.CONNECTION_MANAGER);
      } else {
        logger.warn(`Failed to list resources for server [${serverId}]:`, error, LOG_MODULES.CONNECTION_MANAGER);
      }

      // Even if server doesn't support resources, store empty array in cache to ensure subsequent calls hit cache
      this.resourceCache.set(serverId, []);

      // Update server status
      const status = this.serverStatus.get(serverId);
      if (status) {
        status.resourcesCount = 0;
        status.lastCheck = Date.now();
      }

      return [];
    }
  }

  /**
   * Retrieves the current connection status for a specific server instance.
   *
   * This method provides access to the server's operational state including connection
   * status, error information, tool/resource counts, and process details.
   *
   * @param {string} serverId - Unique identifier of the server instance
   * @returns {ServerStatus | undefined} Current status object or undefined if not found
   *
   * @example
   * ```typescript
   * const status = manager.getStatus('my-server-1');
   * if (status?.connected) {
   *   console.log('Server is connected');
   * }
   * ```
   */
  public getStatus(serverId: string): ServerStatus | undefined {
    return this.serverStatus.get(serverId);
  }

  /**
   * Retrieves cached tools for a specific server instance.
   *
   * This method returns the currently cached tool list for the specified server,
   * which may be empty if tools haven't been refreshed yet or if the server
   * doesn't provide any tools. The method includes logging for debugging purposes.
   *
   * @param {string} serverId - Unique identifier of the server instance
   * @returns {Tool[]} Array of cached tools, empty if none available
   *
   * @example
   * ```typescript
   * const tools = manager.getTools('my-server-1');
   * console.log(`Server has ${tools.length} tools`);
   * ```
   */
  public getTools(serverId: string): Tool[] {
    return this._toolCache.getTools(serverId);
  }

  /**
   * Retrieves cached resources for a specific server instance.
   *
   * This method returns the currently cached resource list for the specified server,
   * which may be empty if resources haven't been refreshed yet, if the server doesn't
   * support resources, or if the server doesn't provide any resources. The method
   * includes logging for debugging purposes.
   *
   * @param {string} serverId - Unique identifier of the server instance
   * @returns {Resource[]} Array of cached resources, empty if none available
   *
   * @example
   * ```typescript
   * const resources = manager.getResources('my-server-1');
   * console.log(`Server has ${resources.length} resources`);
   * ```
   */
  public getResources(serverId: string): Resource[] {
    const resources = this.resourceCache.get(serverId) || [];
    const fromCache = this.resourceCache.has(serverId);
    logger.debug(`getResources for [${serverId}]: returned ${resources.length} resources (${fromCache ? 'from cache' : 'no cache'})`, LOG_MODULES.CONNECTION_MANAGER);
    return resources;
  }

  /**
   * Reads content from a specific resource URI on a connected MCP server.
   *
   * This method delegates the resource reading operation to the underlying MCP client,
   * providing direct access to server-provided resources through their URIs.
   *
   * @param {string} serverId - Unique identifier of the connected server instance
   * @param {string} uri - Resource URI to read (e.g., "file:///path/to/file")
   * @returns {Promise<unknown>} Resource content as returned by the server
   * @throws {Error} If the server is not connected or resource reading fails
   *
   * @example
   * ```typescript
   * const content = await manager.readResource('my-server-1', 'hub://config/settings.json');
   * console.log('Resource content:', content);
   * ```
   */
  public async readResource(serverId: string, uri: string): Promise<unknown> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not connected`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client as any).readResource({ uri });
  }

  /**
   * Retrieves all cached tools from all connected server instances.
   *
   * This method aggregates tools from all server ID-level caches into a single array,
   * providing a unified view of all available tools across all connected servers.
   * The returned tools include server context information for proper identification.
   *
   * @returns {Tool[]} Array of all cached tools from all connected servers
   *
   * @example
   * ```typescript
   * const allTools = manager.getAllTools();
   * console.log(`Total tools available: ${allTools.length}`);
   * ```
   */
  public getAllTools(): Tool[] {
    return this._toolCache.getAllTools();
  }

  /**
   * Retrieves all tool cache entries as server ID to tools mapping.
   *
   * This method returns the raw tool cache structure as an array of [serverId, tools] tuples,
   * providing direct access to the internal caching mechanism for debugging or advanced use cases.
   *
   * @returns {[string, Tool[]][]} Array of [serverId, tools] tuples representing the cache
   *
   * @example
   * ```typescript
   * const cacheEntries = manager.getToolCacheEntries();
   * cacheEntries.forEach(([serverId, tools]) => {
   *   console.log(`Server ${serverId} has ${tools.length} tools`);
   * });
   * ```
   */
  public getToolCacheEntries(): [string, Tool[]][] {
    return this._toolCache.getToolCacheEntries();
  }

  /**
   * Resolves a server name to its corresponding server instance ID.
   *
   * This method provides reverse lookup from server names (as defined in configuration)
   * to the unique server instance IDs used internally for connection management.
   * It's useful when you have a server name but need the instance ID for operations.
   *
   * @param {string} name - Server name as defined in the configuration
   * @returns {string | undefined} Corresponding server instance ID or undefined if not found
   *
   * @example
   * ```typescript
   * const serverId = manager.getServerIdByName('my-mcp-server');
   * if (serverId) {
   *   const status = manager.getStatus(serverId);
   * }
   * ```
   */
  public getServerIdByName(name: string): string | undefined {
    return this._toolCache.getServerIdByName(name);
  }

  /**
   * Retrieves the MCP client instance for a server by its name.
   *
   * This method resolves a server name to its instance ID and returns the corresponding
   * MCP client instance, providing direct access to the underlying SDK client for
   * advanced operations that aren't covered by the manager's high-level methods.
   *
   * @param {string} name - Server name as defined in the configuration
   * @returns {Client | undefined} MCP client instance or undefined if not connected
   *
   * @example
   * ```typescript
   * const client = manager.getClientByName('my-mcp-server');
   * if (client) {
   *   // Use direct client methods for advanced operations
   *   const result = await client.listPrompts();
   * }
   * ```
   */
  public getClientByName(name: string): Client | undefined {
    const serverId = this._toolCache.getServerIdByName(name);
    if (!serverId) {
      return undefined;
    }
    return this.clients.get(serverId);
  }

  /**
   * Calls a tool on a connected server using the server name instead of instance ID.
   *
   * This method provides a convenient way to execute tools when you have a server name
   * rather than an instance ID. It resolves the server name to its instance ID and
   * delegates to the callTool method for actual execution.
   *
   * The method is wrapped in OpenTelemetry tracing for observability and includes
   * comprehensive error handling with proper logging.
   *
   * @param {string} name - Server name as defined in the configuration
   * @param {string} toolName - Name of the tool to execute
   * @param {Record<string, unknown>} args - Arguments to pass to the tool
   * @returns {Promise<unknown>} Tool execution result as returned by the server
   * @throws {Error} If server is not connected, not found, or tool execution fails
   *
   * @example
   * ```typescript
   * const result = await manager.callToolByName('my-mcp-server', 'list-files', {
   *   directory: '/home/user'
   * });
   * console.log('Tool result:', result);
   * ```
   */
  public async callToolByName(
    name: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const serverId = this._toolCache.getServerIdByName(name);
    if (!serverId) {
      throw new Error(`Server ${name} not connected or not found`);
    }

    return this.callTool(serverId, toolName, args);
  }

  /**
   * Retrieves the connection status for a server using its name instead of instance ID.
   *
   * This method resolves a server name to its instance ID and returns the corresponding
   * server status, providing a convenient way to check server health when working with
   * server names rather than instance IDs.
   *
   * @param {string} name - Server name as defined in the configuration
   * @returns {ServerStatus | undefined} Current status object or undefined if not found/connected
   *
   * @example
   * ```typescript
   * const status = manager.getStatusByName('my-mcp-server');
   * if (status?.connected) {
   *   console.log('Server is online');
   * }
   * ```
   */
  public getStatusByName(name: string): ServerStatus | undefined {
    const serverId = this._toolCache.getServerIdByName(name);
    if (!serverId) {
      return undefined;
    }
    return this.serverStatus.get(serverId);
  }

  /**
   * Retrieves cached tools for a server using its name instead of instance ID.
   *
   * This method resolves a server name to its instance ID and returns the corresponding
   * cached tool list, providing a convenient way to access tools when working with
   * server names rather than instance IDs.
   *
   * @param {string} name - Server name as defined in the configuration
   * @returns {Tool[]} Array of cached tools, empty if none available or not connected
   *
   * @example
   * ```typescript
   * const tools = manager.getToolsByName('my-mcp-server');
   * console.log(`Server has ${tools.length} tools`);
   * ```
   */
  public getToolsByName(name: string): Tool[] {
    const serverId = this._toolCache.getServerIdByName(name);
    if (!serverId) {
      return [];
    }
    return this._toolCache.getTools(serverId);
  }

  /**
   * Retrieves cached resources for a server using its name instead of instance ID.
   *
   * This method resolves a server name to its instance ID and returns the corresponding
   * cached resource list, providing a convenient way to access resources when working with
   * server names rather than instance IDs.
   *
   * @param {string} name - Server name as defined in the configuration
   * @returns {Resource[]} Array of cached resources, empty if none available or not connected
   *
   * @example
   * ```typescript
   * const resources = manager.getResourcesByName('my-mcp-server');
   * console.log(`Server has ${resources.length} resources`);
   * ```
   */
  public getResourcesByName(name: string): Resource[] {
    const serverId = this._toolCache.getServerIdByName(name);
    if (!serverId) {
      return [];
    }
    return this.resourceCache.get(serverId) || [];
  }

  /**
   * Retrieves a specific tool by name from a server's cached tools.
   *
   * This method searches the server name-level tool cache for a tool with the specified name,
   * providing efficient lookup without needing to iterate through all tools manually.
   *
   * @param {string} serverName - Server name as defined in the configuration
   * @param {string} toolName - Exact name of the tool to find
   * @returns {Tool | undefined} Tool object if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const tool = manager.getTool('my-mcp-server', 'list-files');
   * if (tool) {
   *   console.log('Tool description:', tool.description);
   * }
   * ```
   */
  public getTool(serverName: string, toolName: string): Tool | undefined {
    return this._toolCache.getTool(serverName, toolName);
  }

  /**
   * Retrieves all cached resources grouped by server name.
   *
   * This method aggregates resources from all server instances and groups them by their
   * corresponding server names, providing a structured view of all available resources
   * across the system organized by server origin.
   *
   * @returns {Record<string, Resource[]>} Object mapping server names to resource arrays
   *
   * @example
   * ```typescript
   * const allResources = manager.getAllResources();
   * Object.entries(allResources).forEach(([serverName, resources]) => {
   *   console.log(`Server ${serverName} has ${resources.length} resources`);
   * });
   * ```
   */
  public getAllResources(): Record<string, Resource[]> {
    const result: Record<string, Resource[]> = {};

    // Group resources by server name
    for (const [serverId, resources] of this.resourceCache.entries()) {
      // Find server name for this ID
      const serverName = this._toolCache.getServerNameById(serverId);

      if (!result[serverName]) {
        result[serverName] = [];
      }
      result[serverName].push(...resources);
    }

    return result;
  }

  /**
   * Executes a tool on a connected MCP server using its instance ID.
   *
   * This is the primary method for executing tools on connected servers. It delegates
   * the actual execution to the underlying MCP client and includes comprehensive
   * error handling with proper logging. The method is wrapped in OpenTelemetry tracing
   * for observability and monitoring.
   *
   * @param {string} serverId - Unique identifier of the connected server instance
   * @param {string} toolName - Name of the tool to execute
   * @param {Record<string, unknown>} args - Arguments to pass to the tool
   * @returns {Promise<unknown>} Tool execution result as returned by the server
   * @throws {Error} If server is not connected or tool execution fails
   *
   * @example
   * ```typescript
   * const result = await manager.callTool('my-server-1', 'list-files', {
   *   directory: '/home/user'
   * });
   * console.log('Tool result:', result);
   * ```
   */
  public async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // Use trace helper to wrap the tool call
    return withSpan<unknown>(
      'mcp.tool.call',
      createMcpSpanOptions('call', serverId, toolName, {
        'mcp.tool.args': stringifyForLogging(args)
      }),
      async () => {
        const client = this.clients.get(serverId);
        if (!client) {
          throw new Error(`Server ${serverId} not connected`);
        }

        try {
          const result = await client.callTool({
            name: toolName,
            arguments: args
          });
          return result;
        } catch (error) {
          logger.error(`Failed to call tool ${toolName} on server [${serverId}]:`, error, LOG_MODULES.CONNECTION_MANAGER);
          throw error;
        }
      }
    );
  }

  /**
   * Retrieves cached tools for a specific server name from the server name-level cache.
   *
   * This method provides access to the server name-level tool cache, which aggregates
   * tools from all instances of the same server name. It's optimized for scenarios
   * where you need to work with server names rather than individual instance IDs.
   *
   * @param {string} serverName - Server name as defined in the configuration
   * @returns {Tool[]} Array of cached tools for the specified server name
   *
   * @example
   * ```typescript
   * const tools = manager.getToolsByServerName('my-mcp-server');
   * console.log(`Server has ${tools.length} tools across all instances`);
   * ```
   */
  public getToolsByServerName(serverName: string): Tool[] {
    return this._toolCache.getToolsByServerName(serverName);
  }

  /**
   * Retrieves all cached tools from all servers using the server name-level cache.
   *
   * This method aggregates tools from the server name-level cache, providing a unified
   * view of all available tools optimized for search operations and scenarios where
   * server name context is more relevant than individual instance IDs.
   *
   * @returns {Tool[]} Array of all cached tools from all servers
   *
   * @example
   * ```typescript
   * const allTools = manager.getAllToolsByServerName();
   * console.log(`Total tools available: ${allTools.length}`);
   * ```
   */
  public getAllToolsByServerName(): Tool[] {
    return this._toolCache.getAllToolsByServerName();
  }

  /**
   * Backward compatibility: direct access to the underlying toolCache Map.
   * This is maintained for backward compatibility with code that accesses
   * mcpConnectionManager.toolCache directly.
   *
   * @deprecated Use the dedicated methods like getTools(), setTools(), etc. instead
   */
  get toolCache(): Map<string, Tool[]> {
    return this._toolCache.internalToolCache;
  }
}

export const mcpConnectionManager = new McpConnectionManager();
