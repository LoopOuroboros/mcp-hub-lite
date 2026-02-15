import { hubManager } from './hub-manager.service.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import type { JsonSchema } from '@shared-models/tool.model.js';
import type { ServerConfig, ServerInstanceConfig } from '@config/config.schema.js';
import type { Tool } from '@shared-models/tool.model.js';
import type { Resource } from '@shared-models/resource.model.js';
import type { ServerStatus } from '@shared-types/common.types.js';
import type { ServerTransport } from '@shared-types/common.types.js';
import { eventBus, EventTypes } from './event-bus.service.js';
import { gateway } from './gateway.service.js';
import { logger } from '@utils/logger.js';
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

// 请求选项接口
export interface RequestOptions {
  sessionId?: string;  // 会话 ID（用于选择特定实例）
  tags?: Record<string, string>;  // 标签（后续支持）
  // 未来可能添加的选项
  // clientId?: string;  // 客户端 ID（用于选择专属实例）
}

// 根据服务器名称和请求选项选择最佳实例
function selectBestInstance(serverName: string, requestOptions?: RequestOptions): {
  name: string;
  config: ServerConfig;
  instance: ServerInstanceConfig & Record<string, unknown>;
} | undefined {
  // 获取服务器的所有实例
  const instances = hubManager.getServerInstanceByName(serverName);

  if (instances.length === 0) {
    return undefined;
  }

  // 获取服务器配置
  const serverConfig = hubManager.getServerByName(serverName);
  if (!serverConfig) {
    return undefined;
  }

  // 如果只有一个实例，直接返回
  if (instances.length === 1) {
    return {
      name: serverName,
      config: serverConfig,
      instance: instances[0]
    };
  }

  // 多实例选择逻辑（未来扩展）
  // 目前简化实现：返回第一个实例
  // 未来可扩展支持：
  // - 根据 sessionId 选择特定实例
  // - 根据 tags 匹配选择最优实例
  // - 根据客户端 ID 选择专属实例
  // - 根据负载情况选择实例

  // 目前虽然 requestOptions 未被使用，但保留以便未来扩展
  if (requestOptions?.sessionId) {
    // 未来可以根据 sessionId 选择特定实例
    // 目前暂时返回第一个实例
  }

  if (requestOptions?.tags) {
    // 未来可以根据 tags 匹配选择最优实例
    // 目前暂时返回第一个实例
  }

  return {
    name: serverName,
    config: serverConfig,
    instance: instances[0]  // 后续扩展为智能选择逻辑
  };
}

// Type guard for servers with valid name and config
function hasValidId(server: unknown): server is { name: string; config: ServerConfig } {
  if (typeof server !== 'object' || server === null) {
    return false;
  }
  const s = server as { name?: unknown; config?: unknown };
  return typeof s.name === 'string' && s.name.length > 0 && typeof s.config === 'object';
}

export class HubToolsService {
  /**
   * Get list of system tools provided by this service
   */
  /**
   * Get system tools configuration based on SYSTEM_TOOL_NAMES constant
   * This ensures consistency with the system tool names defined in constants
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
                searchIn: { type: 'string', enum: ['name', 'description', 'both'], default: 'both' },
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
                searchIn: { type: 'string', enum: ['name', 'description', 'both'], default: 'both' },
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
                searchIn: { type: 'string', enum: ['name', 'description', 'both'], default: 'both' },
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
   * List all connected servers
   * @returns Array of server names only
   */
  async listServers(): Promise<string[]> {
    const servers = hubManager.getAllServers();
    return servers.filter(hasValidId).map(server => server.name);
  }

  /**
   * Find servers matching a pattern
   * @param pattern Regex pattern to search for in server names and descriptions
   * @param searchIn Where to search: 'name', 'description', or 'both' (default: 'both')
   * @param caseSensitive Whether the search should be case-sensitive (default: false)
   * @returns Array of matching server names only
   */
  async findServers(
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false
  ): Promise<string[]> {
    const allServers = hubManager.getAllServers();
    const validServers = allServers.filter(hasValidId);
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    return validServers.filter(server => {
      const matchName = searchIn !== 'description' && regex.test(server.name);
      const matchDescription = searchIn !== 'name' && server.name && regex.test(server.name); // Using name as fallback if no description
      return matchName || matchDescription;
    }).map(server => server.name);
  }

  /**
   * List all tools from a specific server
   * @param serverName Name of the MCP server to list tools from
   * @returns List of tools from the specified server
   */
  async listAllToolsInServer(serverName: string, requestOptions?: RequestOptions): Promise<{
    serverName: string;
    tools: Tool[];
  }> {
    // 处理 MCP Hub Lite 服务器（返回系统工具列表）
    if (typeof serverName === 'string' && serverName === MCP_HUB_LITE_SERVER) {
      // 使用与 tools/list 相同的逻辑生成工具列表
      const toolMap = new Map<string, { serverId: string; realToolName: string }>();
      const gatewayTools = gateway.generateGatewayToolsList(toolMap);

      // 转换为 Tool 格式
      const tools: Tool[] = gatewayTools.map(tool => ({
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

    // 获取实例的 ID
    const serverId = serverInfo.instance.id;

    // 从连接管理器获取工具列表
    const tools = mcpConnectionManager.getTools(serverId);

    return {
      serverName,
      tools
    };
  }

  /**
   * Find tools matching a pattern in a specific server
   * @param serverName Name of the MCP server to search tools in
   * @param pattern Regex pattern to search for in tool names and descriptions
   * @param searchIn Where to search: 'name', 'description', or 'both' (default: 'both')
   * @param caseSensitive Whether the search should be case-sensitive (default: false)
   * @param requestOptions Request options for instance selection
   * @returns List of matching tools in the specified server
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

    const matchingTools = tools.filter(tool => {
      const matchName = searchIn !== 'description' && regex.test(tool.name);
      const matchDescription = searchIn !== 'name' && tool.description && regex.test(tool.description);
      return matchName || matchDescription;
    });

    return {
      serverName: serverName,
      tools: matchingTools
    };
  }

  /**
   * Get complete schema for a specific tool from a specific server, including inputSchema
   * @param serverName Name of the MCP server containing the tool
   * @param toolName Exact name of the tool to retrieve
   * @param requestOptions Request options for instance selection
   * @returns Complete tool schema
   */
  async getTool(serverName: string, toolName: string, requestOptions?: RequestOptions): Promise<Tool | undefined> {
    const serverInfo = selectBestInstance(serverName, requestOptions);

    if (!serverInfo) {
      throw new Error(`Server not found: ${serverName}`);
    }

    const tools = mcpConnectionManager.getTools(serverInfo.instance.id);
    return tools.find(tool => tool.name === toolName);
  }

  /**
   * Call a specific system tool directly
   * @param toolName Name of the system tool to call
   * @param toolArgs Arguments to pass to the tool
   * @returns Result of the system tool call
   */
  async callSystemTool<T extends SystemToolName>(
    toolName: T,
    toolArgs: T extends typeof LIST_SERVERS_TOOL ? ListServersParams :
              T extends typeof FIND_SERVERS_TOOL ? FindServersParams :
              T extends typeof LIST_ALL_TOOLS_IN_SERVER_TOOL ? ListAllToolsInServerParams :
              T extends typeof FIND_TOOLS_IN_SERVER_TOOL ? FindToolsInServerParams :
              T extends typeof GET_TOOL_TOOL ? GetToolParams :
              T extends typeof CALL_TOOL_TOOL ? CallToolParams :
              T extends typeof FIND_TOOLS_TOOL ? FindToolsParams :
              never
  ): Promise<
    T extends typeof LIST_SERVERS_TOOL ? ServerConfig[] :
    T extends typeof FIND_SERVERS_TOOL ? ServerConfig[] :
    T extends typeof LIST_ALL_TOOLS_IN_SERVER_TOOL ? Tool[] :
    T extends typeof FIND_TOOLS_IN_SERVER_TOOL ? Tool[] :
    T extends typeof GET_TOOL_TOOL ? Tool | undefined :
    T extends typeof CALL_TOOL_TOOL ? unknown :
    T extends typeof FIND_TOOLS_TOOL ? Tool[] :
    never
  > {
    logger.info(`System tool called: ${toolName}, args=${JSON.stringify(toolArgs)}`, { subModule: 'HUB-TOOLS' });

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
          result = await this.listAllToolsInServer(listAllToolsArgs.serverName, listAllToolsArgs.requestOptions);
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
          result = await this.getTool(getToolArgs.serverName, getToolArgs.toolName, getToolArgs.requestOptions);
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
      return result as T extends typeof LIST_SERVERS_TOOL ? ServerConfig[] :
        T extends typeof FIND_SERVERS_TOOL ? ServerConfig[] :
        T extends typeof LIST_ALL_TOOLS_IN_SERVER_TOOL ? Tool[] :
        T extends typeof FIND_TOOLS_IN_SERVER_TOOL ? Tool[] :
        T extends typeof GET_TOOL_TOOL ? Tool | undefined :
        T extends typeof CALL_TOOL_TOOL ? unknown :
        T extends typeof FIND_TOOLS_TOOL ? Tool[] :
        never;
    } catch (error) {
      logger.error(`System tool FAILED: ${toolName}, error=${error instanceof Error ? error.message : String(error)}`, error, { subModule: 'HUB-TOOLS' });
      throw error;
    }
  }

  /**
   * Call a specific tool from a specific server
   * @param serverName Name of the MCP server to call tool from
   * @param toolName Name of the tool to call
   * @param toolArgs Arguments to pass to the tool
   * @returns Result of the tool call
   */
  async callTool(serverName: string, toolName: string, toolArgs: Record<string, unknown>, requestOptions?: RequestOptions): Promise<unknown> {
    // 处理 MCP Hub Lite 服务器（系统工具调用）
    if (typeof serverName === 'string' && serverName === MCP_HUB_LITE_SERVER) {
      return await this.callSystemTool(toolName as SystemToolName, toolArgs as SystemToolArgs);
    }

    logger.info(`Tool call received: serverName=${serverName}, toolName=${toolName}, args=${JSON.stringify(toolArgs)}`, { subModule: 'HUB-TOOLS' });

    const serverInfo = selectBestInstance(serverName, requestOptions);

    if (!serverInfo) {
      logger.error(`Server not found: ${serverName}`, { subModule: 'HUB-TOOLS' });
      throw new Error(`Server not found: ${serverName}`);
    }

    const serverId = serverInfo.instance.id;
    const requestId = `tool-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 发布工具调用开始事件
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

      // 发布工具调用完成事件
      eventBus.publish(EventTypes.TOOL_CALL_COMPLETED, {
        requestId,
        serverId,
        serverName,
        toolName,
        timestamp: Date.now(),
        result
      });

      logger.info(`Tool call SUCCESS: serverName=${serverName}, toolName=${toolName}`, { subModule: 'HUB-TOOLS' });
      return result;
    } catch (error) {
      // 发布工具调用错误事件
      eventBus.publish(EventTypes.TOOL_CALL_ERROR, {
        requestId,
        serverId,
        serverName,
        toolName,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      logger.error(`Tool call FAILED: serverName=${serverName}, toolName=${toolName}, error=${error instanceof Error ? error.message : String(error)}`, error, { subModule: 'HUB-TOOLS' });
      throw error;
    }
  }

  /**
   * List all available tools from all connected servers including system tools
   * @returns All tools grouped by server name
   */
  async listAllTools(): Promise<Record<string, {
    tools: Tool[];
  }>> {
    const servers = hubManager.getAllServers();
    const allTools: Record<string, { tools: Tool[] }> = {};

    // Add system tools under mcp-hub-lite server
    const systemTools = this.getSystemTools().map(tool => ({
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
   * Find tools matching a pattern across all connected servers
   * @param pattern Regex pattern to search for in tool names and descriptions
   * @param searchIn Where to search: 'name', 'description', or 'both' (default: 'both')
   * @param caseSensitive Whether the search should be case-sensitive (default: false)
   * @returns Matching tools grouped by server name
   */
  async findTools(
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false
  ): Promise<Record<string, {
    tools: Tool[];
  }>> {
    const allTools = await this.listAllTools();
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    const matchingTools: Record<string, { tools: Tool[] }> = {};

    for (const [serverName, serverData] of Object.entries(allTools)) {
      const filteredTools = serverData.tools.filter(tool => {
        const matchName = searchIn !== 'description' && regex.test(tool.name);
        const matchDescription = searchIn !== 'name' && tool.description && regex.test(tool.description);
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
   * Generate dynamic Hub resources based on connected servers
   * @returns Array of dynamically generated McpResource objects
   */
  private generateDynamicResources(): Resource[] {
    const resources: Resource[] = [];

    // Get all connected servers
    const servers = hubManager.getAllServers();

    for (const server of servers) {
      if (!hasValidId(server)) {
        continue;
      }

      // Use selectBestInstance to choose the best instance (currently returns first instance)
      const bestInstance = selectBestInstance(server.name);
      if (!bestInstance || !bestInstance.instance.id) {
        continue;
      }

      const instanceId = bestInstance.instance.id;

      // Server metadata resource
      resources.push({
        uri: `hub://servers/${server.name}`,
        name: `Server: ${server.name}`,
        description: `Connected MCP server: ${server.name}`,
        mimeType: 'application/json',
        serverId: instanceId
      });

      // Tools resource
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
   * List all Hub resources (dynamically generated based on connected servers)
   * @returns Array of McpResource objects representing Hub resources
   */
  async listResources(): Promise<Resource[]> {
    return this.generateDynamicResources();
  }

  /**
   * Read content from a specific Hub resource URI
   * @param uri Resource URI to read (e.g., hub://servers/server-name)
   * @returns Resource content as JSON string or object
   */
  async readResource(uri: string): Promise<{ name: string; status: ServerStatus; toolsCount: number; resourcesCount: number; tags: Record<string, string>; lastHeartbeat: number; uptime: number; type: ServerTransport; enabled: boolean } | Tool[] | Resource[]> {
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
        uptime: serverInfo.instance.uptime as number,
        type: (serverConfig?.type || 'unknown') as ServerTransport,
        enabled: serverConfig?.enabled || false
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
