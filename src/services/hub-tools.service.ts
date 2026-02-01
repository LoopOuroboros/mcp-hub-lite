import { hubManager } from './hub-manager.service.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { McpTool } from '@models/tool.model.js';
import type { McpServerConfig } from '@config/config.schema.js';
import { eventBus, EventTypes } from './event-bus.service.js';
import { gateway } from './gateway.service.js';
import { logger } from '@utils/logger.js';
import {
  SYSTEM_TOOL_NAMES,
  SystemToolName,
  LIST_SERVERS_TOOL,
  FIND_SERVERS_TOOL,
  LIST_ALL_TOOLS_IN_SERVER_TOOL,
  FIND_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  FIND_TOOLS_TOOL,
  MCP_HUB_LITE_SERVER
} from '@models/system-tools.constants.js';

// 请求选项接口
interface RequestOptions {
  sessionId?: string;  // 会话 ID（用于选择特定实例）
  tags?: Record<string, string>;  // 标签（后续支持）
  // 未来可能添加的选项
  // clientId?: string;  // 客户端 ID（用于选择专属实例）
}

// 根据服务器名称和请求选项选择最佳实例
function selectBestInstance(serverName: string, requestOptions?: RequestOptions): {
  name: string;
  config: McpServerConfig;
  instance: any;
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
function hasValidId(server: any): server is { name: string; config: McpServerConfig } {
  return typeof server.name === 'string' && server.name.length > 0 && typeof server.config === 'object';
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
      inputSchema: any;
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
    tools: McpTool[];
  }> {
    // 处理 MCP Hub Lite 服务器（返回系统工具列表）
    if (typeof serverName === 'string' && serverName === MCP_HUB_LITE_SERVER) {
      // 使用与 tools/list 相同的逻辑生成工具列表
      const toolMap = new Map<string, { serverId: string; realToolName: string }>();
      const gatewayTools = gateway.generateGatewayToolsList(toolMap);

      // 转换为 McpTool 格式
      const tools: McpTool[] = gatewayTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        serverName: MCP_HUB_LITE_SERVER
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
    tools: McpTool[];
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
  async getTool(serverName: string, toolName: string, requestOptions?: RequestOptions): Promise<McpTool | undefined> {
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
  async callSystemTool(toolName: SystemToolName, toolArgs: Record<string, unknown>): Promise<any> {
    logger.info(`[HUB-TOOLS] System tool called: ${toolName}, args=${JSON.stringify(toolArgs)}`);

    try {
      let result;
      switch (toolName) {
        case LIST_SERVERS_TOOL:
          result = await this.listServers();
          break;
        case FIND_SERVERS_TOOL:
          result = await this.findServers(
            toolArgs.pattern as string,
            toolArgs.searchIn as 'name' | 'description' | 'both',
            toolArgs.caseSensitive as boolean
          );
          break;
        case LIST_ALL_TOOLS_IN_SERVER_TOOL:
          result = await this.listAllToolsInServer(toolArgs.serverName as string, toolArgs.requestOptions as RequestOptions);
          break;
        case FIND_TOOLS_IN_SERVER_TOOL:
          result = await this.findToolsInServer(
            toolArgs.serverName as string,
            toolArgs.pattern as string,
            toolArgs.searchIn as 'name' | 'description' | 'both',
            toolArgs.caseSensitive as boolean,
            toolArgs.requestOptions as RequestOptions
          );
          break;
        case GET_TOOL_TOOL:
          result = await this.getTool(toolArgs.serverName as string, toolArgs.toolName as string, toolArgs.requestOptions as RequestOptions);
          break;
        case CALL_TOOL_TOOL:
          // Handle nested call-tool calls
          // If serverName is undefined or "undefined", default to mcp-hub-lite for system tools
          let serverName = toolArgs.serverName as string;
          if (!serverName || serverName === 'undefined') {
            serverName = MCP_HUB_LITE_SERVER;
          }
          result = await this.callTool(
            serverName,
            toolArgs.toolName as string,
            toolArgs.toolArgs as Record<string, unknown>,
            toolArgs.requestOptions as RequestOptions
          );
          break;
        case FIND_TOOLS_TOOL:
          result = await this.findTools(
            toolArgs.pattern as string,
            toolArgs.searchIn as 'name' | 'description' | 'both',
            toolArgs.caseSensitive as boolean
          );
          break;
        default:
          throw new Error(`System tool "${toolName}" not found`);
      }

      logger.info(`[HUB-TOOLS] System tool SUCCESS: ${toolName}`);
      return result;
    } catch (error) {
      logger.error(`[HUB-TOOLS] System tool FAILED: ${toolName}, error=${error instanceof Error ? error.message : String(error)}`, error);
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
  async callTool(serverName: string, toolName: string, toolArgs: Record<string, unknown>, requestOptions?: RequestOptions): Promise<any> {
    // 处理 MCP Hub Lite 服务器（系统工具调用）
    if (typeof serverName === 'string' && serverName === MCP_HUB_LITE_SERVER) {
      return await this.callSystemTool(toolName as SystemToolName, toolArgs);
    }

    logger.info(`[HUB-TOOLS] Tool call received: serverName=${serverName}, toolName=${toolName}, args=${JSON.stringify(toolArgs)}`);

    const serverInfo = selectBestInstance(serverName, requestOptions);

    if (!serverInfo) {
      logger.error(`[HUB-TOOLS] Server not found: ${serverName}`);
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

      logger.info(`[HUB-TOOLS] Tool call SUCCESS: serverName=${serverName}, toolName=${toolName}`);
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

      logger.error(`[HUB-TOOLS] Tool call FAILED: serverName=${serverName}, toolName=${toolName}, error=${error instanceof Error ? error.message : String(error)}`, error);
      throw error;
    }
  }

  /**
   * List all available tools from all connected servers including system tools
   * @returns All tools grouped by server name
   */
  async listAllTools(): Promise<Record<string, {
    tools: McpTool[];
  }>> {
    const servers = hubManager.getAllServers();
    const allTools: Record<string, { tools: McpTool[] }> = {};

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
    tools: McpTool[];
  }>> {
    const allTools = await this.listAllTools();
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    const matchingTools: Record<string, { tools: McpTool[] }> = {};

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

}

export const hubToolsService = new HubToolsService();
