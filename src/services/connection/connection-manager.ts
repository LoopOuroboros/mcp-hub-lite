import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { TransportFactory } from '@utils/transports/transport-factory.js';
import {
  logger,
  LOG_MODULES,
  formatMcpMessageForLogging,
  logNotificationMessage
} from '@utils/logger.js';
import { getAppVersion } from '@utils/version.js';
import { getMcpCommDebugSetting } from '@utils/json-utils.js';
import type { Tool, JsonSchema } from '@shared-models/tool.model.js';
import type { Resource } from '@shared-models/resource.model.js';
import { logStorage } from '@services/log-storage.service.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';
import { hubManager } from '@services/hub-manager.service.js';
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';
import type { ServerInstanceConfig } from '@config/config.schema.js';
import type { ServerRuntimeConfig } from '@shared-models/server.model.js';
import type { ServerConfig, ServerInstance } from '@config/config-manager.js';
import type { ServerStatus } from './types.js';
import { ToolCache } from './tool-cache.js';
import { getCompositeKey } from '@utils/composite-key.js';

/**
 * Manages MCP (Model Context Protocol) server connections and provides a unified interface
 * for tool and resource operations across multiple connected servers.
 *
 * This service handles the complete lifecycle of MCP server connections including:
 * - Establishing connections via various transport protocols (stdio, SSE, HTTP)
 * - Managing client instances and transport layers
 * - Caching tools and resources for performance optimization
 * - Providing both composite key-based and server name-based access patterns
 * - Handling connection events and error recovery
 * - Supporting bidirectional communication for tool execution
 *
 * The manager uses ToolCache for both composite key-level and server name-level
 * operations to optimize different access patterns while ensuring data consistency.
 *
 * @example
 * ```typescript
 * const manager = new McpConnectionManager();
 * await manager.connect('my-server', 0, serverConfig);
 * const tools = await manager.getTools('my-server', 0);
 * const result = await manager.callTool('my-server', 0, 'tool-name', { param: 'value' });
 * ```
 */
export class McpConnectionManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, Transport> = new Map();
  private serverStatus: Map<string, ServerStatus> = new Map();
  private _toolCache: ToolCache = new ToolCache();
  private resourceCache: Map<string, Resource[]> = new Map();
  // Track composite keys by server name
  private serverNameToCompositeKeys: Map<string, Set<string>> = new Map();

  constructor() {
    // Listen for server deletion events and automatically disconnect
    eventBus.subscribe(EventTypes.SERVER_DELETED, (data: unknown) => {
      const serverName = data as string;
      // Find all instances by server name and disconnect them
      const compositeKeys = this.serverNameToCompositeKeys.get(serverName);
      if (compositeKeys) {
        for (const compositeKey of compositeKeys) {
          const { serverIndex } = parseCompositeKey(compositeKey)!;
          this.disconnect(serverName, serverIndex).catch((err) => {
            logger.warn(
              `Failed to disconnect deleted server instance ${compositeKey}:`,
              err,
              LOG_MODULES.CONNECTION_MANAGER
            );
          });
        }
      }
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
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @param {ServerRuntimeConfig & Partial<ServerInstanceConfig>} server - Server configuration containing
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
   * const success = await manager.connect('My MCP Server', 0, serverConfig);
   * if (success) {
   *   console.log('Connected successfully');
   * }
   * ```
   */
  public async connect(
    serverName: string,
    serverIndex: number,
    server: ServerRuntimeConfig & Partial<ServerInstanceConfig>
  ): Promise<boolean> {
    let serverInfo: { name: string; config: ServerConfig; instance: ServerInstance } | undefined;
    // Extract serverId at the very beginning for consistent usage in both try and catch blocks
    const serverId = server.id || 'unknown';
    const compositeKey = getCompositeKey(serverName, serverIndex);

    try {
      // Validate server configuration
      if (!server.id) {
        throw new Error('Server ID is required');
      }

      logger.info(
        `Connecting to server [${compositeKey}] (${serverId})...`,
        LOG_MODULES.CONNECTION_MANAGER
      );

      // First set starting state (connected: false, no error)
      this.serverStatus.set(compositeKey, {
        connected: false,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
      });

      // Get server name from server instance ID (via hubManager.getServerById)
      serverInfo = hubManager.getServerById(serverId);
      if (!serverInfo) {
        throw new Error(`Server not found for instance: ${serverId}`);
      }

      if (server.type === 'stdio' && (!server.command || server.command.trim() === '')) {
        throw new Error('STDIO server requires a valid command');
      }

      if (
        (server.type === 'sse' || server.type === 'streamable-http' || server.type === 'http') &&
        (!server.url || server.url.trim() === '')
      ) {
        const displayType = server.type === 'http' ? 'streamable-http' : server.type;
        throw new Error(`${displayType.toUpperCase()} server requires a valid URL`);
      }

      // Create transport based on server type
      const transport = TransportFactory.createTransport(
        {
          ...server,
          name: serverName
        },
        compositeKey
      );

      // Always set up message handler for notifications/message
      transport.onmessage = (message) => {
        // Communication debug logs: controlled by MCP_COMM_DEBUG environment variable
        if (getMcpCommDebugSetting()) {
          const logMessage = formatMcpMessageForLogging(message);
          logger.debug(`MCP message received: ${logMessage}`, LOG_MODULES.CONNECTION_MANAGER);
        }

        // Log notifications/message to application logs (always enabled)
        logNotificationMessage(message, serverName, compositeKey);
      };

      // Wrap send method for debug logging (if enabled)
      if (getMcpCommDebugSetting()) {
        const originalSend = transport.send;
        transport.send = async (message, options) => {
          try {
            const logMessage = formatMcpMessageForLogging(message);
            logger.debug(`MCP message sent: ${logMessage}`, LOG_MODULES.CONNECTION_MANAGER);
          } catch {
            logger.debug(
              `MCP message sent: [Error formatting response]`,
              LOG_MODULES.CONNECTION_MANAGER
            );
          }

          // Call original send method
          return await originalSend.call(transport, message, options);
        };
      }

      // Handle transport close events
      if ('onclose' in transport) {
        transport.onclose = () => {
          logger.info(
            `Transport closed for server [${compositeKey}]`,
            LOG_MODULES.CONNECTION_MANAGER
          );
          const currentStatus = this.serverStatus.get(compositeKey);
          // Only update status if it was previously connected or starting
          if (currentStatus && (currentStatus.connected || !currentStatus.error)) {
            this.serverStatus.set(compositeKey, {
              connected: false,
              lastCheck: Date.now(),
              toolsCount: 0,
              resourcesCount: 0,
              error: 'Connection closed unexpectedly'
            });

            // Publish server status change event
            eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
              serverName,
              serverIndex,
              status: 'error',
              error: 'Connection closed unexpectedly',
              timestamp: Date.now()
            });
          }
        };
      }

      // Add log listeners
      if ('onstdout' in transport) {
        transport.onstdout = (data: string) => {
          // Skip JSON-RPC communication to avoid log noise
          const trimmedData = data.trim();
          if (trimmedData) {
            // Check if it's a valid JSON-RPC message
            let isJsonRpc = false;
            if (trimmedData.startsWith('{')) {
              try {
                const parsed = JSON.parse(trimmedData) as Record<string, unknown>;
                // Only consider it JSON-RPC if it has valid jsonrpc field
                isJsonRpc =
                  typeof parsed.jsonrpc === 'string' &&
                  (parsed.jsonrpc === '2.0' || parsed.jsonrpc === '1.0');
              } catch {
                // Not valid JSON, treat as log output
                isJsonRpc = false;
              }
            }
            if (!isJsonRpc) {
              // Use composite key for log storage
              logStorage.append(compositeKey, 'info', `[${serverName}] [STDOUT] ${data}`);
            }
          }
        };
      }
      if ('onstderr' in transport) {
        transport.onstderr = (data: string) => {
          // Use composite key for log storage
          logStorage.append(compositeKey, 'error', `[${serverName}] [STDERR] ${data}`);
        };
      }

      const client = new Client(
        {
          name: MCP_HUB_LITE_SERVER,
          version: getAppVersion()
        },
        {
          capabilities: {}
        }
      );

      await client.connect(transport);

      this.clients.set(compositeKey, client);
      this.transports.set(compositeKey, transport);
      this._toolCache.setNameMapping(serverName, compositeKey);

      // Register composite key for this server name
      if (!this.serverNameToCompositeKeys.has(serverName)) {
        this.serverNameToCompositeKeys.set(serverName, new Set());
      }
      this.serverNameToCompositeKeys.get(serverName)!.add(compositeKey);

      // Get PID if available (only for stdio transport)
      let pid: number | undefined;
      if ('pid' in transport && typeof transport.pid === 'number') {
        pid = transport.pid;
      }

      // Get server version
      const clientServerInfo = client.getServerVersion();
      const serverVersion = clientServerInfo?.version || clientServerInfo?.name;

      this.serverStatus.set(compositeKey, {
        connected: true,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0,
        pid: pid,
        startTime: Date.now(),
        version: serverVersion
      });

      logger.info(`Connected to server [${compositeKey}]`, LOG_MODULES.CONNECTION_MANAGER);

      // Publish server connected event
      eventBus.publish(EventTypes.SERVER_CONNECTED, {
        serverName,
        serverIndex,
        status: 'online',
        timestamp: Date.now()
      });

      // Publish server status change event
      eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
        serverName,
        serverIndex,
        status: 'online',
        timestamp: Date.now()
      });

      // Fetch tools and resources immediately (only for bidirectional transports)
      if (server.type !== 'sse') {
        const tools = await this.refreshTools(serverName, serverIndex);
        const resources = await this.refreshResources(serverName, serverIndex);

        // Publish tools and resources updated event
        eventBus.publish(EventTypes.TOOLS_UPDATED, {
          serverName,
          serverIndex,
          tools
        });

        eventBus.publish(EventTypes.RESOURCES_UPDATED, {
          serverName,
          serverIndex,
          resources
        });
      } else {
        logger.info(
          'SSE transport is unidirectional, skipping tool/resource refresh',
          LOG_MODULES.CONNECTION_MANAGER
        );
      }

      return true;
    } catch (error) {
      logger.error(
        `Failed to connect to server ${compositeKey}:`,
        error,
        LOG_MODULES.CONNECTION_MANAGER
      );
      this.serverStatus.set(compositeKey, {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
      });

      // Publish server status change event (error state)
      eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
        serverName,
        serverIndex,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });

      return false;
    }
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
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @returns {Promise<void>} Resolves when disconnection is complete
   *
   * @example
   * ```typescript
   * await manager.disconnect('my-server', 0);
   * console.log('Server disconnected');
   * ```
   */
  public async disconnect(serverName: string, serverIndex: number): Promise<void> {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    logger.info(`Disconnecting from server [${compositeKey}]...`, LOG_MODULES.CONNECTION_MANAGER);

    const client = this.clients.get(compositeKey);
    const transport = this.transports.get(compositeKey);

    try {
      if (client) {
        try {
          await client.close();
        } catch (e) {
          logger.warn(
            `Error closing client for [${compositeKey}]:`,
            e,
            LOG_MODULES.CONNECTION_MANAGER
          );
        }
      }

      if (transport && typeof transport.close === 'function') {
        await transport.close();
      }
    } catch (error) {
      logger.error(
        `Error disconnecting server [${compositeKey}]:`,
        error,
        LOG_MODULES.CONNECTION_MANAGER
      );
    } finally {
      this.clients.delete(compositeKey);
      this.transports.delete(compositeKey);
      this._toolCache.clearTools(serverName, serverIndex);
      this.resourceCache.delete(compositeKey);
      this._toolCache.removeNameMappingById(compositeKey);

      // Remove from serverNameToCompositeKeys
      const keys = this.serverNameToCompositeKeys.get(serverName);
      if (keys) {
        keys.delete(compositeKey);
        if (keys.size === 0) {
          this.serverNameToCompositeKeys.delete(serverName);
        }
      }

      this.serverStatus.set(compositeKey, {
        connected: false,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
      });

      // Publish server disconnected event
      eventBus.publish(EventTypes.SERVER_DISCONNECTED, {
        serverName,
        serverIndex,
        status: 'offline',
        timestamp: Date.now()
      });

      // Publish server status change event
      eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
        serverName,
        serverIndex,
        status: 'offline',
        timestamp: Date.now()
      });

      logger.info(`Disconnected from server [${compositeKey}]`, LOG_MODULES.CONNECTION_MANAGER);
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
    const compositeKeys = Array.from(this.clients.keys());
    logger.info(
      `Found ${compositeKeys.length} connected server(s)`,
      LOG_MODULES.CONNECTION_MANAGER
    );

    const disconnectPromises = compositeKeys.map(async (compositeKey) => {
      const { serverName, serverIndex } = parseCompositeKey(compositeKey)!;
      logger.info(`Disconnecting server [${compositeKey}]...`, LOG_MODULES.CONNECTION_MANAGER);
      try {
        await this.disconnect(serverName, serverIndex);
        logger.info(
          `Successfully disconnected server [${compositeKey}]`,
          LOG_MODULES.CONNECTION_MANAGER
        );
      } catch (error) {
        logger.error(
          `Failed to disconnect server [${compositeKey}]:`,
          error,
          LOG_MODULES.CONNECTION_MANAGER
        );
      }
    });

    await Promise.all(disconnectPromises);
    logger.info('All servers disconnected', LOG_MODULES.CONNECTION_MANAGER);
  }

  /**
   * Refreshes the tool cache for a specific server by fetching the latest tool list.
   *
   * This method queries the connected MCP server for its current set of available tools,
   * updates both the composite key-level and server name-level caches, and maintains
   * accurate tool counts in the server status. It handles server name resolution
   * to ensure proper caching across multiple instances of the same server.
   *
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @returns {Promise<Tool[]>} Array of updated tools with server context
   * @throws {Error} If the server is not connected or tool listing fails
   *
   * @example
   * ```typescript
   * const tools = await manager.refreshTools('my-server', 0);
   * console.log(`Found ${tools.length} tools`);
   * ```
   */
  public async refreshTools(serverName: string, serverIndex: number): Promise<Tool[]> {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    const client = this.clients.get(compositeKey);
    if (!client) {
      throw new Error(`Server ${compositeKey} not connected`);
    }

    try {
      const result = await client.listTools();
      const tools: Tool[] = result.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as JsonSchema,
        serverName: serverName
      }));

      this._toolCache.setTools(serverName, serverIndex, tools);

      // Update status
      const status = this.serverStatus.get(compositeKey);
      if (status) {
        status.toolsCount = tools.length;
        status.lastCheck = Date.now();
      }

      logger.info(
        `Refreshed tools for server [${compositeKey}]: ${tools.length} tools found`,
        LOG_MODULES.CONNECTION_MANAGER
      );
      return tools;
    } catch (error) {
      logger.error(
        `Failed to list tools for server [${compositeKey}]:`,
        error,
        LOG_MODULES.CONNECTION_MANAGER
      );
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
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @returns {Promise<Resource[]>} Array of available resources, empty if unsupported
   * @throws {Error} If the server is not connected or resource listing fails unexpectedly
   *
   * @example
   * ```typescript
   * const resources = await manager.refreshResources('my-server', 0);
   * console.log(`Found ${resources.length} resources`);
   * ```
   */
  public async refreshResources(serverName: string, serverIndex: number): Promise<Resource[]> {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    const client = this.clients.get(compositeKey);
    if (!client) {
      throw new Error(`Server ${compositeKey} not connected`);
    }

    try {
      // Check if client actually supports listResources method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (client as any).listResources !== 'function') {
        logger.warn(
          `Server [${compositeKey}] does not support resources listing`,
          LOG_MODULES.CONNECTION_MANAGER
        );
        return [];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (client as any).listResources();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resources: Resource[] = result.resources.map((r: any) => ({
        name: r.name,
        uri: r.uri,
        mimeType: r.mimeType,
        description: r.description,
        serverName: serverName,
        serverIndex: serverIndex
      }));

      this.resourceCache.set(compositeKey, resources);

      // Update status
      const status = this.serverStatus.get(compositeKey);
      if (status) {
        status.resourcesCount = resources.length;
        status.lastCheck = Date.now();
      }

      logger.info(
        `Refreshed resources for server [${compositeKey}]: ${resources.length} resources found`,
        LOG_MODULES.CONNECTION_MANAGER
      );
      return resources;
    } catch (error: unknown) {
      // Check if error is "Method not found" (MCP error -32601), which means server doesn't implement resources
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (error && typeof error === 'object' && 'code' in error && (error as any).code === -32601) {
        logger.info(
          `Server [${compositeKey}] does not support resources functionality`,
          LOG_MODULES.CONNECTION_MANAGER
        );
      } else if (
        error &&
        typeof error === 'object' &&
        'message' in error &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (error as any).message === 'string' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).message.includes('Method not found')
      ) {
        logger.info(
          `Server [${compositeKey}] does not support resources functionality`,
          LOG_MODULES.CONNECTION_MANAGER
        );
      } else {
        logger.warn(
          `Failed to list resources for server [${compositeKey}]:`,
          error,
          LOG_MODULES.CONNECTION_MANAGER
        );
      }

      // Even if server doesn't support resources, store empty array in cache to ensure subsequent calls hit cache
      this.resourceCache.set(compositeKey, []);

      // Update server status
      const status = this.serverStatus.get(compositeKey);
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
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @returns {ServerStatus | undefined} Current status object or undefined if not found
   *
   * @example
   * ```typescript
   * const status = manager.getStatus('my-server', 0);
   * if (status?.connected) {
   *   console.log('Server is connected');
   * }
   * ```
   */
  public getStatus(serverName: string, serverIndex: number): ServerStatus | undefined {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    return this.serverStatus.get(compositeKey);
  }

  /**
   * Retrieves cached tools for a specific server instance.
   *
   * This method returns the currently cached tool list for the specified server,
   * which may be empty if tools haven't been refreshed yet or if the server
   * doesn't provide any tools. The method includes logging for debugging purposes.
   *
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @returns {Tool[]} Array of cached tools, empty if none available
   *
   * @example
   * ```typescript
   * const tools = manager.getTools('my-server', 0);
   * console.log(`Server has ${tools.length} tools`);
   * ```
   */
  public getTools(serverName: string, serverIndex: number): Tool[] {
    return this._toolCache.getTools(serverName, serverIndex);
  }

  /**
   * Retrieves cached resources for a specific server instance.
   *
   * This method returns the currently cached resource list for the specified server,
   * which may be empty if resources haven't been refreshed yet, if the server doesn't
   * support resources, or if the server doesn't provide any resources. The method
   * includes logging for debugging purposes.
   *
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @returns {Resource[]} Array of cached resources, empty if none available
   *
   * @example
   * ```typescript
   * const resources = manager.getResources('my-server', 0);
   * console.log(`Server has ${resources.length} resources`);
   * ```
   */
  public getResources(serverName: string, serverIndex: number): Resource[] {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    const resources = this.resourceCache.get(compositeKey) || [];
    const fromCache = this.resourceCache.has(compositeKey);
    logger.debug(
      `getResources for [${compositeKey}]: returned ${resources.length} resources (${fromCache ? 'from cache' : 'no cache'})`,
      LOG_MODULES.CONNECTION_MANAGER
    );
    return resources;
  }

  /**
   * Reads content from a specific resource URI on a connected MCP server.
   *
   * This method delegates the resource reading operation to the underlying MCP client,
   * providing direct access to server-provided resources through their URIs.
   *
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @param {string} uri - Resource URI to read (e.g., "file:///path/to/file")
   * @returns {Promise<unknown>} Resource content as returned by the server
   * @throws {Error} If the server is not connected or resource reading fails
   *
   * @example
   * ```typescript
   * const content = await manager.readResource('my-server', 0, 'hub://config/settings.json');
   * console.log('Resource content:', content);
   * ```
   */
  public async readResource(
    serverName: string,
    serverIndex: number,
    uri: string
  ): Promise<unknown> {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    const client = this.clients.get(compositeKey);
    if (!client) {
      throw new Error(`Server ${compositeKey} not connected`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (client as any).readResource({ uri });
  }

  /**
   * Retrieves all cached tools from all connected server instances.
   *
   * This method aggregates tools from all composite key-level caches into a single array,
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
   * Retrieves all tool cache entries as composite key to tools mapping.
   *
   * This method returns the raw tool cache structure as an array of [compositeKey, tools] tuples,
   * providing direct access to the internal caching mechanism for debugging or advanced use cases.
   *
   * @returns {[string, Tool[]][]} Array of [compositeKey, tools] tuples representing the cache
   *
   * @example
   * ```typescript
   * const cacheEntries = manager.getToolCacheEntries();
   * cacheEntries.forEach(([compositeKey, tools]) => {
   *   console.log(`Server ${compositeKey} has ${tools.length} tools`);
   * });
   * ```
   */
  public getToolCacheEntries(): [string, Tool[]][] {
    return this._toolCache.getToolCacheEntries();
  }

  /**
   * Resolves a server name to its corresponding composite key for a specific instance index.
   *
   * This method provides lookup from server names (as defined in configuration)
   * to composite keys used internally for connection management.
   *
   * @param {string} name - Server name as defined in the configuration
   * @param {number} index - Instance index
   * @returns {string | undefined} Corresponding composite key or undefined if not found
   *
   * @example
   * ```typescript
   * const compositeKey = manager.getCompositeKeyByName('my-mcp-server', 0);
   * if (compositeKey) {
   *   const status = manager.getStatus(compositeKey);
   * }
   * ```
   */
  public getCompositeKeyByName(name: string, index: number): string | undefined {
    const compositeKey = getCompositeKey(name, index);
    if (this.clients.has(compositeKey)) {
      return compositeKey;
    }
    return undefined;
  }

  /**
   * Retrieves the MCP client instance for a server by its name and index.
   *
   * This method resolves a composite key and returns the corresponding
   * MCP client instance, providing direct access to the underlying SDK client for
   * advanced operations that aren't covered by the manager's high-level methods.
   *
   * @param {string} name - Server name as defined in the configuration
   * @param {number} index - Instance index
   * @returns {Client | undefined} MCP client instance or undefined if not connected
   *
   * @example
   * ```typescript
   * const client = manager.getClient('my-mcp-server', 0);
   * if (client) {
   *   // Use direct client methods for advanced operations
   *   const result = await client.listPrompts();
   * }
   * ```
   */
  public getClient(name: string, index: number): Client | undefined {
    const compositeKey = getCompositeKey(name, index);
    return this.clients.get(compositeKey);
  }

  /**
   * Calls a tool on a connected server using the server name and index.
   *
   * The method is wrapped in OpenTelemetry tracing for observability and includes
   * comprehensive error handling with proper logging.
   *
   * @param {string} serverName - Server name
   * @param {number} serverIndex - Instance index
   * @param {string} toolName - Name of the tool to execute
   * @param {Record<string, unknown>} args - Arguments to pass to the tool
   * @returns {Promise<unknown>} Tool execution result as returned by the server
   * @throws {Error} If server is not connected or tool execution fails
   *
   * @example
   * ```typescript
   * const result = await manager.callTool('my-server', 0, 'list-files', {
   *   directory: '/home/user'
   * });
   * console.log('Tool result:', result);
   * ```
   */
  public async callTool(
    serverName: string,
    serverIndex: number,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    const client = this.clients.get(compositeKey);
    if (!client) {
      throw new Error(`Server ${compositeKey} not connected`);
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args
      });
      return result;
    } catch (error) {
      logger.error(
        `Failed to call tool ${toolName} on server [${compositeKey}]:`,
        error,
        LOG_MODULES.CONNECTION_MANAGER
      );
      throw error;
    }
  }

  /**
   * Retrieves cached tools for a server using its name instead of instance ID.
   *
   * This method resolves a server name to its composite key and returns the corresponding
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
    return this._toolCache.getToolsByServerName(name);
  }

  /**
   * Retrieves cached resources for a server using its name instead of instance ID.
   *
   * This method resolves a server name to its composite key and returns the corresponding
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
    // Aggregate resources from all instances of this server name
    const compositeKeys = this.serverNameToCompositeKeys.get(name);
    if (!compositeKeys) {
      return [];
    }
    const allResources: Resource[] = [];
    for (const compositeKey of compositeKeys) {
      const resources = this.resourceCache.get(compositeKey) || [];
      allResources.push(...resources);
    }
    return allResources;
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

    for (const [compositeKey, resources] of this.resourceCache.entries()) {
      const { serverName } = parseCompositeKey(compositeKey)!;

      if (!result[serverName]) {
        result[serverName] = [];
      }
      result[serverName].push(...resources);
    }

    return result;
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
   * Gets the status of the first connected instance for a server name.
   * This is a backward compatibility method for code that expects getStatusByName.
   *
   * @param name - Server name
   * @returns ServerStatus or undefined if not connected
   */
  public getStatusByName(name: string): ServerStatus | undefined {
    const compositeKeys = this.serverNameToCompositeKeys.get(name);
    if (!compositeKeys || compositeKeys.size === 0) {
      return undefined;
    }
    // Return status of the first connected instance
    for (const compositeKey of compositeKeys) {
      const status = this.serverStatus.get(compositeKey);
      if (status?.connected) {
        return status;
      }
    }
    return undefined;
  }

  /**
   * Gets the composite key of the first connected instance for a server name.
   * This is a backward compatibility method for code that expects getServerIdByName.
   *
   * @param name - Server name
   * @returns Composite key or undefined if no instance is connected
   */
  public getServerIdByName(name: string): string | undefined {
    const compositeKeys = this.serverNameToCompositeKeys.get(name);
    if (!compositeKeys || compositeKeys.size === 0) {
      return undefined;
    }
    // Return the composite key of the first connected instance
    for (const compositeKey of compositeKeys) {
      const status = this.serverStatus.get(compositeKey);
      if (status?.connected) {
        return compositeKey;
      }
    }
    return undefined;
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

/**
 * Parses a composite key back into serverName and serverIndex
 */
function parseCompositeKey(key: string): { serverName: string; serverIndex: number } | null {
  const lastDashIndex = key.lastIndexOf('-');
  if (lastDashIndex === -1) {
    return null;
  }
  const serverName = key.slice(0, lastDashIndex);
  const serverIndexPart = key.slice(lastDashIndex + 1);
  const serverIndex = parseInt(serverIndexPart, 10);
  if (isNaN(serverIndex)) {
    return null;
  }
  return { serverName, serverIndex };
}

export const mcpConnectionManager = new McpConnectionManager();
