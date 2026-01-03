import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { mcpConnectionManager } from "./mcp-connection-manager.js";
import { hubManager } from "./hub-manager.service.js";
import { logger } from "../utils/logger.js";

export class GatewayService {
  private server: Server;
  private transport: StdioServerTransport | null = null;
  // Cache map: gatewayToolName -> { serverId, realToolName }
  private toolMap: Map<string, { serverId: string; realToolName: string }> = new Map();

  constructor() {
    this.server = new Server(
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

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = mcpConnectionManager.getAllTools();
      const gatewayTools = [];
      this.toolMap.clear();

      for (const tool of allTools) {
          const serverConfig = hubManager.getServerById(tool.serverId);
          const serverName = serverConfig ? serverConfig.name : tool.serverId;
          // Sanitize server name for tool name prefix (replace non-alphanumeric with underscore)
          const safeServerName = serverName.replace(/[^a-zA-Z0-9]/g, '_');
          
          const gatewayToolName = `${safeServerName}_${tool.name}`;
          
          this.toolMap.set(gatewayToolName, {
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

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const target = this.toolMap.get(toolName);

      if (!target) {
          throw new McpError(-32801, `Tool ${toolName} not found`);
      }
      
      try {
        const result = await mcpConnectionManager.callTool(target.serverId, target.realToolName, request.params.arguments);
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

  public async start() {
      this.transport = new StdioServerTransport();
      await this.server.connect(this.transport);
      logger.info("MCP Gateway started on stdio");
  }
}

export const gateway = new GatewayService();
