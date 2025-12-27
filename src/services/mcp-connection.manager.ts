import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpServerConfig } from '../config/config.schema.js';
import { logger } from '../utils/logger.js';
import { McpTool } from '../models/tool.model.js';

export interface ServerStatus {
  connected: boolean;
  error?: string;
  lastCheck: number;
  toolsCount: number;
}

class McpConnectionManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private serverStatus: Map<string, ServerStatus> = new Map();
  private toolCache: Map<string, McpTool[]> = new Map();

  public async connect(server: McpServerConfig): Promise<boolean> {
    try {
      logger.info(`Connecting to server ${server.name} (${server.id})...`);
      
      // Convert process.env to Record<string, string> by filtering undefined values
      const safeEnv: Record<string, string> = Object.fromEntries(
        Object.entries(process.env).filter(([_, v]) => v !== undefined)
      ) as Record<string, string>;

      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: server.env ? { ...safeEnv, ...server.env } : safeEnv
      });

      const client = new Client({
        name: "mcp-hub-lite",
        version: "1.0.0"
      }, {
        capabilities: {}
      });

      await client.connect(transport);
      
      this.clients.set(server.id, client);
      this.transports.set(server.id, transport);
      this.serverStatus.set(server.id, {
        connected: true,
        lastCheck: Date.now(),
        toolsCount: 0
      });

      logger.info(`Connected to server ${server.name}`);
      
      // Fetch tools immediately
      await this.refreshTools(server.id);

      return true;
    } catch (error) {
      logger.error(`Failed to connect to server ${server.name}:`, error);
      this.serverStatus.set(server.id, {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        lastCheck: Date.now(),
        toolsCount: 0
      });
      return false;
    }
  }

  public async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    const transport = this.transports.get(serverId);

    if (client) {
        try {
            await client.close();
        } catch (e) {
            logger.warn(`Error closing client for ${serverId}:`, e);
        }
    }
    
    if (transport) {
        try {
            await transport.close();
        } catch (e) {
             logger.warn(`Error closing transport for ${serverId}:`, e);
        }
    }

    this.clients.delete(serverId);
    this.transports.delete(serverId);
    this.serverStatus.set(serverId, {
        connected: false,
        lastCheck: Date.now(),
        toolsCount: 0
    });
    this.toolCache.delete(serverId);
  }

  public async refreshTools(serverId: string): Promise<McpTool[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      const result = await client.listTools();
      const tools: McpTool[] = result.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as any, // Cast to match our model
        serverId: serverId
      }));

      this.toolCache.set(serverId, tools);
      
      // Update status
      const status = this.serverStatus.get(serverId);
      if (status) {
        status.toolsCount = tools.length;
        status.lastCheck = Date.now();
      }

      return tools;
    } catch (error) {
      logger.error(`Failed to list tools for server ${serverId}:`, error);
      throw error;
    }
  }

  public getStatus(serverId: string): ServerStatus | undefined {
    return this.serverStatus.get(serverId);
  }

  public getTools(serverId: string): McpTool[] {
    return this.toolCache.get(serverId) || [];
  }

  public getAllTools(): McpTool[] {
    const allTools: McpTool[] = [];
    for (const tools of this.toolCache.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }
  
  public getClient(serverId: string): Client | undefined {
      return this.clients.get(serverId);
  }
}

export const mcpConnectionManager = new McpConnectionManager();
