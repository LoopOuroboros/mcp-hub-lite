import { hubManager } from './hub-manager.service.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import type { Tool } from '@shared-models/tool.model.js';
import type { Resource } from '@shared-models/resource.model.js';
import { eventBus, EventTypes } from './event-bus.service.js';
import { gateway } from './gateway.service.js';
import { logger, LOG_MODULES } from '@utils/logger.js';
import { stringifyForLogging } from '@utils/json-utils.js';
import {
  MCP_HUB_LITE_SERVER,
  LIST_SERVERS_TOOL,
  FIND_SERVERS_TOOL,
  LIST_ALL_TOOLS_IN_SERVER_TOOL,
  FIND_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  FIND_TOOLS_TOOL,
  SYSTEM_TOOL_NAMES
} from '@models/system-tools.constants.js';
import type {
  SystemToolArgs,
  SystemToolName,
  ListServersParams,
  FindServersParams,
  ListAllToolsInServerParams,
  FindToolsInServerParams,
  GetToolParams,
  CallToolParams,
  FindToolsParams
} from '@models/system-tools.constants.js';
import { ToolArgsParser } from '@utils/tool-args-parser.js';
import {
  hasValidId,
  selectBestInstance,
  getSystemTools,
  findServers as findServersUtil,
  findToolsInServer as findToolsInServerUtil,
  findTools as findToolsUtil,
  generateDynamicResources,
  readResource as readResourceUtil
} from './hub-tools/index.js';

/**
 * Central service for managing system tools and MCP server interactions in the MCP Hub Lite gateway.
 *
 * The HubToolsService provides a unified interface for discovering, managing, and interacting with
 * all connected MCP (Model Context Protocol) servers. It serves as the primary orchestration layer
 * between client applications and the underlying MCP infrastructure, offering both system-level
 * management capabilities and direct tool execution functionality.
 *
 * ## Core Responsibilities
 *
 * - **System Tool Management**: Exposes a standardized set of system tools for server discovery and management
 * - **Tool Discovery**: Enables searching and listing tools across all connected MCP servers
 * - **Tool Execution**: Provides safe, monitored execution of tools with comprehensive event tracking
 * - **Resource Management**: Dynamically generates and serves virtual resources representing server state
 * - **Instance Selection**: Handles intelligent server instance selection for multi-instance scenarios
 * - **Error Handling**: Implements consistent error handling and logging across all operations
 *
 * ## System Tools Provided
 *
 * The service exposes the following system tools through the `getSystemTools()` method:
 * - `list-servers`: Retrieve all connected server names
 * - `find-servers`: Search servers by pattern matching
 * - `list-all-tools-in-server`: List all tools from a specific server
 * - `find-tools-in-server`: Search tools within a specific server
 * - `get-tool`: Retrieve complete schema for a specific tool
 * - `call-tool`: Execute a tool on a specific server
 * - `find-tools`: Search tools across all connected servers
 *
 * ## Architecture Integration
 *
 * This service integrates tightly with other core components:
 * - **HubManagerService**: For server configuration and instance management
 * - **McpConnectionManager**: For actual tool execution and connection management
 * - **EventBusService**: For publishing tool call events and system notifications
 * - **GatewayService**: For system tool routing and aggregation
 *
 * All operations include comprehensive logging, error handling, and event publishing
 * to support observability, debugging, and monitoring of the MCP Hub Lite system.
 *
 * @example
 * ```typescript
 * const hubTools = new HubToolsService();
 *
 * // List all connected servers
 * const servers = await hubTools.listServers();
 *
 * // Call a tool on a specific server
 * const result = await hubTools.callTool('file-system-server', 'list-files', { directory: '/home' });
 *
 * // Search for tools across all servers
 * const matchingTools = await hubTools.findTools('search');
 * ```
 */
export class HubToolsService {
  /**
   * Cached dynamic resource list to avoid regenerating on every request
   */
  private generatedResourcesCache: Resource[] | null = null;

  constructor() {
    // Listen for server status change events to invalidate resource cache
    eventBus.subscribe(EventTypes.SERVER_STATUS_CHANGE, () => {
      this.generatedResourcesCache = null;
    });

    eventBus.subscribe(EventTypes.SERVER_CONNECTED, () => {
      this.generatedResourcesCache = null;
    });

    eventBus.subscribe(EventTypes.SERVER_DISCONNECTED, () => {
      this.generatedResourcesCache = null;
    });

    eventBus.subscribe(EventTypes.RESOURCES_UPDATED, () => {
      this.generatedResourcesCache = null;
    });

    eventBus.subscribe(EventTypes.TOOLS_UPDATED, () => {
      this.generatedResourcesCache = null;
    });
  }

  /**
   * Retrieves the complete list of system tools provided by this service.
   *
   * This method generates system tool configurations based on the SYSTEM_TOOL_NAMES constant,
   * ensuring consistency with the defined system tool names. Each tool includes its name,
   * description, input schema, and annotations for proper client-side rendering and behavior.
   *
   * @returns {Array<{ name: string; description: string; inputSchema: JsonSchema; annotations?: ToolAnnotations }>}
   * Array of system tool configurations
   */
  getSystemTools() {
    return getSystemTools();
  }

  /**
   * Lists all connected MCP servers by name.
   *
   * This method retrieves all configured servers from the hub manager, filters out
   * invalid entries using the hasValidId type guard, and returns an array of server names.
   * It provides a simple way to discover available servers in the system.
   *
   * @returns {Promise<string[]>} Array of connected server names
   */
  async listServers(): Promise<string[]> {
    const servers = hubManager.getAllServers();
    return servers.filter(hasValidId).map((server) => server.name);
  }

  /**
   * Finds servers matching a specified regex pattern.
   *
   * This method searches through all configured servers using the provided regex pattern,
   * supporting flexible search options including case sensitivity and search scope
   * (name, description, or both). It returns an array of matching server names.
   *
   * @param {FindServersParams} args - Search parameters
   * @returns {Promise<string[]>} Array of matching server names
   */
  async findServers(args: FindServersParams): Promise<string[]> {
    return findServersUtil(args.pattern, args.searchIn, args.caseSensitive);
  }

  /**
   * Lists all tools available from a specific MCP server.
   *
   * This method retrieves all tools from the specified server, handling both regular
   * MCP servers and the special MCP Hub Lite server (which returns system tools).
   * It uses the selectBestInstance function to resolve server names to instances
   * and leverages the MCP connection manager for tool retrieval.
   *
   * @param {ListAllToolsInServerParams} args - Server name and request options
   * @returns {Promise<{ serverName: string; tools: Tool[] }>} Object containing server name and tools array
   * @throws {Error} If the specified server is not found or not connected
   */
  async listAllToolsInServer(args: ListAllToolsInServerParams): Promise<{
    serverName: string;
    tools: Tool[];
  }> {
    // Handle MCP Hub Lite server (return system tools list)
    if (typeof args.serverName === 'string' && args.serverName === MCP_HUB_LITE_SERVER) {
      // Generate tool list using the same logic as tools/list
      const toolMap = new Map<string, { serverId: string; realToolName: string }>();
      const gatewayTools = gateway.generateGatewayToolsList(toolMap);

      // Convert to Tool format
      const tools: Tool[] = gatewayTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        serverName: MCP_HUB_LITE_SERVER,
        annotations: tool.annotations
      }));

      return {
        serverName: args.serverName,
        tools
      };
    }

    const serverInfo = selectBestInstance(args.serverName, args.requestOptions);

    if (!serverInfo) {
      throw new Error(`Server not found: ${args.serverName}`);
    }

    // Get instance ID
    const serverId = serverInfo.instance.id;

    // Get tool list from connection manager
    const tools = mcpConnectionManager.getTools(serverId);

    return {
      serverName: args.serverName,
      tools
    };
  }

  /**
   * Finds tools matching a pattern within a specific MCP server.
   *
   * This method searches through all tools available from the specified server using
   * the provided regex pattern, supporting flexible search options including case
   * sensitivity and search scope (name, description, or both). It returns matching
   * tools grouped by server name.
   *
   * @param {FindToolsInServerParams} args - Search parameters
   * @returns {Promise<{ serverName: string; tools: Tool[] }>} Object containing server name and matching tools
   * @throws {Error} If the specified server is not found or not connected
   */
  async findToolsInServer(args: FindToolsInServerParams): Promise<{
    serverName: string;
    tools: Tool[];
  }> {
    return findToolsInServerUtil(
      args.serverName,
      args.pattern,
      args.searchIn,
      args.caseSensitive,
      args.requestOptions
    );
  }

  /**
   * Retrieves the complete schema for a specific tool from a specific server.
   *
   * This method returns the full tool definition including name, description, input schema,
   * and any annotations. It's useful for clients that need detailed information about
   * a tool's capabilities and expected parameters before execution.
   *
   * @param {GetToolParams} args - Tool retrieval parameters
   * @returns {Promise<Tool | undefined>} Complete tool schema or undefined if not found
   * @throws {Error} If the specified server is not found or not connected
   */
  async getTool(args: GetToolParams): Promise<Tool | undefined> {
    const serverInfo = selectBestInstance(args.serverName, args.requestOptions);

    if (!serverInfo) {
      throw new Error(`Server not found: ${args.serverName}`);
    }

    const tools = mcpConnectionManager.getTools(serverInfo.instance.id);
    return tools.find((tool) => tool.name === args.toolName);
  }

  /**
   * Calls a specific system tool directly with type-safe conditional return types.
   *
   * This method provides a unified entry point for all system tool calls, using TypeScript's
   * conditional types to ensure type safety based on the tool name. It handles logging,
   * error handling, and delegates to the appropriate internal methods based on the tool name.
   *
   * @param {T} toolName - System tool name with generic type constraint
   * @param {SystemToolArgs} toolArgs - Type-safe arguments based on tool name
   * @returns {Promise<ConditionalReturnType>} Tool execution result with accurate type safety matching actual method return types
   * @throws {Error} If the system tool is not found or execution fails
   */
  async callSystemTool<T extends SystemToolName>(
    toolName: T,
    toolArgs: T extends typeof LIST_SERVERS_TOOL
      ? ListServersParams
      : T extends typeof FIND_SERVERS_TOOL
        ? FindServersParams
        : T extends typeof LIST_ALL_TOOLS_IN_SERVER_TOOL
          ? ListAllToolsInServerParams
          : T extends typeof FIND_TOOLS_IN_SERVER_TOOL
            ? FindToolsInServerParams
            : T extends typeof GET_TOOL_TOOL
              ? GetToolParams
              : T extends typeof CALL_TOOL_TOOL
                ? CallToolParams
                : T extends typeof FIND_TOOLS_TOOL
                  ? FindToolsParams
                  : never
  ): Promise<
    T extends typeof LIST_SERVERS_TOOL
      ? string[]
      : T extends typeof FIND_SERVERS_TOOL
        ? string[]
        : T extends typeof LIST_ALL_TOOLS_IN_SERVER_TOOL
          ? { serverName: string; tools: Tool[] }
          : T extends typeof FIND_TOOLS_IN_SERVER_TOOL
            ? { serverName: string; tools: Tool[] }
            : T extends typeof GET_TOOL_TOOL
              ? Tool | undefined
              : T extends typeof CALL_TOOL_TOOL
                ? unknown
                : T extends typeof FIND_TOOLS_TOOL
                  ? Record<string, { tools: Tool[] }>
                  : never
  > {
    logger.debug(
      `System tool called: ${toolName}, args=${stringifyForLogging(toolArgs)}`,
      LOG_MODULES.HUB_TOOLS
    );

    try {
      let result;
      switch (toolName) {
        case LIST_SERVERS_TOOL:
          result = await this.listServers();
          break;
        case FIND_SERVERS_TOOL: {
          result = await this.findServers(toolArgs as FindServersParams);
          break;
        }
        case LIST_ALL_TOOLS_IN_SERVER_TOOL: {
          result = await this.listAllToolsInServer(toolArgs as ListAllToolsInServerParams);
          break;
        }
        case FIND_TOOLS_IN_SERVER_TOOL: {
          result = await this.findToolsInServer(toolArgs as FindToolsInServerParams);
          break;
        }
        case GET_TOOL_TOOL: {
          result = await this.getTool(toolArgs as GetToolParams);
          break;
        }
        case CALL_TOOL_TOOL: {
          const callToolArgs = toolArgs as CallToolParams;
          let serverName = callToolArgs.serverName;
          if (!serverName || serverName === 'undefined') {
            serverName = MCP_HUB_LITE_SERVER;
          }
          result = await this.callTool({
            ...callToolArgs,
            serverName
          });
          break;
        }
        case FIND_TOOLS_TOOL: {
          result = await this.findTools(toolArgs as FindToolsParams);
          break;
        }
        default:
          throw new Error(`System tool "${toolName}" not found`);
      }

      logger.debug(`System tool SUCCESS: ${toolName}`, LOG_MODULES.HUB_TOOLS);
      // Type assertion based on toolName to match the expected return type
      return result as T extends typeof LIST_SERVERS_TOOL
        ? string[]
        : T extends typeof FIND_SERVERS_TOOL
          ? string[]
          : T extends typeof LIST_ALL_TOOLS_IN_SERVER_TOOL
            ? { serverName: string; tools: Tool[] }
            : T extends typeof FIND_TOOLS_IN_SERVER_TOOL
              ? { serverName: string; tools: Tool[] }
              : T extends typeof GET_TOOL_TOOL
                ? Tool | undefined
                : T extends typeof CALL_TOOL_TOOL
                  ? unknown
                  : T extends typeof FIND_TOOLS_TOOL
                    ? Record<string, { tools: Tool[] }>
                    : never;
    } catch (error) {
      logger.error(
        `System tool FAILED: ${toolName}, error=${error instanceof Error ? error.message : String(error)}`,
        error,
        LOG_MODULES.HUB_TOOLS
      );
      throw error;
    }
  }

  /**
   * Calls a specific tool from a specific MCP server with comprehensive event tracking.
   *
   * This method handles both regular MCP server tool calls and system tool calls (when
   * serverName is 'mcp-hub-lite'). It publishes TOOL_CALL_STARTED, TOOL_CALL_COMPLETED,
   * and TOOL_CALL_ERROR events for monitoring and debugging purposes, and includes
   * detailed logging for observability.
   *
   * @param {CallToolParams} args - Tool call parameters
   * @returns {Promise<unknown>} Tool execution result as returned by the server
   * @throws {Error} If the server is not found, not connected, or tool execution fails
   */
  async callTool(args: CallToolParams): Promise<unknown> {
    let { serverName, toolName } = args;
    const { toolArgs, requestOptions } = args;
    // Parse prefixed tool names (like mcp__mcp-hub-lite__xxx) if applicable
    const parsedTool = ToolArgsParser.parsePrefixedToolName(toolName);
    if (parsedTool) {
      logger.debug(
        `Parsed prefixed tool name: "${toolName}" → server="${parsedTool.serverName}", tool="${parsedTool.toolName}"`,
        LOG_MODULES.HUB_TOOLS
      );
      serverName = parsedTool.serverName;
      toolName = parsedTool.toolName;
    }

    // Handle MCP Hub Lite server (system tool call or find tool in all servers)
    if (!serverName || serverName === 'undefined') {
      serverName = MCP_HUB_LITE_SERVER;
    }
    if (typeof serverName === 'string' && serverName === MCP_HUB_LITE_SERVER) {
      // Check if it's a system tool
      if (SYSTEM_TOOL_NAMES.includes(toolName as SystemToolName)) {
        return await this.callSystemTool(toolName as SystemToolName, toolArgs as SystemToolArgs);
      }

      // Not a system tool - find it in all connected servers
      logger.info(
        `Looking for tool '${toolName}' in all connected servers (gateway mode)`,
        LOG_MODULES.HUB_TOOLS
      );

      // Find all servers that have this tool
      const matchingServers: string[] = [];
      const servers = hubManager.getAllServers();

      for (const server of servers) {
        if (!hasValidId(server)) {
          continue;
        }

        const serverInfo = selectBestInstance(server.name, requestOptions);
        if (serverInfo && serverInfo.instance.id) {
          const tools = mcpConnectionManager.getTools(serverInfo.instance.id);
          if (tools.some((tool) => tool.name === toolName)) {
            matchingServers.push(server.name);
          }
        }
      }

      if (matchingServers.length === 0) {
        logger.error(`Tool '${toolName}' not found in any connected server`, LOG_MODULES.HUB_TOOLS);
        throw new Error(`Tool '${toolName}' not found`);
      }

      if (matchingServers.length > 1) {
        logger.warn(
          `Tool '${toolName}' found in multiple servers: ${matchingServers.join(', ')}. Using first match.`,
          LOG_MODULES.HUB_TOOLS
        );
      }

      // Use the first matching server
      serverName = matchingServers[0];
    }

    logger.debug(
      `Tool call received: serverName=${serverName}, toolName=${toolName}, args=${stringifyForLogging(toolArgs)}`,
      LOG_MODULES.HUB_TOOLS
    );

    const serverInfo = selectBestInstance(serverName, requestOptions);

    if (!serverInfo) {
      logger.error(`Server not found: ${serverName}`, LOG_MODULES.HUB_TOOLS);
      throw new Error(`Server not found: ${serverName}`);
    }

    const serverId = serverInfo.instance.id;
    const requestId = `tool-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Publish tool call started event
    eventBus.publish(EventTypes.TOOL_CALL_STARTED, {
      requestId,
      serverId,
      serverName,
      toolName,
      timestamp: Date.now(),
      args: toolArgs
    });

    try {
      const result = await mcpConnectionManager.callTool(serverId, toolName, toolArgs);

      // Publish tool call completed event
      eventBus.publish(EventTypes.TOOL_CALL_COMPLETED, {
        requestId,
        serverId,
        serverName,
        toolName,
        timestamp: Date.now(),
        result
      });

      logger.debug(
        `Tool call SUCCESS: serverName=${serverName}, toolName=${toolName}`,
        LOG_MODULES.HUB_TOOLS
      );
      return result;
    } catch (error) {
      // Publish tool call error event
      eventBus.publish(EventTypes.TOOL_CALL_ERROR, {
        requestId,
        serverId,
        serverName,
        toolName,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      logger.error(
        `Tool call FAILED: serverName=${serverName}, toolName=${toolName}, error=${error instanceof Error ? error.message : String(error)}`,
        error,
        LOG_MODULES.HUB_TOOLS
      );
      throw error;
    }
  }

  /**
   * Lists all available tools from all connected servers including system tools.
   *
   * This method aggregates tools from all configured and connected MCP servers, including
   * the system tools provided by the MCP Hub Lite server itself. It returns a structured
   * object mapping server names to their respective tool arrays.
   *
   * @returns {Promise<Record<string, { tools: Tool[] }>>} Object mapping server names to tool arrays
   */
  async listAllTools(): Promise<
    Record<
      string,
      {
        tools: Tool[];
      }
    >
  > {
    const servers = hubManager.getAllServers();
    const allTools: Record<string, { tools: Tool[] }> = {};

    // Add system tools under mcp-hub-lite server
    const systemTools = this.getSystemTools().map((tool) => ({
      ...tool,
      description: `[System] ${tool.description}`,
      serverName: MCP_HUB_LITE_SERVER
    }));

    allTools[MCP_HUB_LITE_SERVER] = {
      tools: systemTools
    };

    for (const server of servers) {
      if (!hasValidId(server)) {
        continue;
      }
      const instances = hubManager.getServerInstanceByName(server.name);
      for (const instance of instances) {
        if (instance.id) {
          const tools = mcpConnectionManager.getTools(instance.id);
          allTools[server.name] = {
            tools
          };
        }
      }
    }

    return allTools;
  }

  /**
   * Finds tools matching a pattern across all connected MCP servers.
   *
   * This method searches through all available tools from all connected servers using the
   * provided regex pattern, supporting flexible search options including case sensitivity
   * and search scope (name, description, or both). It returns matching tools grouped by
   * their originating server names.
   *
   * @param {FindToolsParams} args - Search parameters
   * @returns {Promise<Record<string, { tools: Tool[] }>>} Object mapping server names to matching tools
   */
  async findTools(args: FindToolsParams): Promise<
    Record<
      string,
      {
        tools: Tool[];
      }
    >
  > {
    return findToolsUtil(args.pattern, args.searchIn, args.caseSensitive, () =>
      this.listAllTools()
    );
  }

  /**
   * Lists all dynamically generated Hub resources based on connected MCP servers.
   *
   * This method returns an array of virtual resources that represent the current state
   * of connected servers, providing a unified interface for resource discovery and access.
   * The resources are generated on-demand based on the current server configuration.
   *
   * @returns {Promise<Resource[]>} Array of MCP resource objects representing Hub resources
   */
  async listResources(): Promise<Resource[]> {
    if (this.generatedResourcesCache) {
      return this.generatedResourcesCache;
    }

    const resources = generateDynamicResources();
    this.generatedResourcesCache = resources;
    return resources;
  }

  /**
   * Reads content from a specific Hub resource URI.
   *
   * This method provides access to dynamically generated Hub resources by parsing the URI
   * and returning the appropriate content based on the resource type. It supports three
   * types of resources:
   * - Server metadata: hub://servers/{serverName}
   * - Tools list: hub://servers/{serverName}/tools
   * - Resources list: hub://servers/{serverName}/resources
   *
   * @param {string} uri - Resource URI to read (e.g., hub://servers/server-name)
   * @returns {Promise<ServerMetadata | Tool[] | Resource[]>} Resource content based on URI type
   * @throws {Error} If URI format is invalid, server not found, or resource type unknown
   */
  async readResource(uri: string): Promise<
    | {
        name: string;
        status: unknown;
        toolsCount: number;
        resourcesCount: number;
        tags: Record<string, string>;
        lastHeartbeat: number;
        uptime: number;
      }
    | Tool[]
    | Resource[]
  > {
    return readResourceUtil(uri) as unknown as
      | {
          name: string;
          status: unknown;
          toolsCount: number;
          resourcesCount: number;
          tags: Record<string, string>;
          lastHeartbeat: number;
          uptime: number;
        }
      | Tool[]
      | Resource[];
  }
}

export const hubToolsService = new HubToolsService();
