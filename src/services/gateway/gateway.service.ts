/**
 * MCP Gateway service that aggregates tools from multiple MCP servers and provides a unified interface.
 *
 * This service acts as the central hub for MCP (Model Context Protocol) communication,
 * exposing both system tools and aggregated tools from connected MCP servers through
 * a single stdio transport endpoint.
 *
 * This is a thin wrapper around modular handlers for better maintainability.
 *
 * @example
 * ```typescript
 * const gateway = new GatewayService();
 * await gateway.start(); // Start on stdio transport
 *
 * // Or create connection server for HTTP transport
 * const server = gateway.createConnectionServer();
 * ```
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from '@utils/index.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { getGatewayDebugSetting } from '@utils/json-utils.js';
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';
import {
  registerInitializeHandlers,
  registerResourcesHandlers,
  registerSystemToolsHandlers,
  registerCallToolHandler
} from './request-handlers/index.js';
import { getAppVersion } from '@utils/version.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';
import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/connection/index.js';
import { sessionManager } from './session-manager.js';
import {
  generateGatewayToolsList,
  rebuildFromScratch,
  addToCache,
  removeFromCache
} from './tool-list-generator.js';
import { formatToolArgs, formatToolResponse } from './log-formatter.js';
import type { ToolMapEntry, GatewayTool } from './types.js';

export class GatewayService {
  private server: McpServer;
  private transport: StdioServerTransport | null = null;
  private readonly appVersion: string;

  constructor() {
    this.appVersion = getAppVersion();
    this.server = this.createServerWithHandlers();
    this.initToolCache();
    this.initNotifications();
  }

  private initToolCache(): void {
    rebuildFromScratch();

    eventBus.subscribe(EventTypes.TOOLS_UPDATED, (rawData) => {
      const data = rawData as { serverName: string };
      const serverConfig = hubManager.getServerByName(data.serverName);
      if (serverConfig?.template?.aggregatedTools?.length) {
        rebuildFromScratch();
      }
    });

    eventBus.subscribe(EventTypes.SERVER_DISCONNECTED, (rawData) => {
      const data = rawData as { serverName: string };
      const serverConfig = hubManager.getServerByName(data.serverName);
      if (!serverConfig || serverConfig.template?.aggregatedTools?.length) {
        rebuildFromScratch();
      }
    });

    eventBus.subscribe(EventTypes.AGGREGATED_TOOLS_CHANGED, (rawData) => {
      const data = rawData as { name: string; added: string[]; removed: string[] };
      if (data.added.length > 0) addToCache(data.name, data.added);
      if (data.removed.length > 0) removeFromCache(data.name, data.removed);
    });
  }

  private createServerWithHandlers(): McpServer {
    if (getGatewayDebugSetting()) {
      logger.debug('Creating new MCP server with handlers', LOG_MODULES.GATEWAY_SERVICE);
    }
    const server = new McpServer(
      {
        name: MCP_HUB_LITE_SERVER,
        version: this.appVersion
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );
    if (getGatewayDebugSetting()) {
      logger.debug('MCP server created successfully', LOG_MODULES.GATEWAY_SERVICE);
    }

    this.registerHandlers(server);
    if (getGatewayDebugSetting()) {
      logger.debug('Handlers registered successfully on MCP server', LOG_MODULES.GATEWAY_SERVICE);
    }
    return server;
  }

  private registerHandlers(server: McpServer): void {
    if (getGatewayDebugSetting()) {
      logger.debug('Registering handlers on MCP server', LOG_MODULES.GATEWAY_SERVICE);
    }

    try {
      registerInitializeHandlers(server);
      if (getGatewayDebugSetting()) {
        logger.debug('Initialize handlers registered successfully', LOG_MODULES.GATEWAY_SERVICE);
      }
    } catch (error) {
      logger.error('Failed to register initialize handlers:', error, LOG_MODULES.GATEWAY_SERVICE);
      throw error;
    }

    try {
      registerResourcesHandlers(server);
      if (getGatewayDebugSetting()) {
        logger.debug('Resources handlers registered successfully', LOG_MODULES.GATEWAY_SERVICE);
      }
    } catch (error) {
      logger.error('Failed to register resources handlers:', error, LOG_MODULES.GATEWAY_SERVICE);
      throw error;
    }

    try {
      registerSystemToolsHandlers(server);
      if (getGatewayDebugSetting()) {
        logger.debug('System tools handlers registered successfully', LOG_MODULES.GATEWAY_SERVICE);
      }
    } catch (error) {
      logger.error('Failed to register system tools handlers:', error, LOG_MODULES.GATEWAY_SERVICE);
      throw error;
    }

    try {
      registerCallToolHandler(server);
      if (getGatewayDebugSetting()) {
        logger.debug('Call tool handler registered successfully', LOG_MODULES.GATEWAY_SERVICE);
      }
    } catch (error) {
      logger.error('Failed to register call tool handler:', error, LOG_MODULES.GATEWAY_SERVICE);
      throw error;
    }

    if (getGatewayDebugSetting()) {
      logger.debug('All handlers registered successfully', LOG_MODULES.GATEWAY_SERVICE);
    }
  }

  /**
   * Generates a unified list of gateway tools with proper naming and collision resolution.
   *
   * @param {Map<string, ToolMapEntry>} toolMap - Map to populate with gateway tool name to actual tool mappings
   * @returns {Array<GatewayTool>} Array of gateway tools with resolved names and descriptions
   */
  public generateGatewayToolsList(toolMap: Map<string, ToolMapEntry>): Array<GatewayTool> {
    return generateGatewayToolsList(toolMap);
  }

  /**
   * Safely formats tool arguments for logging with circular reference handling and size limits.
   *
   * @param {unknown} args - Tool arguments to format
   * @returns {string} Safe formatted string representation of the arguments
   */
  public formatToolArgs(args: unknown): string {
    return formatToolArgs(args);
  }

  /**
   * Safely formats tool responses for logging with size limits.
   *
   * @param {unknown} response - Tool response to format
   * @returns {string} Safe formatted string representation of the response
   */
  public formatToolResponse(response: unknown): string {
    return formatToolResponse(response);
  }

  /**
   * Creates a new MCP server instance with all handlers registered for connection-based transports.
   *
   * @returns {McpServer} New MCP server instance with all handlers registered
   */
  public createConnectionServer(): McpServer {
    return this.createServerWithHandlers();
  }

  /**
   * Returns the singleton McpServer instance used for HTTP transport.
   */
  public getServer(): McpServer {
    return this.server;
  }

  /**
   * Subscribes to EventBus events and pushes MCP notifications
   * (notifications/resources/list_changed, notifications/tools/list_changed)
   * to connected SSE clients via the singleton transport.
   *
   * Tools are aggregated by ServerName (multi-instance deduplication).
   * Resources are per-instance (Category 1: hub://servers/{name}, Category 2: hub://servers/{name}/{idx}/{path}).
   */
  private initNotifications(): void {
    // --- Resources list_changed ---

    // Category 1: new/removed server config
    eventBus.subscribe(EventTypes.SERVER_ADDED, () => {
      sessionManager.broadcastNotification('resources');
    });
    eventBus.subscribe(EventTypes.SERVER_DELETED, () => {
      sessionManager.broadcastNotification('resources');
    });

    // Category 1 + 2: any instance connect/disconnect changes resource list
    eventBus.subscribe(EventTypes.SERVER_CONNECTED, () => {
      sessionManager.broadcastNotification('resources');
    });
    eventBus.subscribe(EventTypes.SERVER_DISCONNECTED, () => {
      sessionManager.broadcastNotification('resources');
    });

    // Category 2: backend server resources refreshed
    eventBus.subscribe(EventTypes.RESOURCES_UPDATED, () => {
      sessionManager.broadcastNotification('resources');
    });

    // --- Tools list_changed ---

    // Only notify when the first instance connects or last instance disconnects
    eventBus.subscribe(EventTypes.SERVER_CONNECTED, (rawData) => {
      const data = rawData as { serverName: string };
      const indexes = mcpConnectionManager.getConnectedIndexes(data.serverName);
      if (indexes.length === 1) {
        const serverConfig = hubManager.getServerByName(data.serverName);
        if (serverConfig?.template?.aggregatedTools?.length) {
          sessionManager.broadcastNotification('tools');
        }
      }
    });

    eventBus.subscribe(EventTypes.SERVER_DISCONNECTED, (rawData) => {
      const data = rawData as { serverName: string };
      const indexes = mcpConnectionManager.getConnectedIndexes(data.serverName);
      if (indexes.length === 0) {
        const serverConfig = hubManager.getServerByName(data.serverName);
        if (serverConfig?.template?.aggregatedTools?.length) {
          sessionManager.broadcastNotification('tools');
        }
      }
    });

    // Backend server tools refreshed while connected
    eventBus.subscribe(EventTypes.TOOLS_UPDATED, (rawData) => {
      const data = rawData as { serverName: string };
      const serverConfig = hubManager.getServerByName(data.serverName);
      if (serverConfig?.template?.aggregatedTools?.length) {
        sessionManager.broadcastNotification('tools');
      }
    });

    // Aggregated tools config changed
    eventBus.subscribe(EventTypes.AGGREGATED_TOOLS_CHANGED, () => {
      sessionManager.broadcastNotification('tools');
    });
  }

  /**
   * Starts the MCP gateway service on stdio transport.
   *
   * @returns {Promise<void>} Resolves when the gateway is successfully started on stdio
   */
  public async start() {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    logger.info('MCP Gateway started on stdio', LOG_MODULES.GATEWAY_SERVICE);
  }
}

export const gateway = new GatewayService();
