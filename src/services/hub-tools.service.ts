import { hubManager } from './hub-manager.service.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { McpTool } from '../models/tool.model.js';
import type { McpServerConfig } from '../config/config.schema.js';
import { eventBus, EventTypes } from './event-bus.service.js';
import { gateway } from './gateway.service.js';
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
} from '../models/system-tools.constants.js';

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
                serverName: { type: 'string', description: 'Name of the MCP server' }
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
                caseSensitive: { type: 'boolean', default: false }
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
                toolName: { type: 'string', description: 'Exact name of the tool' }
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
                toolArgs: { type: 'object', description: 'Arguments to pass to the tool' }
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
  async listAllToolsInServer(serverName: string): Promise<{
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
        serverId: MCP_HUB_LITE_SERVER
      }));

      return {
        serverName,
        tools
      };
    }

    const instances = hubManager.getServerInstanceByName(serverName);

    if (instances.length === 0) {
      throw new Error(`Server with name "${serverName}" not found`);
    }

    // 取第一个实例的 ID
    const serverId = instances[0].id;
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
   * @returns List of matching tools in the specified server
   */
  async findToolsInServer(
    serverName: string,
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false
  ): Promise<{
    serverName: string;
    tools: McpTool[];
  }> {
    const serverTools = await this.listAllToolsInServer(serverName);
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    const matchingTools = serverTools.tools.filter(tool => {
      const matchName = searchIn !== 'description' && regex.test(tool.name);
      const matchDescription = searchIn !== 'name' && tool.description && regex.test(tool.description);
      return matchName || matchDescription;
    });

    return {
      ...serverTools,
      tools: matchingTools
    };
  }

  /**
   * Get complete schema for a specific tool from a specific server, including inputSchema
   * @param serverName Name of the MCP server containing the tool
   * @param toolName Exact name of the tool to retrieve
   * @returns Complete tool schema
   */
  async getTool(serverName: string, toolName: string): Promise<McpTool | undefined> {
    const serverTools = await this.listAllToolsInServer(serverName);
    return serverTools.tools.find(tool => tool.name === toolName);
  }

  /**
   * Call a specific system tool directly
   * @param toolName Name of the system tool to call
   * @param toolArgs Arguments to pass to the tool
   * @returns Result of the system tool call
   */
  async callSystemTool(toolName: SystemToolName, toolArgs: Record<string, unknown>): Promise<any> {
    switch (toolName) {
      case LIST_SERVERS_TOOL:
        return await this.listServers();
      case FIND_SERVERS_TOOL:
        return await this.findServers(
          toolArgs.pattern as string,
          toolArgs.searchIn as 'name' | 'description' | 'both',
          toolArgs.caseSensitive as boolean
        );
      case LIST_ALL_TOOLS_IN_SERVER_TOOL:
        return await this.listAllToolsInServer(toolArgs.serverName as string);
      case FIND_TOOLS_IN_SERVER_TOOL:
        return await this.findToolsInServer(
          toolArgs.serverName as string,
          toolArgs.pattern as string,
          toolArgs.searchIn as 'name' | 'description' | 'both',
          toolArgs.caseSensitive as boolean
        );
      case GET_TOOL_TOOL:
        return await this.getTool(toolArgs.serverName as string, toolArgs.toolName as string);
      case CALL_TOOL_TOOL:
        // Handle nested call-tool calls
        // If serverName is undefined or "undefined", default to mcp-hub-lite for system tools
        let serverName = toolArgs.serverName as string;
        if (!serverName || serverName === 'undefined') {
          serverName = MCP_HUB_LITE_SERVER;
        }
        return await this.callTool(
          serverName,
          toolArgs.toolName as string,
          toolArgs.toolArgs as Record<string, unknown>
        );
      case FIND_TOOLS_TOOL:
        return await this.findTools(
          toolArgs.pattern as string,
          toolArgs.searchIn as 'name' | 'description' | 'both',
          toolArgs.caseSensitive as boolean
        );
      default:
        throw new Error(`System tool "${toolName}" not found`);
    }
  }

  /**
   * Call a specific tool from a specific server
   * @param serverName Name of the MCP server to call tool from
   * @param toolName Name of the tool to call
   * @param toolArgs Arguments to pass to the tool
   * @returns Result of the tool call
   */
  async callTool(serverName: string, toolName: string, toolArgs: Record<string, unknown>): Promise<any> {
    // 处理 MCP Hub Lite 服务器（系统工具调用）
    if (typeof serverName === 'string' && serverName === MCP_HUB_LITE_SERVER) {
      return await this.callSystemTool(toolName as SystemToolName, toolArgs);
    }

    const instances = hubManager.getServerInstanceByName(serverName);

    if (instances.length === 0) {
      throw new Error(`Server with name "${serverName}" not found`);
    }

    const serverId = instances[0].id;
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
      serverId: MCP_HUB_LITE_SERVER,
      description: `[System] ${tool.description}`
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
