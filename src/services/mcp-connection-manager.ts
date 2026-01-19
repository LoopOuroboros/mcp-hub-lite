import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TransportFactory } from '../utils/transports/transport-factory.js';
import { McpServerConfig } from '../config/config.schema.js';
import { logger } from '../utils/logger.js';
import { McpTool } from '../models/tool.model.js';
import { McpResource } from '../models/resource.model.js';
import { configManager } from '../config/config-manager.js';
import { logStorage } from './log-storage.service.js';

export interface ServerStatus {
  connected: boolean;
  error?: string;
  lastCheck: number;
  toolsCount: number;
  resourcesCount: number;
  pid?: number;
  startTime?: number;
}

class McpConnectionManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, any> = new Map(); // Using 'any' for transport types
  private serverStatus: Map<string, ServerStatus> = new Map();
  private toolCache: Map<string, McpTool[]> = new Map();
  private resourceCache: Map<string, McpResource[]> = new Map();

  /**
   * Gets server name by ID with fallback to ID if not found
   */
  private getServerName(serverId: string): string {
    const server = configManager.getServerById(serverId);
    return server ? `${server.name} (${serverId})` : serverId;
  }

  public async connect(server: McpServerConfig): Promise<boolean> {
    try {
      logger.info(`Connecting to server ${server.name} (${server.id || 'unknown'})...`);

      // Validate server configuration
      if (!server.id) {
        throw new Error('Server ID is required');
      }

      if (server.type === 'stdio' && (!server.command || server.command.trim() === '')) {
        throw new Error('STDIO server requires a valid command');
      }

      if ((server.type === 'sse' || server.type === 'streamable-http') && (!server.url || server.url.trim() === '')) {
        throw new Error(`${server.type.toUpperCase()} server requires a valid URL`);
      }

      // Create transport based on server type
      const transport = TransportFactory.createTransport(server);

      // 添加日志监听器
      if ('onstdout' in transport) {
        transport.onstdout = (data: string) => {
          logStorage.append(server.id!, 'info', `[${server.name}] [STDOUT] ${data}`);
        };
      }
      if ('onstderr' in transport) {
        transport.onstderr = (data: string) => {
          logStorage.append(server.id!, 'error', `[${server.name}] [STDERR] ${data}`);
        };
      }

      const client = new Client({
        name: "mcp-hub-lite",
        version: "1.0.0"
      }, {
        capabilities: {}
      });

      await client.connect(transport);

      this.clients.set(server.id, client);
      this.transports.set(server.id, transport);

      // Get PID if available (only for stdio transport)
      let pid: number | undefined;
      if ('pid' in transport && typeof transport.pid === 'number') {
        pid = transport.pid;
      }

      this.serverStatus.set(server.id, {
        connected: true,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0,
        pid: pid,
        startTime: Date.now()
      });

      logger.info(`Connected to server ${server.name} (${server.type || 'stdio'})`);

      // Fetch tools and resources immediately (only for bidirectional transports)
      if (server.type !== 'sse') {
        await this.refreshTools(server.id);
        await this.refreshResources(server.id);
      } else {
        logger.info('SSE transport is unidirectional, skipping tool/resource refresh');
      }

      return true;
    } catch (error) {
      logger.error(`Failed to connect to server ${server.name}:`, error);
      const serverId = server.id || 'unknown';
      this.serverStatus.set(serverId, {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
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
        logger.warn(`Error closing client for ${this.getServerName(serverId)}:`, e);
      }
    }

    if (transport) {
      try {
        await transport.close();
      } catch (e) {
        logger.warn(`Error closing transport for ${this.getServerName(serverId)}:`, e);
      }
    }

    this.clients.delete(serverId);
    this.transports.delete(serverId);
    this.serverStatus.set(serverId, {
      connected: false,
      lastCheck: Date.now(),
      toolsCount: 0,
      resourcesCount: 0
    });
    this.toolCache.delete(serverId);
    this.resourceCache.delete(serverId);
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
        inputSchema: t.inputSchema as any,
        serverId: serverId
      }));

      this.toolCache.set(serverId, tools);

      // Update status
      const status = this.serverStatus.get(serverId);
      if (status) {
        status.toolsCount = tools.length;
        status.lastCheck = Date.now();
      }

      logger.info(`Refreshed tools for server ${this.getServerName(serverId)}: ${tools.length} tools found`);
      return tools;
    } catch (error) {
      logger.error(`Failed to list tools for server ${this.getServerName(serverId)}:`, error);
      throw error;
    }
  }

  public async refreshResources(serverId: string): Promise<McpResource[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      // Check if client actually supports listResources method
      if (typeof client.listResources !== 'function') {
        logger.warn(`Server ${this.getServerName(serverId)} does not support resources listing`);
        return [];
      }

      const result = await client.listResources();
      const resources: McpResource[] = result.resources.map(r => ({
        name: r.name,
        uri: r.uri,
        mimeType: r.mimeType,
        description: r.description,
        serverId: serverId
      }));

      this.resourceCache.set(serverId, resources);

      // Update status
      const status = this.serverStatus.get(serverId);
      if (status) {
        status.resourcesCount = resources.length;
        status.lastCheck = Date.now();
      }

      logger.info(`Refreshed resources for server ${this.getServerName(serverId)}: ${resources.length} resources found`);
      return resources;
    } catch (error: any) {
      // Check if error is "Method not found" (MCP error -32601), which means server doesn't implement resources
      if (error.code === -32601 || error.message?.includes('Method not found')) {
        logger.debug(`Server ${this.getServerName(serverId)} does not support resources functionality`);
      } else {
        logger.warn(`Failed to list resources for server ${this.getServerName(serverId)}:`, error);
      }
      return [];
    }
  }

  public getStatus(serverId: string): ServerStatus | undefined {
    return this.serverStatus.get(serverId);
  }

  public getTools(serverId: string): McpTool[] {
    const tools = this.toolCache.get(serverId) || [];
    logger.info(`getTools for ${this.getServerName(serverId)}: returned ${tools.length} tools`);
    return tools;
  }

  public getResources(serverId: string): McpResource[] {
    const resources = this.resourceCache.get(serverId) || [];
    logger.info(`getResources for ${this.getServerName(serverId)}: returned ${resources.length} resources`);
    return resources;
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

  public async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args
      });
      return result;
    } catch (error) {
      logger.error(`Failed to call tool ${toolName} on server ${this.getServerName(serverId)}:`, error);
      throw error;
    }
  }
}

export const mcpConnectionManager = new McpConnectionManager();