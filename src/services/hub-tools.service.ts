import { hubManager } from './hub-manager.service.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import type { JsonSchema } from '@shared-models/tool.model.js';
import type { ServerConfig, ServerInstanceConfig } from '@config/config.schema.js';
import type { Tool } from '@shared-models/tool.model.js';
import type { Resource } from '@shared-models/resource.model.js';
import type { ServerStatus } from '@shared-types/common.types.js';
import { eventBus, EventTypes } from './event-bus.service.js';
import { gateway } from './gateway.service.js';
import { logger } from '@utils/logger.js';
import { stringifyForLogging } from '@utils/json-utils.js';
import {
  SYSTEM_TOOL_NAMES,
  LIST_SERVERS_TOOL,
  FIND_SERVERS_TOOL,
  LIST_ALL_TOOLS_IN_SERVER_TOOL,
  FIND_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  FIND_TOOLS_TOOL,
  MCP_HUB_LITE_SERVER
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

/**
 * Configuration options for server instance selection in multi-instance scenarios.
 *
 * This interface defines request options that can be used to select specific server instances
 * when multiple instances of the same MCP server are available. The current implementation
 * uses the first available instance, but the interface is designed to support future
 * extensions for intelligent instance selection based on various criteria.
 *
 * @interface RequestOptions
 * @property {string} [sessionId] - Session identifier for selecting instance associated with specific session
 * @property {Record<string, string>} [tags] - Key-value tags for matching against server instance tags
 *
 * @example
 * ```typescript
 * // Select instance based on session
 * const options: RequestOptions = { sessionId: 'session-123' };
 *
 * // Select instance based on tags
 * const options: RequestOptions = { tags: { environment: 'production' } };
 * ```
 */
export interface RequestOptions {
  sessionId?: string; // Session ID (for selecting specific instance)
  tags?: Record<string, string>; // Tags (for future support)
  // Future options that may be added
  // clientId?: string;  // Client ID (for selecting dedicated instance)
}

/**
 * Selects the best server instance based on server name and request options.
 *
 * This function resolves a server name to its configuration and instance details,
 * handling both single and multiple instance scenarios. Currently, it returns
 * the first instance for multi-instance servers, but the architecture supports
 * future extensions for intelligent instance selection based on session ID,
 * tags, client ID, or load conditions.
 *
 * The function performs the following steps:
 * 1. Retrieves all instances of the specified server name
 * 2. Returns undefined if no instances are found
 * 3. Gets the server configuration from the hub manager
 * 4. For single-instance servers, returns the instance directly
 * 5. For multi-instance servers, currently returns the first instance (with future extension support)
 *
 * Future extensions planned include:
 * - Session-aware instance selection based on sessionId
 * - Tag-based instance selection for matching specific requirements
 * - Load-balancing across multiple instances
 * - Client-specific instance assignment
 *
 * @param {string} serverName - Name of the server to select an instance for
 * @param {RequestOptions} [requestOptions] - Optional request options for instance selection
 * @returns {{ name: string; config: ServerConfig; instance: ServerInstanceConfig & Record<string, unknown> } | undefined}
 * Server information with configuration and instance details, or undefined if not found
 *
 * @example
 * ```typescript
 * const serverInfo = selectBestInstance('my-mcp-server');
 * if (serverInfo) {
 *   console.log(`Selected instance: ${serverInfo.instance.id}`);
 * }
 *
 * // With request options (future extension)
 * const serverInfoWithOptions = selectBestInstance('my-mcp-server', {
 *   sessionId: 'session-123',
 *   tags: { environment: 'production' }
 * });
 * ```
 */
function selectBestInstance(
  serverName: string,
  requestOptions?: RequestOptions
):
  | {
      name: string;
      config: ServerConfig;
      instance: ServerInstanceConfig & Record<string, unknown>;
    }
  | undefined {
  // Get all instances of the server
  const instances = hubManager.getServerInstanceByName(serverName);

  if (instances.length === 0) {
    return undefined;
  }

  // Get server configuration
  const serverConfig = hubManager.getServerByName(serverName);
  if (!serverConfig) {
    return undefined;
  }

  // If there's only one instance, return it directly
  if (instances.length === 1) {
    return {
      name: serverName,
      config: serverConfig,
      instance: instances[0]
    };
  }

  // Multi-instance selection logic (for future extension)
  // Currently simplified implementation: return the first instance
  // Future extensions could support:
  // - Selecting specific instance based on sessionId
  // - Selecting optimal instance based on tags matching
  // - Selecting dedicated instance based on client ID
  // - Selecting instance based on load conditions

  // Although requestOptions is not currently used, it's kept for future extension
  if (requestOptions?.sessionId) {
    // In the future, specific instance can be selected based on sessionId
    // Currently return the first instance temporarily
  }

  if (requestOptions?.tags) {
    // In the future, optimal instance can be selected based on tags matching
    // Currently return the first instance temporarily
  }

  return {
    name: serverName,
    config: serverConfig,
    instance: instances[0] // Will be extended to intelligent selection logic later
  };
}

/**
 * Type guard to validate that a server object has valid name and configuration.
 *
 * This function checks if the provided object is a valid server with both a non-empty
 * name string and a configuration object, ensuring type safety for server operations.
 *
 * @param {unknown} server - Object to validate as a server
 * @returns {boolean} True if the object is a valid server with name and config
 *
 * @example
 * ```typescript
 * const server = { name: 'my-server', config: { type: 'stdio' } };
 * if (hasValidId(server)) {
 *   // TypeScript knows server is properly typed
 *   console.log(server.name);
 * }
 * ```
 */
function hasValidId(server: unknown): server is { name: string; config: ServerConfig } {
  if (typeof server !== 'object' || server === null) {
    return false;
  }
  const s = server as { name?: unknown; config?: unknown };
  return typeof s.name === 'string' && s.name.length > 0 && typeof s.config === 'object';
}

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
   * The method implements all standard system tools:
   * - list-servers: List all connected servers
   * - find-servers: Find servers matching a pattern
   * - list-all-tools-in-server: List tools from a specific server
   * - find-tools-in-server: Find tools in a specific server
   * - get-tool: Get complete tool schema
   * - call-tool: Call a specific tool from a specific server
   * - find-tools: Find tools across all servers
   *
   * @returns {Array<{ name: string; description: string; inputSchema: JsonSchema; annotations?: ToolAnnotations }>}
   * Array of system tool configurations
   *
   * @example
   * ```typescript
   * const systemTools = hubToolsService.getSystemTools();
   * console.log(`Available system tools: ${systemTools.length}`);
   * ```
   */
  getSystemTools() {
    const systemTools: Array<{
      name: string;
      description: string;
      inputSchema: JsonSchema;
      annotations?: {
        title?: string;
        readOnlyHint?: boolean;
        destructiveHint?: boolean;
        idempotentHint?: boolean;
        openWorldHint?: boolean;
      };
    }> = [];

    // Build system tools based on the constant array to ensure consistency
    for (const toolName of SYSTEM_TOOL_NAMES) {
      switch (toolName) {
        case LIST_SERVERS_TOOL:
          systemTools.push({
            name: toolName,
            description: 'List all connected servers',
            inputSchema: {
              type: 'object',
              properties: {}
            },
            annotations: {
              title: 'List Servers',
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false
            }
          });
          break;
        case FIND_SERVERS_TOOL:
          systemTools.push({
            name: toolName,
            description: 'Find servers matching a pattern',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: { type: 'string', description: 'Regex pattern to search for' },
                searchIn: {
                  type: 'string',
                  enum: ['name', 'description', 'both'],
                  default: 'both'
                },
                caseSensitive: { type: 'boolean', default: false }
              },
              required: ['pattern']
            },
            annotations: {
              title: 'Find Servers',
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false
            }
          });
          break;
        case LIST_ALL_TOOLS_IN_SERVER_TOOL:
          systemTools.push({
            name: toolName,
            description: 'List all tools from a specific server',
            inputSchema: {
              type: 'object',
              properties: {
                serverName: { type: 'string', description: 'Name of the MCP server' },
                requestOptions: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', description: 'Session ID for instance selection' },
                    tags: { type: 'object', description: 'Tags for instance selection' }
                  }
                }
              },
              required: ['serverName']
            },
            annotations: {
              title: 'List Tools in Server',
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false
            }
          });
          break;
        case FIND_TOOLS_IN_SERVER_TOOL:
          systemTools.push({
            name: toolName,
            description: 'Find tools matching a pattern in a specific server',
            inputSchema: {
              type: 'object',
              properties: {
                serverName: { type: 'string', description: 'Name of the MCP server' },
                pattern: { type: 'string', description: 'Regex pattern to search for' },
                searchIn: {
                  type: 'string',
                  enum: ['name', 'description', 'both'],
                  default: 'both'
                },
                caseSensitive: { type: 'boolean', default: false },
                requestOptions: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', description: 'Session ID for instance selection' },
                    tags: { type: 'object', description: 'Tags for instance selection' }
                  }
                }
              },
              required: ['serverName', 'pattern']
            },
            annotations: {
              title: 'Find Tools in Server',
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false
            }
          });
          break;
        case GET_TOOL_TOOL:
          systemTools.push({
            name: toolName,
            description: 'Get complete schema for a specific tool from a specific server',
            inputSchema: {
              type: 'object',
              properties: {
                serverName: { type: 'string', description: 'Name of the MCP server' },
                toolName: { type: 'string', description: 'Exact name of the tool' },
                requestOptions: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', description: 'Session ID for instance selection' },
                    tags: { type: 'object', description: 'Tags for instance selection' }
                  }
                }
              },
              required: ['serverName', 'toolName']
            },
            annotations: {
              title: 'Get Tool Details',
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false
            }
          });
          break;
        case CALL_TOOL_TOOL:
          systemTools.push({
            name: toolName,
            description: 'Call a specific tool from a specific server',
            inputSchema: {
              type: 'object',
              properties: {
                serverName: { type: 'string', description: 'Name of the MCP server' },
                toolName: { type: 'string', description: 'Name of the tool to call' },
                toolArgs: { type: 'object', description: 'Arguments to pass to the tool' },
                requestOptions: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', description: 'Session ID for instance selection' },
                    tags: { type: 'object', description: 'Tags for instance selection' }
                  }
                }
              },
              required: ['serverName', 'toolName', 'toolArgs']
            },
            annotations: {
              title: 'Call Tool',
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: false,
              openWorldHint: true
            }
          });
          break;
        case FIND_TOOLS_TOOL:
          systemTools.push({
            name: toolName,
            description: 'Find tools matching a pattern across all connected servers',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: { type: 'string', description: 'Regex pattern to search for' },
                searchIn: {
                  type: 'string',
                  enum: ['name', 'description', 'both'],
                  default: 'both'
                },
                caseSensitive: { type: 'boolean', default: false }
              },
              required: ['pattern']
            },
            annotations: {
              title: 'Find Tools',
              readOnlyHint: true,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false
            }
          });
          break;
        default:
          // This should never happen due to TypeScript type checking
          throw new Error(`Unknown system tool: ${toolName}`);
      }
    }

    return systemTools;
  }

  /**
   * Lists all connected MCP servers by name.
   *
   * This method retrieves all configured servers from the hub manager, filters out
   * invalid entries using the hasValidId type guard, and returns an array of server names.
   * It provides a simple way to discover available servers in the system.
   *
   * @returns {Promise<string[]>} Array of connected server names
   *
   * @example
   * ```typescript
   * const servers = await hubToolsService.listServers();
   * console.log(`Connected servers: ${servers.join(', ')}`);
   * ```
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
   * @param {string} pattern - Regex pattern to search for in server names and descriptions
   * @param {'name' | 'description' | 'both'} [searchIn='both'] - Where to perform the search
   * @param {boolean} [caseSensitive=false] - Whether the search should be case-sensitive
   * @returns {Promise<string[]>} Array of matching server names
   *
   * @example
   * ```typescript
   * // Find servers with 'api' in their name (case-insensitive)
   * const apiServers = await hubToolsService.findServers('api');
   *
   * // Find servers with exact case match
   * const exactMatch = await hubToolsService.findServers('^MyServer$', 'name', true);
   * ```
   */
  async findServers(
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false
  ): Promise<string[]> {
    const allServers = hubManager.getAllServers();
    const validServers = allServers.filter(hasValidId);
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    return validServers
      .filter((server) => {
        const matchName = searchIn !== 'description' && regex.test(server.name);
        const matchDescription = searchIn !== 'name' && server.name && regex.test(server.name); // Using name as fallback if no description
        return matchName || matchDescription;
      })
      .map((server) => server.name);
  }

  /**
   * Lists all tools available from a specific MCP server.
   *
   * This method retrieves all tools from the specified server, handling both regular
   * MCP servers and the special MCP Hub Lite server (which returns system tools).
   * It uses the selectBestInstance function to resolve server names to instances
   * and leverages the MCP connection manager for tool retrieval.
   *
   * @param {string} serverName - Name of the MCP server to list tools from
   * @param {RequestOptions} [requestOptions] - Optional request options for instance selection
   * @returns {Promise<{ serverName: string; tools: Tool[] }>} Object containing server name and tools array
   * @throws {Error} If the specified server is not found or not connected
   *
   * @example
   * ```typescript
   * const result = await hubToolsService.listAllToolsInServer('my-mcp-server');
   * console.log(`Server ${result.serverName} has ${result.tools.length} tools`);
   * ```
   */
  async listAllToolsInServer(
    serverName: string,
    requestOptions?: RequestOptions
  ): Promise<{
    serverName: string;
    tools: Tool[];
  }> {
    // Handle MCP Hub Lite server (return system tools list)
    if (typeof serverName === 'string' && serverName === MCP_HUB_LITE_SERVER) {
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
        serverName,
        tools
      };
    }

    const serverInfo = selectBestInstance(serverName, requestOptions);

    if (!serverInfo) {
      throw new Error(`Server not found: ${serverName}`);
    }

    // Get instance ID
    const serverId = serverInfo.instance.id;

    // Get tool list from connection manager
    const tools = mcpConnectionManager.getTools(serverId);

    return {
      serverName,
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
   * @param {string} serverName - Name of the MCP server to search tools in
   * @param {string} pattern - Regex pattern to search for in tool names and descriptions
   * @param {'name' | 'description' | 'both'} [searchIn='both'] - Where to perform the search
   * @param {boolean} [caseSensitive=false] - Whether the search should be case-sensitive
   * @param {RequestOptions} [requestOptions] - Optional request options for instance selection
   * @returns {Promise<{ serverName: string; tools: Tool[] }>} Object containing server name and matching tools
   * @throws {Error} If the specified server is not found or not connected
   *
   * @example
   * ```typescript
   * const result = await hubToolsService.findToolsInServer('my-mcp-server', 'list');
   * console.log(`Found ${result.tools.length} tools matching 'list'`);
   * ```
   */
  async findToolsInServer(
    serverName: string,
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false,
    requestOptions?: RequestOptions
  ): Promise<{
    serverName: string;
    tools: Tool[];
  }> {
    const serverInfo = selectBestInstance(serverName, requestOptions);

    if (!serverInfo) {
      throw new Error(`Server not found: ${serverName}`);
    }

    const tools = mcpConnectionManager.getTools(serverInfo.instance.id);
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    const matchingTools = tools.filter((tool) => {
      const matchName = searchIn !== 'description' && regex.test(tool.name);
      const matchDescription =
        searchIn !== 'name' && tool.description && regex.test(tool.description);
      return matchName || matchDescription;
    });

    return {
      serverName: serverName,
      tools: matchingTools
    };
  }

  /**
   * Retrieves the complete schema for a specific tool from a specific server.
   *
   * This method returns the full tool definition including name, description, input schema,
   * and any annotations. It's useful for clients that need detailed information about
   * a tool's capabilities and expected parameters before execution.
   *
   * @param {string} serverName - Name of the MCP server containing the tool
   * @param {string} toolName - Exact name of the tool to retrieve
   * @param {RequestOptions} [requestOptions] - Optional request options for instance selection
   * @returns {Promise<Tool | undefined>} Complete tool schema or undefined if not found
   * @throws {Error} If the specified server is not found or not connected
   *
   * @example
   * ```typescript
   * const tool = await hubToolsService.getTool('my-mcp-server', 'list-files');
   * if (tool) {
   *   console.log('Tool input schema:', tool.inputSchema);
   * }
   * ```
   */
  async getTool(
    serverName: string,
    toolName: string,
    requestOptions?: RequestOptions
  ): Promise<Tool | undefined> {
    const serverInfo = selectBestInstance(serverName, requestOptions);

    if (!serverInfo) {
      throw new Error(`Server not found: ${serverName}`);
    }

    const tools = mcpConnectionManager.getTools(serverInfo.instance.id);
    return tools.find((tool) => tool.name === toolName);
  }

  /**
   * Calls a specific system tool directly with type-safe conditional return types.
   *
   * This method provides a unified entry point for all system tool calls, using TypeScript's
   * conditional types to ensure type safety based on the tool name. It handles logging,
   * error handling, and delegates to the appropriate internal methods based on the tool name.
   *
   * The method supports all system tools with their specific parameter and return types:
   * - list-servers: returns string[]
   * - find-servers: returns string[]
   * - list-all-tools-in-server: returns { serverName: string; tools: Tool[] }
   * - find-tools-in-server: returns { serverName: string; tools: Tool[] }
   * - get-tool: returns Tool | undefined
   * - call-tool: returns unknown (tool-specific result)
   * - find-tools: returns Record<string, { tools: Tool[] }>
   *
   * @param {T} toolName - System tool name with generic type constraint
   * @param {SystemToolArgs} toolArgs - Type-safe arguments based on tool name
   * @returns {Promise<ConditionalReturnType>} Tool execution result with accurate type safety matching actual method return types
   * @throws {Error} If the system tool is not found or execution fails
   *
   * @example
   * ```typescript
   * // Type-safe system tool call
   * const servers = await hubToolsService.callSystemTool('list-servers', {});
   * const result = await hubToolsService.callSystemTool('call-tool', {
   *   serverName: 'my-server',
   *   toolName: 'list-files',
   *   toolArgs: { directory: '/home' }
   * });
   * ```
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
    logger.info(`System tool called: ${toolName}, args=${stringifyForLogging(toolArgs)}`, {
      subModule: 'HUB-TOOLS'
    });

    try {
      let result;
      switch (toolName) {
        case LIST_SERVERS_TOOL:
          result = await this.listServers();
          break;
        case FIND_SERVERS_TOOL: {
          const findServersArgs = toolArgs as FindServersParams;
          result = await this.findServers(
            findServersArgs.pattern,
            findServersArgs.searchIn,
            findServersArgs.caseSensitive
          );
          break;
        }
        case LIST_ALL_TOOLS_IN_SERVER_TOOL: {
          const listAllToolsArgs = toolArgs as ListAllToolsInServerParams;
          result = await this.listAllToolsInServer(
            listAllToolsArgs.serverName,
            listAllToolsArgs.requestOptions
          );
          break;
        }
        case FIND_TOOLS_IN_SERVER_TOOL: {
          const findToolsInServerArgs = toolArgs as FindToolsInServerParams;
          result = await this.findToolsInServer(
            findToolsInServerArgs.serverName,
            findToolsInServerArgs.pattern,
            findToolsInServerArgs.searchIn,
            findToolsInServerArgs.caseSensitive,
            findToolsInServerArgs.requestOptions
          );
          break;
        }
        case GET_TOOL_TOOL: {
          const getToolArgs = toolArgs as GetToolParams;
          result = await this.getTool(
            getToolArgs.serverName,
            getToolArgs.toolName,
            getToolArgs.requestOptions
          );
          break;
        }
        case CALL_TOOL_TOOL: {
          const callToolArgs = toolArgs as CallToolParams;
          let serverName = callToolArgs.serverName;
          if (!serverName || serverName === 'undefined') {
            serverName = MCP_HUB_LITE_SERVER;
          }
          result = await this.callTool(
            serverName,
            callToolArgs.toolName,
            callToolArgs.toolArgs,
            callToolArgs.requestOptions
          );
          break;
        }
        case FIND_TOOLS_TOOL: {
          const findToolsArgs = toolArgs as FindToolsParams;
          result = await this.findTools(
            findToolsArgs.pattern,
            findToolsArgs.searchIn,
            findToolsArgs.caseSensitive
          );
          break;
        }
        default:
          throw new Error(`System tool "${toolName}" not found`);
      }

      logger.info(`System tool SUCCESS: ${toolName}`, { subModule: 'HUB-TOOLS' });
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
        { subModule: 'HUB-TOOLS' }
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
   * @param {string} serverName - Name of the MCP server to call tool from
   * @param {string} toolName - Name of the tool to call
   * @param {Record<string, unknown>} toolArgs - Arguments to pass to the tool
   * @param {RequestOptions} [requestOptions] - Optional request options for instance selection
   * @returns {Promise<unknown>} Tool execution result as returned by the server
   * @throws {Error} If the server is not found, not connected, or tool execution fails
   *
   * @example
   * ```typescript
   * const result = await hubToolsService.callTool('my-mcp-server', 'list-files', {
   *   directory: '/home/user'
   * });
   * console.log('Tool result:', result);
   * ```
   */

  async callTool(
    serverName: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
    requestOptions?: RequestOptions
  ): Promise<unknown> {
    // Parse prefixed tool names (like mcp__mcp-hub-lite__xxx) if applicable
    const parsedTool = ToolArgsParser.parsePrefixedToolName(toolName);
    if (parsedTool) {
      logger.debug(
        `Parsed prefixed tool name: "${toolName}" → server="${parsedTool.serverName}", tool="${parsedTool.toolName}"`,
        { subModule: 'HUB-TOOLS' }
      );
      serverName = parsedTool.serverName;
      toolName = parsedTool.toolName;
    }

    // Handle MCP Hub Lite server (system tool call or find tool in all servers)
    if (typeof serverName === 'string' && serverName === MCP_HUB_LITE_SERVER) {
      // Check if it's a system tool
      if (SYSTEM_TOOL_NAMES.includes(toolName as SystemToolName)) {
        return await this.callSystemTool(toolName as SystemToolName, toolArgs as SystemToolArgs);
      }

      // Not a system tool - find it in all connected servers
      logger.info(
        `Looking for tool '${toolName}' in all connected servers (gateway mode)`,
        { subModule: 'HUB-TOOLS' }
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
          if (tools.some(tool => tool.name === toolName)) {
            matchingServers.push(server.name);
          }
        }
      }

      if (matchingServers.length === 0) {
        logger.error(`Tool '${toolName}' not found in any connected server`, { subModule: 'HUB-TOOLS' });
        throw new Error(`Tool '${toolName}' not found`);
      }

      if (matchingServers.length > 1) {
        logger.warn(
          `Tool '${toolName}' found in multiple servers: ${matchingServers.join(', ')}. Using first match.`,
          { subModule: 'HUB-TOOLS' }
        );
      }

      // Use the first matching server
      serverName = matchingServers[0];
    }

    logger.info(
      `Tool call received: serverName=${serverName}, toolName=${toolName}, args=${stringifyForLogging(toolArgs)}`,
      { subModule: 'HUB-TOOLS' }
    );

    const serverInfo = selectBestInstance(serverName, requestOptions);

    if (!serverInfo) {
      logger.error(`Server not found: ${serverName}`, { subModule: 'HUB-TOOLS' });
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

      logger.info(`Tool call SUCCESS: serverName=${serverName}, toolName=${toolName}`, {
        subModule: 'HUB-TOOLS'
      });
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
        { subModule: 'HUB-TOOLS' }
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
   *
   * @example
   * ```typescript
   * const allTools = await hubToolsService.listAllTools();
   * Object.entries(allTools).forEach(([serverName, { tools }]) => {
   *   console.log(`${serverName}: ${tools.length} tools`);
   * });
   * ```
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
   * @param {string} pattern - Regex pattern to search for in tool names and descriptions
   * @param {'name' | 'description' | 'both'} [searchIn='both'] - Where to perform the search
   * @param {boolean} [caseSensitive=false] - Whether the search should be case-sensitive
   * @returns {Promise<Record<string, { tools: Tool[] }>>} Object mapping server names to matching tools
   *
   * @example
   * ```typescript
   * const matchingTools = await hubToolsService.findTools('list');
   * Object.entries(matchingTools).forEach(([serverName, { tools }]) => {
   *   console.log(`${serverName}: ${tools.length} matching tools`);
   * });
   * ```
   */
  async findTools(
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false
  ): Promise<
    Record<
      string,
      {
        tools: Tool[];
      }
    >
  > {
    const allTools = await this.listAllTools();
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    const matchingTools: Record<string, { tools: Tool[] }> = {};

    for (const [serverName, serverData] of Object.entries(allTools)) {
      const filteredTools = serverData.tools.filter((tool) => {
        const matchName = searchIn !== 'description' && regex.test(tool.name);
        const matchDescription =
          searchIn !== 'name' && tool.description && regex.test(tool.description);
        return matchName || matchDescription;
      });

      if (filteredTools.length > 0) {
        matchingTools[serverName] = {
          tools: filteredTools
        };
      }
    }

    return matchingTools;
  }

  /**
   * Generates dynamic Hub resources based on currently connected MCP servers.
   *
   * This method creates virtual resources that represent the current state of connected
   * servers, including server metadata, available tools, and server resources. Each
   * resource has a unique URI following the hub://servers/{serverName}[/type] pattern.
   *
   * The generated resources include:
   * - Server metadata: hub://servers/{serverName}
   * - Tools list: hub://servers/{serverName}/tools
   * - Resources list: hub://servers/{serverName}/resources (only if server has resources)
   *
   * @returns {Resource[]} Array of dynamically generated MCP resource objects
   *
   * @example
   * ```typescript
   * const resources = hubToolsService.generateDynamicResources();
   * console.log(`Generated ${resources.length} dynamic resources`);
   * ```
   */
  private generateDynamicResources(): Resource[] {
    const resources: Resource[] = [];

    // Use the same access pattern as tools - directly access manager cache
    const servers = hubManager.getAllServers();

    for (const server of servers) {
      if (!hasValidId(server) || !server.config.enabled) {
        continue;
      }

      const bestInstance = selectBestInstance(server.name);
      if (!bestInstance || !bestInstance.instance.id) {
        continue;
      }

      const instanceId = bestInstance.instance.id;

      // Server metadata resource
      resources.push({
        uri: `hub://servers/${server.name}`,
        name: `Server: ${server.name}`,
        description: server.config.description || `Connected MCP server: ${server.name}`,
        mimeType: 'application/json',
        serverId: instanceId
      });

      // Tools resource - only add if server has tools
      const tools = mcpConnectionManager.getTools(instanceId);
      if (tools.length > 0) {
        resources.push({
          uri: `hub://servers/${server.name}/tools`,
          name: `Tools: ${server.name}`,
          description: `${tools.length} tools available from ${server.name}`,
          mimeType: 'application/json',
          serverId: instanceId
        });
      }

      // Resources resource - only add if server has resources
      const serverResources = mcpConnectionManager.getResources(instanceId);
      if (serverResources.length > 0) {
        resources.push({
          uri: `hub://servers/${server.name}/resources`,
          name: `Resources: ${server.name}`,
          description: `${serverResources.length} resources available from ${server.name}`,
          mimeType: 'application/json',
          serverId: instanceId
        });
      }
    }

    return resources;
  }

  /**
   * Lists all dynamically generated Hub resources based on connected MCP servers.
   *
   * This method returns an array of virtual resources that represent the current state
   * of connected servers, providing a unified interface for resource discovery and access.
   * The resources are generated on-demand based on the current server configuration.
   *
   * @returns {Promise<Resource[]>} Array of MCP resource objects representing Hub resources
   *
   * @example
   * ```typescript
   * const resources = await hubToolsService.listResources();
   * console.log(`Available Hub resources: ${resources.length}`);
   * ```
   */
  async listResources(): Promise<Resource[]> {
    if (this.generatedResourcesCache) {
      return this.generatedResourcesCache;
    }

    const resources = this.generateDynamicResources();
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
   * The method includes comprehensive validation of URI format and server existence,
   * throwing descriptive errors for invalid requests.
   *
   * @param {string} uri - Resource URI to read (e.g., hub://servers/server-name)
   * @returns {Promise<ServerMetadata | Tool[] | Resource[]>} Resource content based on URI type
   * @throws {Error} If URI format is invalid, server not found, or resource type unknown
   *
   * @example
   * ```typescript
   * // Read server metadata
   * const serverInfo = await hubToolsService.readResource('hub://servers/my-mcp-server');
   *
   * // Read tools list
   * const tools = await hubToolsService.readResource('hub://servers/my-mcp-server/tools');
   * ```
   */
  async readResource(uri: string): Promise<
    | {
        name: string;
        status: ServerStatus;
        toolsCount: number;
        resourcesCount: number;
        tags: Record<string, string>;
        lastHeartbeat: number;
        uptime: number;
      }
    | Tool[]
    | Resource[]
  > {
    // Validate URI format
    if (!uri.startsWith('hub://')) {
      throw new Error(`Invalid Hub resource URI: ${uri}. Must start with 'hub://'`);
    }

    // Parse URI
    const uriParts = uri.replace('hub://', '').split('/');
    if (uriParts.length < 2 || uriParts[0] !== 'servers') {
      throw new Error(`Invalid Hub resource URI format: ${uri}`);
    }

    const serverName = uriParts[1];
    const resourceType = uriParts[2]; // 'tools', 'resources', or undefined for server metadata

    // Check if server exists and is connected
    const serverInfo = selectBestInstance(serverName);
    if (!serverInfo) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    const instanceId = serverInfo.instance.id;

    // Return appropriate content based on resource type
    if (!resourceType) {
      // Server metadata
      const serverConfig = hubManager.getServerByName(serverName);
      const tools = mcpConnectionManager.getTools(instanceId);
      const resources = mcpConnectionManager.getResources(instanceId);

      return {
        name: serverName,
        status: serverInfo.instance.status as ServerStatus,
        toolsCount: tools.length,
        resourcesCount: resources.length,
        tags: serverConfig?.tags || {},
        lastHeartbeat: serverInfo.instance.lastHeartbeat as number,
        uptime: serverInfo.instance.uptime as number
      };
    } else if (resourceType === 'tools') {
      // Tools list
      return mcpConnectionManager.getTools(instanceId);
    } else if (resourceType === 'resources') {
      // Resources list
      return mcpConnectionManager.getResources(instanceId);
    } else {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }
  }
}

export const hubToolsService = new HubToolsService();
