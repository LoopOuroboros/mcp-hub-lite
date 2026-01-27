import { hubManager } from './hub-manager.service.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { McpTool } from '../models/tool.model.js';
import type { McpServerConfig } from '../config/config.schema.js';
import { eventBus, EventTypes } from './event-bus.service.js';

// Type guard for servers with valid name and config
function hasValidId(server: any): server is { name: string; config: McpServerConfig } {
  return typeof server.name === 'string' && server.name.length > 0 && typeof server.config === 'object';
}

export class HubToolsService {
  /**
   * Get list of system tools provided by this service
   */
  getSystemTools() {
    return [
      {
        name: 'list-servers',
        description: 'List all connected servers',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'find-servers',
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
      },
      {
        name: 'list-all-tools-in-server',
        description: 'List all tools from a specific server',
        inputSchema: {
          type: 'object',
          properties: {
            serverName: { type: 'string', description: 'Name of the MCP server' }
          },
          required: ['serverName']
        }
      },
      {
        name: 'find-tools-in-server',
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
      },
      {
        name: 'get-tool',
        description: 'Get complete schema for a specific tool from a specific server',
        inputSchema: {
          type: 'object',
          properties: {
            serverName: { type: 'string', description: 'Name of the MCP server' },
            toolName: { type: 'string', description: 'Exact name of the tool' }
          },
          required: ['serverName', 'toolName']
        }
      },
      {
        name: 'call-tool',
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
      },
      {
        name: 'find-tools',
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
      }
    ];
  }

  /**
   * List all connected servers
   * @returns List of servers with basic information
   */
  async listServers(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    connected: boolean;
    toolsCount: number;
    version?: string;
  }>> {
    const servers = hubManager.getAllServers();
    return servers.filter(hasValidId).flatMap(server => {
      const instances = hubManager.getServerInstanceByName(server.name);
      return instances.map(instance => {
        const status = mcpConnectionManager.getStatus(instance.id);
        return {
          id: instance.id,
          name: server.name,
          type: server.config.type || 'stdio',
          connected: status?.connected ?? false,
          toolsCount: status?.toolsCount ?? 0,
          version: status?.version
        };
      });
    });
  }

  /**
   * Find servers matching a pattern
   * @param pattern Regex pattern to search for in server names and descriptions
   * @param searchIn Where to search: 'name', 'description', or 'both' (default: 'both')
   * @param caseSensitive Whether the search should be case-sensitive (default: false)
   * @returns List of matching servers
   */
  async findServers(
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false
  ): Promise<Array<{
    id: string;
    name: string;
    type: string;
    connected: boolean;
    toolsCount: number;
    version?: string;
  }>> {
    const servers = await this.listServers();
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    return servers.filter(server => {
      const matchName = searchIn !== 'description' && regex.test(server.name);
      const matchDescription = searchIn !== 'name' && server.name && regex.test(server.name); // Using name as fallback if no description
      return matchName || matchDescription;
    });
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
   * Call a specific tool from a specific server
   * @param serverName Name of the MCP server to call tool from
   * @param toolName Name of the tool to call
   * @param toolArgs Arguments to pass to the tool
   * @returns Result of the tool call
   */
  async callTool(serverName: string, toolName: string, toolArgs: Record<string, unknown>): Promise<any> {
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
   * List all available tools from all connected servers
   * @returns All tools grouped by server name
   */
  async listAllTools(): Promise<Record<string, {
    tools: McpTool[];
  }>> {
    const servers = hubManager.getAllServers();
    const allTools: Record<string, { tools: McpTool[] }> = {};

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
