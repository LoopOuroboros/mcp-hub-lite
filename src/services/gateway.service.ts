import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { mcpConnectionManager } from './mcp-connection-manager.js';
import { hubManager } from './hub-manager.service.js';
import { logger, withSpan, createMcpSpanOptions } from '@utils/index.js';
import { z } from 'zod';
import { searchCoreService } from './search/search-core.service.js';
import { SearchOptions } from './search/types.js';
import { hubToolsService } from './hub-tools.service.js';
import { getClientCwd, getClientContext } from '@utils/request-context.js';
import { clientTrackerService } from './client-tracker.service.js';
import type { JsonSchema } from '@shared-models/tool.model.js';
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
  MCP_HUB_LITE_SERVER,
  type FindServersParams,
  type ListAllToolsInServerParams,
  type FindToolsInServerParams,
  type GetToolParams,
  type CallToolParams,
  type FindToolsParams
} from '@models/system-tools.constants.js';

export class GatewayService {
  private server: McpServer;
  private transport: StdioServerTransport | null = null;
  // Cache map: gatewayToolName -> { serverId, realToolName }
  private toolMap: Map<string, { serverId: string; realToolName: string }> = new Map();

  constructor() {
    this.server = new McpServer(
      {
        name: MCP_HUB_LITE_SERVER,
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {} // Add resource capability support
        }
      }
    );

    // Call registerHandlers directly in constructor
    this.registerHandlers(this.server, this.toolMap);
  }

  private registerHandlers(
    server: McpServer,
    toolMap: Map<string, { serverId: string; realToolName: string }>
  ) {
    // MCP standard initialize handler
    const InitializeRequestSchema = z.object({
      method: z.literal('initialize'),
      params: z
        .object({
          clientInfo: z
            .object({
              name: z.string(),
              version: z.string(),
              mcpVersion: z.string().optional()
            })
            .optional(),
          capabilities: z
            .object({
              tools: z
                .object({
                  list: z.boolean().optional(),
                  execute: z.boolean().optional()
                })
                .optional(),
              experimental: z.record(z.string(), z.any()).optional()
            })
            .optional()
        })
        .optional(),
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
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: MCP_HUB_LITE_SERVER,
          version: '1.0.0',
          mcpVersion: '2024-11-05'
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
      return { pong: true }; // Response format compliant with MCP specification
    });

    // Define search tool schema
    const SearchToolsRequestSchema = z.object({
      method: z.literal('tools/search'),
      params: z
        .object({
          search: z.string().optional(),
          filters: z
            .object({
              serverName: z.string().optional(),
              tags: z.record(z.string(), z.string()).optional()
            })
            .optional(),
          limit: z.number().int().positive().optional().default(50),
          offset: z.number().int().nonnegative().optional().default(0)
        })
        .optional(),
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
          filters: {} as SearchOptions['filters']
        };

        if (filters.serverName) {
          const serverInstances = hubManager.getServerInstanceByName(filters.serverName);
          if (serverInstances.length > 0) {
            // Use the first instance's ID as filter condition
            searchOptions.filters!.serverId = serverInstances[0].id;
          }
        }

        if (filters.tags) {
          searchOptions.filters!.tags = filters.tags;
        }

        const results = await searchCoreService.search(search, searchOptions);

        return {
          results: results.map((r) => ({
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
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(`Search tools error:`, error);
          throw new McpError(-32802, `Search failed: ${error.message}`);
        } else {
          logger.error(`Search tools error:`, error);
          throw new McpError(-32802, `Search failed: ${String(error)}`);
        }
      }
    });

    // List servers
    const ListServersRequestSchema = z.object({
      method: z.literal(LIST_SERVERS_TOOL),
      params: z.object({}).optional(),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ListServersRequestSchema, async () => {
      const servers = await hubToolsService.listServers();
      return { servers };
    });

    // Find servers
    const FindServersRequestSchema = z.object({
      method: z.literal(FIND_SERVERS_TOOL),
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

    // List all tools in a specific server
    const ListAllToolsInServerRequestSchema = z.object({
      method: z.literal(LIST_ALL_TOOLS_IN_SERVER_TOOL),
      params: z.object({
        serverName: z.string(),
        requestOptions: z
          .object({
            sessionId: z.string().optional(),
            tags: z.record(z.string(), z.string()).optional()
          })
          .optional()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(ListAllToolsInServerRequestSchema, async (request) => {
      try {
        const { serverName, requestOptions } = request.params;
        const result = await hubToolsService.listAllToolsInServer(serverName, requestOptions);
        return result;
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(`List tools in server error:`, error);
          throw new McpError(-32802, error.message);
        } else {
          logger.error(`List tools in server error:`, error);
          throw new McpError(-32802, String(error));
        }
      }
    });

    // Find tools in a specific server
    const FindToolsInServerRequestSchema = z.object({
      method: z.literal(FIND_TOOLS_IN_SERVER_TOOL),
      params: z.object({
        serverName: z.string(),
        pattern: z.string(),
        searchIn: z.enum(['name', 'description', 'both']).optional().default('both'),
        caseSensitive: z.boolean().optional().default(false),
        requestOptions: z
          .object({
            sessionId: z.string().optional(),
            tags: z.record(z.string(), z.string()).optional()
          })
          .optional()
      }),
      id: z.union([z.string(), z.number()]),
      jsonrpc: z.literal('2.0')
    });

    server.server.setRequestHandler(FindToolsInServerRequestSchema, async (request) => {
      try {
        const { serverName, pattern, searchIn, caseSensitive, requestOptions } = request.params;
        const result = await hubToolsService.findToolsInServer(
          serverName,
          pattern,
          searchIn,
          caseSensitive,
          requestOptions
        );
        return result;
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(`Find tools in server error:`, error);
          throw new McpError(-32802, error.message);
        } else {
          logger.error(`Find tools in server error:`, error);
          throw new McpError(-32802, String(error));
        }
      }
    });

    // Get tool
    const GetToolRequestSchema = z.object({
      method: z.literal(GET_TOOL_TOOL),
      params: z.object({
        serverName: z.string(),
        toolName: z.string(),
        requestOptions: z
          .object({
            sessionId: z.string().optional(),
            tags: z.record(z.string(), z.string()).optional()
          })
          .optional()
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
      } catch (error: unknown) {
        logger.error(`Get tool error:`, error);
        if (error instanceof McpError) {
          throw error;
        } else if (error instanceof Error) {
          throw new McpError(-32802, error.message);
        } else {
          throw new McpError(-32802, String(error));
        }
      }
    });

    // Call tool directly
    const CallToolDirectRequestSchema = z.object({
      method: z.literal(CALL_TOOL_TOOL),
      params: z.object({
        serverName: z.string(),
        toolName: z.string(),
        toolArgs: z.record(z.string(), z.unknown()),
        requestOptions: z
          .object({
            sessionId: z.string().optional(),
            tags: z.record(z.string(), z.string()).optional()
          })
          .optional()
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

        const result = await hubToolsService.callTool(
          serverName,
          toolName,
          toolArgs,
          requestOptions
        );
        // Wrap the result in a valid CallToolResult structure
        if (typeof result === 'object' && result !== null) {
          return {
            content: [],
            ...result
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: String(result)
              }
            ]
          };
        }
      } catch (error: unknown) {
        logger.error(`Call tool error:`, error);
        if (error instanceof McpError) {
          throw error;
        } else if (error instanceof Error) {
          throw new McpError(-32802, error.message);
        } else {
          throw new McpError(-32802, String(error));
        }
      }
    });

    // List all tools from all servers
    const ListAllToolsRequestSchema = z.object({
      method: z.literal('list_all_tools'),
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
      method: z.literal(FIND_TOOLS_TOOL),
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

    server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        const resources = await hubToolsService.listResources();
        return { resources };
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(`List resources error:`, error);
          throw new McpError(-32802, error.message);
        } else {
          logger.error(`List resources error:`, error);
          throw new McpError(-32802, String(error));
        }
      }
    });

    server.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const { uri } = request.params;
        const content = await hubToolsService.readResource(uri);
        // Convert to official MCP format: contents array
        return {
          contents: [
            {
              type: 'text',
              text: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
            }
          ]
        };
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error(`Read resource error:`, error);
          throw new McpError(-32802, error.message);
        } else {
          logger.error(`Read resource error:`, error);
          throw new McpError(-32802, String(error));
        }
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
      const toolArgs: Record<string, unknown> = request.params.arguments || {};

      // Log incoming tool request with full context
      logger.info(
        `Tool call REQUEST received: toolName=${toolName}, args=${this.formatToolArgs(toolArgs)}`,
        { subModule: 'GATEWAY' }
      );
      logger.debug(
        `Tool context: toolMap size=${toolMap.size}, available tools=${Array.from(toolMap.keys()).slice(0, 10).join(', ')}${toolMap.size > 10 ? '...' : ''}`,
        { subModule: 'GATEWAY' }
      );

      // Handle system tools
      if (typeof toolName === 'string' && SYSTEM_TOOL_NAMES.includes(toolName as SystemToolName)) {
        logger.info(`System tool called: ${toolName}, args=${this.formatToolArgs(toolArgs)}`, {
          subModule: 'GATEWAY'
        });
        try {
          let result;
          switch (toolName) {
            case LIST_SERVERS_TOOL:
              result = await hubToolsService.listServers();
              break;
            case FIND_SERVERS_TOOL: {
              const findServersArgs = toolArgs as unknown as FindServersParams;
              result = await hubToolsService.findServers(
                findServersArgs.pattern,
                findServersArgs.searchIn,
                findServersArgs.caseSensitive
              );
              break;
            }
            case LIST_ALL_TOOLS_IN_SERVER_TOOL: {
              const listAllToolsArgs = toolArgs as unknown as ListAllToolsInServerParams;
              result = await hubToolsService.listAllToolsInServer(
                listAllToolsArgs.serverName,
                listAllToolsArgs.requestOptions
              );
              break;
            }
            case FIND_TOOLS_IN_SERVER_TOOL: {
              const findToolsInServerArgs = toolArgs as unknown as FindToolsInServerParams;
              result = await hubToolsService.findToolsInServer(
                findToolsInServerArgs.serverName,
                findToolsInServerArgs.pattern,
                findToolsInServerArgs.searchIn,
                findToolsInServerArgs.caseSensitive,
                findToolsInServerArgs.requestOptions
              );
              break;
            }
            case GET_TOOL_TOOL: {
              const getToolArgs = toolArgs as unknown as GetToolParams;
              result = await hubToolsService.getTool(
                getToolArgs.serverName,
                getToolArgs.toolName,
                getToolArgs.requestOptions
              );
              break;
            }
            case CALL_TOOL_TOOL: {
              const callToolArgs = toolArgs as unknown as CallToolParams;
              let serverName = callToolArgs.serverName;
              if (!serverName || serverName === 'undefined') {
                serverName = MCP_HUB_LITE_SERVER;
              }

              // Inject CWD for nested call-tool
              const cwd = getClientCwd();
              if (cwd && callToolArgs.toolArgs && !callToolArgs.toolArgs.cwd) {
                // Use type assertion to ensure we can safely add cwd property
                const toolArgsWithCwd = callToolArgs.toolArgs as Record<string, unknown> & {
                  cwd?: string;
                };
                toolArgsWithCwd.cwd = cwd;
                logger.debug(`Injected CWD into nested tool call: ${cwd}`);
              }
              result = await hubToolsService.callTool(
                serverName,
                callToolArgs.toolName,
                callToolArgs.toolArgs,
                callToolArgs.requestOptions
              );
              break;
            }
            case FIND_TOOLS_TOOL: {
              const findToolsArgs = toolArgs as unknown as FindToolsParams;
              result = await hubToolsService.findTools(
                findToolsArgs.pattern,
                findToolsArgs.searchIn,
                findToolsArgs.caseSensitive
              );
              break;
            }
          }

          logger.info(`System tool SUCCESS: ${toolName}`, { subModule: 'GATEWAY' });

          // Check if result is already in Mcp content format (especially for call-tool)
          if (
            result &&
            typeof result === 'object' &&
            'content' in result &&
            Array.isArray(result.content)
          ) {
            return result;
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            logger.error(`System tool FAILED: ${toolName}, error=${error.message}`, error, {
              subModule: 'GATEWAY'
            });
            throw new McpError(-32802, error.message || 'System Tool Error');
          } else {
            logger.error(`System tool FAILED: ${toolName}, error=${String(error)}`, error, {
              subModule: 'GATEWAY'
            });
            throw new McpError(-32802, String(error) || 'System Tool Error');
          }
        }
      }

      const target = toolMap.get(toolName);

      logger.debug(
        `Tool lookup SUCCESS: toolName=${toolName} -> serverId=${target?.serverId}, realToolName=${target?.realToolName}`,
        { subModule: 'GATEWAY' }
      );

      if (!target) {
        logger.error(
          `Tool NOT FOUND: toolName=${toolName}, available tools=${Array.from(toolMap.keys()).join(', ')}`,
          { subModule: 'GATEWAY' }
        );
        throw new McpError(-32801, `Tool ${toolName} not found`);
      }

      const startTime = Date.now();
      try {
        // Inject CWD if available and not present in args
        const cwd = getClientCwd();
        if (cwd && !toolArgs.cwd) {
          toolArgs.cwd = cwd;
          logger.debug(`Injected CWD into tool call ${toolName}: ${cwd}`, { subModule: toolName });
        }
        logger.info(
          `Tool call EXECUTING: serverId=${target.serverId}, realToolName=${target.realToolName}, args=${this.formatToolArgs(toolArgs)}`,
          { subModule: 'GATEWAY' }
        );

        const result = await mcpConnectionManager.callTool(
          target.serverId,
          target.realToolName,
          toolArgs
        );

        const duration = Date.now() - startTime;
        logger.info(
          `Tool call SUCCESS: serverId=${target.serverId}, realToolName=${target.realToolName}, duration=${duration}ms, response=${this.formatToolResponse(result)}`,
          { subModule: 'GATEWAY' }
        );

        // Wrap the result in a valid CallToolResult structure
        if (typeof result === 'object' && result !== null) {
          return {
            content: [],
            ...result
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: String(result)
              }
            ]
          };
        }
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        if (error instanceof Error) {
          logger.error(
            `Tool call FAILED: serverId=${target.serverId}, realToolName=${target.realToolName}, duration=${duration}ms, error=${error.message}`,
            { subModule: 'GATEWAY' }
          );

          if (error.stack) {
            logger.debug(`Error stack for ${target.realToolName}:`, error.stack, {
              subModule: 'GATEWAY'
            });
          }

          if (error instanceof McpError) {
            throw error;
          }

          // Map internal errors to standard MCP error codes
          if (error.message?.includes('not connected')) {
            throw new McpError(-32001, `Server not reachable: ${error.message}`);
          }

          throw new McpError(-32802, error.message || 'Internal Gateway Error');
        } else {
          logger.error(
            `Tool call FAILED: serverId=${target.serverId}, realToolName=${target.realToolName}, duration=${duration}ms, error=${String(error)}`,
            { subModule: 'GATEWAY' }
          );
          throw new McpError(-32802, String(error) || 'Internal Gateway Error');
        }
      }
    });
  }

  /**
   * Generate gateway tools list with consistent naming and mapping logic
   * This function is used by both tools/list MCP request handler and
   * hub-tools.service listAllToolsInServer method for mcp-hub-lite server
   */
  public generateGatewayToolsList(
    toolMap: Map<string, { serverId: string; realToolName: string }>
  ): Array<{
    name: string;
    description: string;
    inputSchema?: JsonSchema;
    annotations?: {
      title?: string;
      readOnlyHint?: boolean;
      destructiveHint?: boolean;
      idempotentHint?: boolean;
      openWorldHint?: boolean;
    };
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
        inputSchema: tool.inputSchema,
        annotations: tool.annotations
      });
      usedNames.add(tool.name);
    }

    // First pass: Count tool name frequencies to determine uniqueness
    const toolNameCounts = new Map<string, number>();
    // Iterate through toolCache to get all tools and their server IDs
    for (const [serverId, tools] of mcpConnectionManager.toolCache.entries()) {
      for (const tool of tools) {
        const serverConfig = hubManager.getServerById(serverId);
        if (serverConfig) {
          if (
            serverConfig.config.allowedTools &&
            !serverConfig.config.allowedTools.includes(tool.name)
          ) {
            continue;
          }
        }
        toolNameCounts.set(tool.name, (toolNameCounts.get(tool.name) || 0) + 1);
      }
    }

    // Second pass: Generate gateway tools with proper naming
    for (const [serverId, tools] of mcpConnectionManager.toolCache.entries()) {
      const serverConfig = hubManager.getServerById(serverId);

      // Skip if server configuration not found
      if (!serverConfig) {
        logger.warn(`Server configuration not found for serverId: ${serverId}, skipping tools`);
        continue;
      }

      for (const tool of tools) {
        if (
          serverConfig.config.allowedTools &&
          !serverConfig.config.allowedTools.includes(tool.name)
        ) {
          continue;
        }

        const serverName = serverConfig.name;

        let gatewayToolName = tool.name;
        const isUnique = toolNameCounts.get(tool.name) === 1;
        const isSystemConflict = usedNames.has(tool.name);

        // If tool name is not unique or conflicts with system tool, append server hash
        if (!isUnique || isSystemConflict) {
          // Get instance hash from serverConfig, use first 4 characters of serverId as default
          const hash = serverConfig.instance?.hash || serverId.substring(0, 4);
          gatewayToolName = `${tool.name}_${hash}`;
        }

        // Ensure name doesn't exceed 60 chars
        if (gatewayToolName.length > 60) {
          // Use first 4 characters of serverId as default hash
          const hash = serverConfig.instance?.hash || serverId.substring(0, 4);
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
  private formatToolArgs(args: unknown): string {
    try {
      const seen = new WeakSet();
      const replacer = (_key: string, value: unknown): unknown => {
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
      return (
        '[Error formatting args: ' + (error instanceof Error ? error.message : String(error)) + ']'
      );
    }
  }

  /**
   * Safely format tool response for logging
   */
  private formatToolResponse(response: unknown): string {
    try {
      const formatted = JSON.stringify(response, null, 2);
      // Limit total output length
      if (formatted.length > 2000) {
        return formatted.substring(0, 2000) + '... [truncated]';
      }
      return formatted;
    } catch (error) {
      return (
        '[Error formatting response: ' +
        (error instanceof Error ? error.message : String(error)) +
        ']'
      );
    }
  }

  public createConnectionServer(): McpServer {
    const server = new McpServer(
      {
        name: MCP_HUB_LITE_SERVER,
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {} // Add resource capability support
        }
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
      async () => {
        this.transport = new StdioServerTransport();
        await this.server.connect(this.transport);
        logger.info('MCP Gateway started on stdio');
      }
    );
  }
}

export const gateway = new GatewayService();
