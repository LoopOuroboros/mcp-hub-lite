import { hubManager } from './hub-manager.service.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { McpTool } from '../models/tool.model.js';
import type { McpServerConfig } from '../config/config.schema.js';

// Type guard for servers with valid ID
function hasValidId(server: McpServerConfig): server is McpServerConfig & { id: string } {
  return typeof server.id === 'string' && server.id.length > 0;
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
            serverId: { type: 'string', description: 'ID of the MCP server' }
          },
          required: ['serverId']
        }
      },
      {
        name: 'find-tools-in-server',
        description: 'Find tools matching a pattern in a specific server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: { type: 'string', description: 'ID of the MCP server' },
            pattern: { type: 'string', description: 'Regex pattern to search for' },
            searchIn: { type: 'string', enum: ['name', 'description', 'both'], default: 'both' },
            caseSensitive: { type: 'boolean', default: false }
          },
          required: ['serverId', 'pattern']
        }
      },
      {
        name: 'get-tool',
        description: 'Get complete schema for a specific tool from a specific server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: { type: 'string', description: 'ID of the MCP server' },
            toolName: { type: 'string', description: 'Exact name of the tool' }
          },
          required: ['serverId', 'toolName']
        }
      },
      {
        name: 'call-tool',
        description: 'Call a specific tool from a specific server',
        inputSchema: {
          type: 'object',
          properties: {
            serverId: { type: 'string', description: 'ID of the MCP server' },
            toolName: { type: 'string', description: 'Name of the tool to call' },
            toolArgs: { type: 'object', description: 'Arguments to pass to the tool' }
          },
          required: ['serverId', 'toolName', 'toolArgs']
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
    return servers.filter(hasValidId).map(server => {
      const status = mcpConnectionManager.getStatus(server.id);
      return {
        id: server.id,
        name: server.name,
        type: server.type,
        connected: status?.connected ?? false,
        toolsCount: status?.toolsCount ?? 0,
        version: status?.version
      };
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
   * @param serverId ID of the MCP server to list tools from
   * @returns List of tools from the specified server
   */
  async listAllToolsInServer(serverId: string): Promise<{
    serverName: string;
    serverId: string;
    tools: McpTool[];
  }> {
    const server = hubManager.getServerById(serverId);

    if (!server) {
      throw new Error(`Server with ID "${serverId}" not found`);
    }

    const tools = mcpConnectionManager.getTools(serverId);

    return {
      serverName: server.name,
      serverId,
      tools
    };
  }

  /**
   * Find tools matching a pattern in a specific server
   * @param serverId ID of the MCP server to search tools in
   * @param pattern Regex pattern to search for in tool names and descriptions
   * @param searchIn Where to search: 'name', 'description', or 'both' (default: 'both')
   * @param caseSensitive Whether the search should be case-sensitive (default: false)
   * @returns List of matching tools in the specified server
   */
  async findToolsInServer(
    serverId: string,
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false
  ): Promise<{
    serverName: string;
    serverId: string;
    tools: McpTool[];
  }> {
    const serverTools = await this.listAllToolsInServer(serverId);
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
   * @param serverId ID of the MCP server containing the tool
   * @param toolName Exact name of the tool to retrieve
   * @returns Complete tool schema
   */
  async getTool(serverId: string, toolName: string): Promise<McpTool | undefined> {
    const serverTools = await this.listAllToolsInServer(serverId);
    return serverTools.tools.find(tool => tool.name === toolName);
  }

  /**
   * Call a specific tool from a specific server
   * @param serverId ID of the MCP server to call tool from
   * @param toolName Name of the tool to call
   * @param toolArgs Arguments to pass to the tool
   * @returns Result of the tool call
   */
  async callTool(serverId: string, toolName: string, toolArgs: Record<string, unknown>): Promise<any> {
    const server = hubManager.getServerById(serverId);

    if (!server) {
      throw new Error(`Server with ID "${serverId}" not found`);
    }

    const result = await mcpConnectionManager.callTool(serverId, toolName, toolArgs);
    return result;
  }

  /**
   * List all available tools from all connected servers
   * @returns All tools grouped by server
   */
  async listAllTools(): Promise<Record<string, {
    serverId: string;
    tools: McpTool[];
  }>> {
    const servers = hubManager.getAllServers();
    const allTools: Record<string, { serverId: string; tools: McpTool[] }> = {};

    for (const server of servers) {
      if (!hasValidId(server)) {
        continue;
      }
      const tools = mcpConnectionManager.getTools(server.id);
      allTools[server.id] = {
        serverId: server.id,
        tools
      };
    }

    return allTools;
  }

  /**
   * Find tools matching a pattern across all connected servers
   * @param pattern Regex pattern to search for in tool names and descriptions
   * @param searchIn Where to search: 'name', 'description', or 'both' (default: 'both')
   * @param caseSensitive Whether the search should be case-sensitive (default: false)
   * @returns Matching tools grouped by server
   */
  async findTools(
    pattern: string,
    searchIn: 'name' | 'description' | 'both' = 'both',
    caseSensitive: boolean = false
  ): Promise<Record<string, {
    serverId: string;
    tools: McpTool[];
  }>> {
    const allTools = await this.listAllTools();
    const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

    const matchingTools: Record<string, { serverId: string; tools: McpTool[] }> = {};

    for (const [serverId, serverData] of Object.entries(allTools)) {
      const filteredTools = serverData.tools.filter(tool => {
        const matchName = searchIn !== 'description' && regex.test(tool.name);
        const matchDescription = searchIn !== 'name' && tool.description && regex.test(tool.description);
        return matchName || matchDescription;
      });

      if (filteredTools.length > 0) {
        matchingTools[serverId] = {
          serverId: serverData.serverId,
          tools: filteredTools
        };
      }
    }

    return matchingTools;
  }

}

export const hubToolsService = new HubToolsService();
