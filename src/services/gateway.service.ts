import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ListRootsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { mcpConnectionManager } from "./mcp-connection-manager.js";
import { hubManager } from "./hub-manager.service.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";
import { searchCoreService } from "./search/search-core.service.js";
import { hubToolsService } from "./hub-tools.service.js";
import { getClientCwd, getClientContext } from "../utils/request-context.js";
import { clientTrackerService } from "./client-tracker.service.js";
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
} from "../models/system-tools.constants.js";

export class GatewayService {
  private server: McpServer;
  private transport: StdioServerTransport | null = null;
  // Cache map: gatewayToolName -> { serverId, realToolName }
  private toolMap: Map<string, { serverId: string; realToolName: string }> = new Map();

  constructor() {
    this.server = new McpServer(
      {
        name: MCP_HUB_LITE_SERVER,
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
      // Capture client info
      const context = getClientContext();
      if (context && request.params?.clientInfo) {
        const { name, version } = request.params.clientInfo;
        logger.info(`Initialized client: ${name} v${version} (ID: ${context.clientId})`);
        
        // Update client info in tracker
        clientTrackerService.updateClient({
            ...context,
            clientName: name
        });
      }

      return {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: MCP_HUB_LITE_SERVER,
          version: "1.0.0",
          mcpVersion: "2024-11-05"
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

    // Handle initialized notification to fetch roots
    const InitializedNotificationSchema = z.object({
      method: z.literal('notifications/initialized'),
      params: z.any().optional(),
      jsonrpc: z.literal('2.0')
    });

    server.server.setNotificationHandler(InitializedNotificationSchema, async () => {
      const context = getClientContext();
      if (!context) {
        logger.warn('Received notifications/initialized but client context is missing');
        return;
      }

      logger.info(`Client ${context.clientId} initialized, fetching roots...`);
      
      try {
        const result = await server.server.request(
          { method: "roots/list" }, 
          ListRootsResultSchema
        );
        
        if (result.roots) {
          logger.info(`Received ${result.roots.length} roots from client ${context.clientId}`);
          clientTrackerService.updateClientRoots(context.clientId, result.roots);
        }
      } catch (error) {
        // Many clients (e.g. web browsers) might not support roots, just log as debug
        logger.debug(`Failed to fetch roots from client ${context.clientId}: ${error}`);
      }
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
          const serverInstances = hubManager.getServerInstanceByName(filters.serverName);
          if (serverInstances.length > 0) {
            // 使用第一个实例的 ID 作为筛选条件
            searchOptions.filters!.serverId = serverInstances[0].id;
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
        serverName: z.string()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ListAllToolsInServerRequestSchema, async (request) => {
      try {
        const { serverName } = request.params;
        const result = await hubToolsService.listAllToolsInServer(serverName);
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
        serverName: z.string(),
        pattern: z.string(),
        searchIn: z.enum(['name', 'description', 'both']).optional().default('both'),
        caseSensitive: z.boolean().optional().default(false)
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(FindToolsInServerRequestSchema, async (request) => {
      try {
        const { serverName, pattern, searchIn, caseSensitive } = request.params;
        const result = await hubToolsService.findToolsInServer(serverName, pattern, searchIn, caseSensitive);
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
        serverName: z.string(),
        toolName: z.string()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(GetToolRequestSchema, async (request) => {
      try {
        const { serverName, toolName } = request.params;
        const tool = await hubToolsService.getTool(serverName, toolName);

        if (!tool) {
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
        serverName: z.string(),
        toolName: z.string(),
        toolArgs: z.record(z.string(), z.any())
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(CallToolDirectRequestSchema, async (request) => {
      try {
        const { serverName, toolName, toolArgs } = request.params;

        // Inject CWD if available and not present in args
        const cwd = getClientCwd();
        if (cwd && !toolArgs.cwd) {
            toolArgs.cwd = cwd;
            logger.debug(`Injected CWD into direct tool call: ${cwd}`);
        }

        const result = await hubToolsService.callTool(serverName, toolName, toolArgs);
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
      const gatewayTools = this.generateGatewayToolsList(toolMap);
      return {
        tools: gatewayTools
      };
    });

    // Original call tool handler (for compatibility)
    server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const toolArgs: any = request.params.arguments || {};

      logger.info(`Received tools/call request: toolName=${toolName}, args=${JSON.stringify(toolArgs)}, toolMap size=${toolMap.size}`);

      // Log all available tool names in toolMap for debugging
      const availableTools = Array.from(toolMap.keys());
      logger.debug(`Available tools in toolMap: [${availableTools.join(', ')}]`);

      // Handle system tools
      if (typeof toolName === 'string' && SYSTEM_TOOL_NAMES.includes(toolName as SystemToolName)) {
        try {
          let result;
          switch (toolName) {
            case LIST_SERVERS_TOOL:
              result = await hubToolsService.listServers();
              break;
            case FIND_SERVERS_TOOL:
              result = await hubToolsService.findServers(
                toolArgs.pattern,
                toolArgs.searchIn,
                toolArgs.caseSensitive
              );
              break;
            case LIST_ALL_TOOLS_IN_SERVER_TOOL:
              result = await hubToolsService.listAllToolsInServer(toolArgs.serverName);
              break;
            case FIND_TOOLS_IN_SERVER_TOOL:
              result = await hubToolsService.findToolsInServer(
                toolArgs.serverName,
                toolArgs.pattern,
                toolArgs.searchIn,
                toolArgs.caseSensitive
              );
              break;
            case GET_TOOL_TOOL:
              result = await hubToolsService.getTool(toolArgs.serverName, toolArgs.toolName);
              break;
            case CALL_TOOL_TOOL:
              // Handle undefined or "undefined" serverName for system tools
              let serverName = toolArgs.serverName;
              if (!serverName || serverName === 'undefined') {
                serverName = MCP_HUB_LITE_SERVER;
              }

              // Inject CWD for nested call-tool
              const cwd = getClientCwd();
              if (cwd && toolArgs.toolArgs && !toolArgs.toolArgs.cwd) {
                  toolArgs.toolArgs.cwd = cwd;
                  logger.debug(`Injected CWD into nested tool call: ${cwd}`);
              }
              result = await hubToolsService.callTool(serverName, toolArgs.toolName, toolArgs.toolArgs);
              break;
            case FIND_TOOLS_TOOL:
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

      logger.info(`Tool lookup result for ${toolName}:`, target);

      if (!target) {
          logger.error(`Tool not found: ${toolName}, available tools: [${Array.from(toolMap.keys()).join(', ')}]`);
          throw new McpError(-32801, `Tool ${toolName} not found`);
      }

      try {
        // Inject CWD if available and not present in args
        const cwd = getClientCwd();
        if (cwd && !toolArgs.cwd) {
            toolArgs.cwd = cwd;
            logger.debug(`Injected CWD into tool call [${toolName}]: ${cwd}`);
        }
        
        logger.info(`Calling tool: serverId=${target.serverId}, realToolName=${target.realToolName}`);

        const result = await mcpConnectionManager.callTool(target.serverId, target.realToolName, toolArgs);

        logger.info(`Tool call succeeded: serverId=${target.serverId}, realToolName=${target.realToolName}, result=${JSON.stringify(result)}`);
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

  /**
   * Generate gateway tools list with consistent naming and mapping logic
   * This function is used by both tools/list MCP request handler and
   * hub-tools.service listAllToolsInServer method for mcp-hub-lite server
   */
  public generateGatewayToolsList(toolMap: Map<string, { serverId: string; realToolName: string }>): Array<{
    name: string;
    description: string;
    inputSchema?: any;
  }> {
    const allTools = mcpConnectionManager.getAllTools();
    const gatewayTools = [];
    toolMap.clear();

    // Add system tools
    const systemTools = hubToolsService.getSystemTools();
    const usedNames = new Set<string>();

    for (const tool of systemTools) {
      gatewayTools.push({
        name: tool.name,
        description: `[System] ${tool.description}`,
        inputSchema: tool.inputSchema
      });
      usedNames.add(tool.name);
    }


    // First pass: Count tool name frequencies to determine uniqueness
    const toolNameCounts = new Map<string, number>();
    for (const tool of allTools) {
      // 直接使用 tool.serverId 作为完整的实例ID查找服务器配置
      const serverConfig = hubManager.getServerById(tool.serverId);
      if (serverConfig) {
        if (serverConfig.config.allowedTools && !serverConfig.config.allowedTools.includes(tool.name)) {
          continue;
        }
      }
      toolNameCounts.set(tool.name, (toolNameCounts.get(tool.name) || 0) + 1);
    }

    for (const tool of allTools) {
        // 直接使用 tool.serverId 作为完整的实例ID查找服务器配置
        const serverConfig = hubManager.getServerById(tool.serverId);

        if (serverConfig) {
          if (serverConfig.config.allowedTools && !serverConfig.config.allowedTools.includes(tool.name)) {
            continue;
          }
        }

        const serverName = serverConfig ? serverConfig.name : tool.serverId;

        let gatewayToolName = tool.name;
        const isUnique = toolNameCounts.get(tool.name) === 1;
        const isSystemConflict = usedNames.has(tool.name);

        // If tool name is not unique or conflicts with system tool, append server hash
        if (!isUnique || isSystemConflict) {
            // 从 serverConfig 中获取实例的 hash
            const hash = serverConfig?.instance?.hash || 'xxxx';
            gatewayToolName = `${tool.name}_${hash}`;
        }

        // Ensure name doesn't exceed 60 chars
        if (gatewayToolName.length > 60) {
            // 直接从 serverConfig 中获取实例的 hash
            const hash = serverConfig?.instance?.hash || 'xxxx';
            // Reserve space for hash and separator
            const maxToolNameLen = 60 - hash.length - 1;
            const truncatedToolName = tool.name.substring(0, maxToolNameLen);
            gatewayToolName = `${truncatedToolName}_${hash}`;
        }

        // Final uniqueness check (in case of hash collision or previous renaming conflict)
        let finalName = gatewayToolName;
        let counter = 1;
        while (usedNames.has(finalName)) {
            const suffix = `_${counter}`;
            if (gatewayToolName.length + suffix.length > 60) {
                const availableLen = 60 - suffix.length;
                finalName = gatewayToolName.substring(0, availableLen) + suffix;
            } else {
                finalName = gatewayToolName + suffix;
            }
            counter++;
        }
        gatewayToolName = finalName;

        usedNames.add(gatewayToolName);

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

    return gatewayTools;
  }

  private setupHandlers() {
    this.registerHandlers(this.server, this.toolMap);
  }

  public createConnectionServer(): McpServer {
    const server = new McpServer(
      {
        name: MCP_HUB_LITE_SERVER,
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
