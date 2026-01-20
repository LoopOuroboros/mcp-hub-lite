import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { mcpConnectionManager } from "./mcp-connection-manager.js";
import { hubManager } from "./hub-manager.service.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";
import { searchCoreService } from "./search/search-core.service.js";
import { hubToolsService } from "./hub-tools.service.js";

export class GatewayService {
  private server: McpServer;
  private transport: StdioServerTransport | null = null;
  // Cache map: gatewayToolName -> { serverId, realToolName }
  private toolMap: Map<string, { serverId: string; realToolName: string }> = new Map();

  constructor() {
    this.server = new McpServer(
      {
        name: "mcp-hub-lite-gateway",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }


  private registerHandlers(server: McpServer, toolMap: Map<string, { serverId: string; realToolName: string }>) {
    // MCP standard initialize handler
    const InitializeRequestSchema = z.object({
      method: z.literal('initialize'),
      params: z.object({
        clientInfo: z.object({
          name: z.string(),
          version: z.string(),
          mcpVersion: z.string().optional()
        }).optional(),
        capabilities: z.object({
          tools: z.object({
            list: z.boolean().optional(),
            execute: z.boolean().optional()
          }).optional(),
          experimental: z.record(z.string(), z.any()).optional()
        }).optional()
      }).optional(),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      const { clientInfo = { name: "unknown-client", version: "1.0.0" }, capabilities } = request.params || {};
      return {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "mcp-hub-lite-gateway",
          version: "1.0.0",
        },
        capabilities: {
          tools: {
            list: true,
            execute: true
          },
          experimental: {}
        }
      };
    });

    // MCP standard ping handler
    const PingRequestSchema = z.object({
      method: z.literal('ping'),
      params: z.object({}).optional(),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(PingRequestSchema, async () => {
      return { pong: true };  // 符合 MCP 规范的响应格式
    });

    // Define search tool schema
    const SearchToolsRequestSchema = z.object({
      method: z.literal('tools/search'),
      params: z.object({
        search: z.string().optional(),
        filters: z.object({
          serverName: z.string().optional(),
          tags: z.record(z.string(), z.string()).optional()
        }).optional(),
        limit: z.number().int().positive().optional().default(50),
        offset: z.number().int().nonnegative().optional().default(0)
      }).optional(),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    // Search tools handler
    server.server.setRequestHandler(SearchToolsRequestSchema, async (request) => {
      const { search = '', filters = {}, limit = 50, offset = 0 } = request.params || {};

      try {
        const searchOptions = {
          mode: 'fuzzy' as const,
          limit,
          offset,
          filters: {} as any
        };

        if (filters.serverName) {
          const server = hubManager.getAllServers().find((s: any) => s.name === filters.serverName);
          if (server) {
            searchOptions.filters!.serverId = server.id;
          }
        }

        if (filters.tags) {
          searchOptions.filters!.tags = filters.tags;
        }

        const results = await searchCoreService.search(search, searchOptions);

        return {
          results: results.map(r => ({
            tool: r.tool,
            score: r.score
          })),
          pagination: {
            total: results.length,
            limit,
            offset,
            hasMore: results.length >= limit
          }
        };
      } catch (error: any) {
        logger.error(`Search tools error:`, error);
        throw new McpError(-32802, `Search failed: ${error.message}`);
      }
    });

    // List servers tool
    const ListServersRequestSchema = z.object({
      method: z.literal('list-servers'),
      params: z.object({}).optional(),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ListServersRequestSchema, async () => {
      const servers = await hubToolsService.listServers();
      return { servers };
    });

    // Find servers tool
    const FindServersRequestSchema = z.object({
      method: z.literal('find-servers'),
      params: z.object({
        pattern: z.string(),
        searchIn: z.enum(['name', 'description', 'both']).optional().default('both'),
        caseSensitive: z.boolean().optional().default(false)
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(FindServersRequestSchema, async (request) => {
      const { pattern, searchIn, caseSensitive } = request.params;
      const servers = await hubToolsService.findServers(pattern, searchIn, caseSensitive);
      return { servers };
    });

    // List all tools in server tool
    const ListAllToolsInServerRequestSchema = z.object({
      method: z.literal('list-all-tools-in-server'),
      params: z.object({
        serverId: z.string()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ListAllToolsInServerRequestSchema, async (request) => {
      try {
        const { serverId } = request.params;
        const result = await hubToolsService.listAllToolsInServer(serverId);
        return result;
      } catch (error: any) {
        logger.error(`List tools in server error:`, error);
        throw new McpError(-32802, error.message);
      }
    });

    // Find tools in server tool
    const FindToolsInServerRequestSchema = z.object({
      method: z.literal('find-tools-in-server'),
      params: z.object({
        serverId: z.string(),
        pattern: z.string(),
        searchIn: z.enum(['name', 'description', 'both']).optional().default('both'),
        caseSensitive: z.boolean().optional().default(false)
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(FindToolsInServerRequestSchema, async (request) => {
      try {
        const { serverId, pattern, searchIn, caseSensitive } = request.params;
        const result = await hubToolsService.findToolsInServer(serverId, pattern, searchIn, caseSensitive);
        return result;
      } catch (error: any) {
        logger.error(`Find tools in server error:`, error);
        throw new McpError(-32802, error.message);
      }
    });

    // Get tool schema
    const GetToolRequestSchema = z.object({
      method: z.literal('get-tool'),
      params: z.object({
        serverId: z.string(),
        toolName: z.string()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(GetToolRequestSchema, async (request) => {
      try {
        const { serverId, toolName } = request.params;
        const tool = await hubToolsService.getTool(serverId, toolName);

        if (!tool) {
          const server = hubManager.getServerById(serverId);
          const serverName = server ? server.name : serverId;
          throw new McpError(-32801, `Tool "${toolName}" not found on server "${serverName}"`);
        }

        return { tool };
      } catch (error: any) {
        logger.error(`Get tool error:`, error);
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(-32802, error.message);
      }
    });

    // Call tool directly
    const CallToolDirectRequestSchema = z.object({
      method: z.literal('call-tool'),
      params: z.object({
        serverId: z.string(),
        toolName: z.string(),
        toolArgs: z.record(z.string(), z.any())
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(CallToolDirectRequestSchema, async (request) => {
      try {
        const { serverId, toolName, toolArgs } = request.params;
        const result = await hubToolsService.callTool(serverId, toolName, toolArgs);
        return result;
      } catch (error: any) {
        logger.error(`Call tool error:`, error);
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(-32802, error.message);
      }
    });

    // List all tools from all servers
    const ListAllToolsRequestSchema = z.object({
      method: z.literal('list-all-tools'),
      params: z.object({}).optional(),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ListAllToolsRequestSchema, async () => {
      const allTools = await hubToolsService.listAllTools();
      return allTools;
    });

    // Find tools across all servers
    const FindToolsRequestSchema = z.object({
      method: z.literal('find-tools'),
      params: z.object({
        pattern: z.string(),
        searchIn: z.enum(['name', 'description', 'both']).optional().default('both'),
        caseSensitive: z.boolean().optional().default(false)
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(FindToolsRequestSchema, async (request) => {
      const { pattern, searchIn, caseSensitive } = request.params;
      const tools = await hubToolsService.findTools(pattern, searchIn, caseSensitive);
      return tools;
    });

    // Original list tools handler (for compatibility)
    server.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = mcpConnectionManager.getAllTools();
      const gatewayTools = [];
      toolMap.clear();

      // Add system tools
      const systemTools = hubToolsService.getSystemTools();
      for (const tool of systemTools) {
        gatewayTools.push({
          name: tool.name,
          description: `[System] ${tool.description}`,
          inputSchema: tool.inputSchema
        });
      }

      for (const tool of allTools) {
          const serverConfig = hubManager.getServerById(tool.serverId);
          
          if (serverConfig?.allowedTools && !serverConfig.allowedTools.includes(tool.name)) {
            continue;
          }

          const serverName = serverConfig ? serverConfig.name : tool.serverId;
          const safeServerName = serverName.replace(/[^a-zA-Z0-9]/g, '_');

          const gatewayToolName = `${safeServerName}_${tool.name}`;

          toolMap.set(gatewayToolName, {
              serverId: tool.serverId,
              realToolName: tool.name
          });

          gatewayTools.push({
              name: gatewayToolName,
              description: `[From ${serverName}] ${tool.description || ''}`,
              inputSchema: tool.inputSchema
          });
      }

      return {
        tools: gatewayTools
      };
    });

    // Original call tool handler (for compatibility)
    server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const toolArgs: any = request.params.arguments || {};

      // Handle system tools
      if (['list-servers', 'find-servers', 'list-all-tools-in-server', 'find-tools-in-server', 'get-tool', 'call-tool', 'find-tools'].includes(toolName)) {
        try {
          let result;
          switch (toolName) {
            case 'list-servers':
              result = await hubToolsService.listServers();
              break;
            case 'find-servers':
              result = await hubToolsService.findServers(
                toolArgs.pattern,
                toolArgs.searchIn,
                toolArgs.caseSensitive
              );
              break;
            case 'list-all-tools-in-server':
              result = await hubToolsService.listAllToolsInServer(toolArgs.serverId);
              break;
            case 'find-tools-in-server':
              result = await hubToolsService.findToolsInServer(
                toolArgs.serverId,
                toolArgs.pattern,
                toolArgs.searchIn,
                toolArgs.caseSensitive
              );
              break;
            case 'get-tool':
              result = await hubToolsService.getTool(toolArgs.serverId, toolArgs.toolName);
              break;
            case 'call-tool':
              result = await hubToolsService.callTool(toolArgs.serverId, toolArgs.toolName, toolArgs.toolArgs);
              break;
            case 'find-tools':
              result = await hubToolsService.findTools(
                toolArgs.pattern,
                toolArgs.searchIn,
                toolArgs.caseSensitive
              );
              break;
          }

          // Check if result is already in Mcp content format (especially for call-tool)
          if (result && typeof result === 'object' && 'content' in result && Array.isArray(result.content)) {
             return result;
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error: any) {
          logger.error(`System tool execution error:`, error);
          throw new McpError(-32802, error.message || "System Tool Error");
        }
      }

      const target = toolMap.get(toolName);

      if (!target) {
          throw new McpError(-32801, `Tool ${toolName} not found`);
      }

      try {
        const result = await mcpConnectionManager.callTool(target.serverId, target.realToolName, toolArgs);
        return result;
      } catch (error: any) {
         logger.error(`Gateway call tool error:`, error);

         if (error instanceof McpError) {
             throw error;
         }

         // Map internal errors to standard MCP error codes
         if (error.message?.includes('not connected')) {
             throw new McpError(-32001, `Server not reachable: ${error.message}`);
         }

         throw new McpError(-32802, error.message || "Internal Gateway Error");
      }
    });
  }

  private setupHandlers() {
    this.registerHandlers(this.server, this.toolMap);
  }

  public createConnectionServer(): McpServer {
    const server = new McpServer(
      {
        name: "mcp-hub-lite-gateway",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Local toolMap for this connection
    const toolMap = new Map<string, { serverId: string; realToolName: string }>();

    this.registerHandlers(server, toolMap);

    return server;
  }

  public async start() {
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);
      logger.info("MCP Gateway started on stdio");
  }
}

export const gateway = new GatewayService();
