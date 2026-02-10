import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js";
import { mcpConnectionManager } from "./mcp-connection-manager.js";
import { hubManager } from "./hub-manager.service.js";
import { logger, withSpan, createMcpSpanOptions } from "@utils/index.js";
import { z } from "zod";
import { searchCoreService } from "./search/search-core.service.js";
import { hubToolsService } from "./hub-tools.service.js";
import { getClientCwd, getClientContext } from "@utils/request-context.js";
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
  LIST_RESOURCES_TOOL,
  READ_RESOURCE_TOOL,
  MCP_HUB_LITE_SERVER
} from "@models/system-tools.constants.js";

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
          resources: {},  // 添加资源能力支持
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
        logger.info(`Initialized client: ${name} v${version} (ID: ${context.sessionId})`);
        
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
          resources: {
            list: true,
            read: true
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
        serverName: z.string(),
        requestOptions: z.object({
          sessionId: z.string().optional(),
          tags: z.record(z.string(), z.string()).optional()
        }).optional()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ListAllToolsInServerRequestSchema, async (request) => {
      try {
        const { serverName, requestOptions } = request.params;
        const result = await hubToolsService.listAllToolsInServer(serverName, requestOptions);
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
        caseSensitive: z.boolean().optional().default(false),
        requestOptions: z.object({
          sessionId: z.string().optional(),
          tags: z.record(z.string(), z.string()).optional()
        }).optional()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(FindToolsInServerRequestSchema, async (request) => {
      try {
        const { serverName, pattern, searchIn, caseSensitive, requestOptions } = request.params;
        const result = await hubToolsService.findToolsInServer(serverName, pattern, searchIn, caseSensitive, requestOptions);
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
        toolName: z.string(),
        requestOptions: z.object({
          sessionId: z.string().optional(),
          tags: z.record(z.string(), z.string()).optional()
        }).optional()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(GetToolRequestSchema, async (request) => {
      try {
        const { serverName, toolName, requestOptions } = request.params;
        const tool = await hubToolsService.getTool(serverName, toolName, requestOptions);

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
        toolArgs: z.record(z.string(), z.any()),
        requestOptions: z.object({
          sessionId: z.string().optional(),
          tags: z.record(z.string(), z.string()).optional()
        }).optional()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(CallToolDirectRequestSchema, async (request) => {
      try {
        const { serverName, toolName, toolArgs, requestOptions } = request.params;

        // Inject CWD if available and not present in args
        const cwd = getClientCwd();
        if (cwd && !toolArgs.cwd) {
            toolArgs.cwd = cwd;
            logger.debug(`Injected CWD into direct tool call: ${cwd}`);
        }

        const result = await hubToolsService.callTool(serverName, toolName, toolArgs, requestOptions);
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

    // List resources tool
    const ListResourcesRequestSchema = z.object({
      method: z.literal('list-resources'),
      params: z.object({}).optional(),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resources = await hubToolsService.listResources();
        return { resources };
      } catch (error: any) {
        logger.error(`List resources error:`, error);
        throw new McpError(-32802, error.message);
      }
    });

    // Read resource tool (system tool interface)
    const ReadResourceRequestSchema = z.object({
      method: z.literal('read-resource'),
      params: z.object({
        uri: z.string()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const { uri } = request.params;
        const content = await hubToolsService.readResource(uri);
        return { content };
      } catch (error: any) {
        logger.error(`Read resource error:`, error);
        throw new McpError(-32802, error.message);
      }
    });

    // Official MCP resources/read interface
    const OfficialReadResourceRequestSchema = z.object({
      method: z.literal('resources/read'),
      params: z.object({
        uri: z.string()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(OfficialReadResourceRequestSchema, async (request) => {
      try {
        const { uri } = request.params;
        const content = await hubToolsService.readResource(uri);
        // 转换为官方 MCP 格式：contents 数组
        return {
          contents: [
            {
              type: "text",
              text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
            }
          ]
        };
      } catch (error: any) {
        logger.error(`Resources read error:`, error);
        throw new McpError(-32802, error.message);
      }
    });

    // Official MCP resources/list interface
    const OfficialListResourcesRequestSchema = z.object({
      method: z.literal('resources/list'),
      params: z.object({
        cursor: z.string().optional()
      }).optional(),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(OfficialListResourcesRequestSchema, async () => {
      try {
        const resources = await hubToolsService.listResources();
        return {
          resources: resources,
          nextCursor: undefined
        };
      } catch (error: any) {
        logger.error(`Resources list error:`, error);
        throw new McpError(-32802, error.message);
      }
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

      // Log incoming tool request with full context
      logger.info(`[GATEWAY] Tool call REQUEST received: toolName=${toolName}, args=${this.formatToolArgs(toolArgs)}`);
      logger.debug(`[GATEWAY] Tool context: toolMap size=${toolMap.size}, available tools=${Array.from(toolMap.keys()).slice(0, 10).join(', ')}${toolMap.size > 10 ? '...' : ''}`);

      // Handle system tools
      if (typeof toolName === 'string' && SYSTEM_TOOL_NAMES.includes(toolName as SystemToolName)) {
        logger.info(`[GATEWAY] System tool called: ${toolName}, args=${this.formatToolArgs(toolArgs)}`);
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
              result = await hubToolsService.listAllToolsInServer(toolArgs.serverName, toolArgs.requestOptions);
              break;
            case FIND_TOOLS_IN_SERVER_TOOL:
              result = await hubToolsService.findToolsInServer(
                toolArgs.serverName,
                toolArgs.pattern,
                toolArgs.searchIn,
                toolArgs.caseSensitive,
                toolArgs.requestOptions
              );
              break;
            case GET_TOOL_TOOL:
              result = await hubToolsService.getTool(toolArgs.serverName, toolArgs.toolName, toolArgs.requestOptions);
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
              result = await hubToolsService.callTool(serverName, toolArgs.toolName, toolArgs.toolArgs, toolArgs.requestOptions);
              break;
            case FIND_TOOLS_TOOL:
              result = await hubToolsService.findTools(
                toolArgs.pattern,
                toolArgs.searchIn,
                toolArgs.caseSensitive
              );
              break;
            case LIST_RESOURCES_TOOL:
              result = await hubToolsService.listResources();
              break;
            case READ_RESOURCE_TOOL:
              result = await hubToolsService.readResource(toolArgs.uri);
              break;
          }

          logger.info(`[GATEWAY] System tool SUCCESS: ${toolName}`);

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
          logger.error(`[GATEWAY] System tool FAILED: ${toolName}, error=${error instanceof Error ? error.message : String(error)}`, error);
          throw new McpError(-32802, error.message || "System Tool Error");
        }
      }

      const target = toolMap.get(toolName);

      logger.debug(`[GATEWAY] Tool lookup SUCCESS: toolName=${toolName} -> serverId=${target?.serverId}, realToolName=${target?.realToolName}`);

      if (!target) {
          logger.error(`[GATEWAY] Tool NOT FOUND: toolName=${toolName}, available tools=${Array.from(toolMap.keys()).join(', ')}`);
          throw new McpError(-32801, `Tool ${toolName} not found`);
      }

      const startTime = Date.now();
      try {
        // Inject CWD if available and not present in args
        const cwd = getClientCwd();
        if (cwd && !toolArgs.cwd) {
            toolArgs.cwd = cwd;
            logger.debug(`Injected CWD into tool call [${toolName}]: ${cwd}`);
        }
        logger.info(`[GATEWAY] Tool call EXECUTING: serverId=${target.serverId}, realToolName=${target.realToolName}, args=${this.formatToolArgs(toolArgs)}`);

        const result = await mcpConnectionManager.callTool(target.serverId, target.realToolName, toolArgs);

        const duration = Date.now() - startTime;
        logger.info(`[GATEWAY] Tool call SUCCESS: serverId=${target.serverId}, realToolName=${target.realToolName}, duration=${duration}ms, response=${this.formatToolResponse(result)}`);
        return result;
      } catch (error: any) {
         const duration = Date.now() - startTime;
         logger.error(`[GATEWAY] Tool call FAILED: serverId=${target.serverId}, realToolName=${target.realToolName}, duration=${duration}ms, error=${error instanceof Error ? error.message : String(error)}`);

         if (error instanceof Error && error.stack) {
           logger.debug(`[GATEWAY] Error stack for ${target.realToolName}:`, error.stack);
         }

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
    // 遍历 toolCache 来获取所有工具及其服务器ID
    for (const [serverId, tools] of mcpConnectionManager.toolCache.entries()) {
      for (const tool of tools) {
        const serverConfig = hubManager.getServerById(serverId);
        if (serverConfig) {
          if (serverConfig.config.allowedTools && !serverConfig.config.allowedTools.includes(tool.name)) {
            continue;
          }
        }
        toolNameCounts.set(tool.name, (toolNameCounts.get(tool.name) || 0) + 1);
      }
    }

    // Second pass: Generate gateway tools with proper naming
    for (const [serverId, tools] of mcpConnectionManager.toolCache.entries()) {
      for (const tool of tools) {
        const serverConfig = hubManager.getServerById(serverId);

        if (serverConfig) {
          if (serverConfig.config.allowedTools && !serverConfig.config.allowedTools.includes(tool.name)) {
            continue;
          }
        }

        const serverName = serverConfig ? serverConfig.name : serverId;

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
            serverId: serverId,
            realToolName: tool.name
        });

        gatewayTools.push({
            name: gatewayToolName,
            description: `[From ${serverName}] ${tool.description || ''}`,
            inputSchema: tool.inputSchema
        });
      }
    }

    return gatewayTools;
  }

  /**
   * Safely format tool arguments for logging
   * Handles circular references and limits output size
   */
  private formatToolArgs(args: any): string {
    try {
      const seen = new WeakSet();
      const replacer = (_key: string, value: any) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular Reference]';
          }
          seen.add(value);
        }
        // Limit string length and truncate large objects
        if (typeof value === 'string' && value.length > 500) {
          return value.substring(0, 500) + '... [truncated]';
        }
        return value;
      };

      const formatted = JSON.stringify(args, replacer, 2);
      // Limit total output length
      if (formatted.length > 2000) {
        return formatted.substring(0, 2000) + '... [truncated]';
      }
      return formatted;
    } catch (error) {
      return '[Error formatting args: ' + (error instanceof Error ? error.message : String(error)) + ']';
    }
  }

  /**
   * Safely format tool response for logging
   */
  private formatToolResponse(response: any): string {
    try {
      const formatted = JSON.stringify(response, null, 2);
      // Limit total output length
      if (formatted.length > 2000) {
        return formatted.substring(0, 2000) + '... [truncated]';
      }
      return formatted;
    } catch (error) {
      return '[Error formatting response: ' + (error instanceof Error ? error.message : String(error)) + ']';
    }
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
          resources: {},  // 添加资源能力支持
        },
      }
    );

    // Local toolMap for this connection
    const toolMap = new Map<string, { serverId: string; realToolName: string }>();

    this.registerHandlers(server, toolMap);

    return server;
  }

  public async start() {
    return withSpan<void>(
      'mcp.gateway.start',
      createMcpSpanOptions('gateway_start', 'gateway'),
      async (_span) => {
        this.transport = new StdioServerTransport();
        await this.server.connect(this.transport);
        logger.info("MCP Gateway started on stdio");
      }
    );
  }
}

export const gateway = new GatewayService();
