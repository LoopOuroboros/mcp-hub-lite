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
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';
import {
  registerInitializeHandlers,
  registerResourcesHandlers,
  registerSystemToolsHandlers,
  registerCallToolHandler
} from './request-handlers/index.js';
import { getAppVersion } from '@utils/version.js';
import { generateGatewayToolsList } from './tool-list-generator.js';
import { formatToolArgs, formatToolResponse } from './log-formatter.js';
import type { ToolMapEntry, GatewayTool } from './types.js';

export class GatewayService {
  private server: McpServer;
  private transport: StdioServerTransport | null = null;
  private readonly appVersion: string;

  constructor() {
    this.appVersion = getAppVersion();
    this.server = this.createServerWithHandlers();
  }

  private createServerWithHandlers(): McpServer {
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

    this.registerHandlers(server);
    return server;
  }

  private registerHandlers(server: McpServer): void {
    // Local toolMap for this connection
    const toolMap = new Map<string, ToolMapEntry>();

    registerInitializeHandlers(server);
    registerResourcesHandlers(server);
    registerSystemToolsHandlers(server);
    registerCallToolHandler(server, toolMap);
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
