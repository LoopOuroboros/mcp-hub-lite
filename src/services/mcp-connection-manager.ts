import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TransportFactory } from '../utils/transports/transport-factory.js';
import { McpServerConfig } from '../config/config.schema.js';
import { logger, isToolsListResponse } from '../utils/logger.js';
import { McpTool } from '../models/tool.model.js';
import { McpResource } from '../models/resource.model.js';
import { logStorage } from './log-storage.service.js';

export interface ServerStatus {
  connected: boolean;
  error?: string;
  lastCheck: number;
  toolsCount: number;
  resourcesCount: number;
  pid?: number;
  startTime?: number;
  version?: string;
}

class McpConnectionManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, any> = new Map(); // Using 'any' for transport types
  private serverStatus: Map<string, ServerStatus> = new Map();
  private toolCache: Map<string, McpTool[]> = new Map();
  private resourceCache: Map<string, McpResource[]> = new Map();

  public async connect(server: McpServerConfig): Promise<boolean> {
    try {
      logger.info(`Connecting to server [${server.id || 'unknown'}]...`);

      // Validate server configuration
      if (!server.id) {
        throw new Error('Server ID is required');
      }

      // 首先设置 starting 状态（connected: false，无 error）
      this.serverStatus.set(server.id, {
        connected: false,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
      });

      if (server.type === 'stdio' && (!server.command || server.command.trim() === '')) {
        throw new Error('STDIO server requires a valid command');
      }

      if ((server.type === 'sse' || server.type === 'streamable-http') && (!server.url || server.url.trim() === '')) {
        throw new Error(`${server.type.toUpperCase()} server requires a valid URL`);
      }

      // Create transport based on server type
      const transport = TransportFactory.createTransport(server);

      // Handle transport close events
      if ('onclose' in transport) {
        transport.onclose = () => {
          logger.info(`Transport closed for server [${server.id}]`);
          const currentStatus = this.serverStatus.get(server.id!);
          // Only update status if it was previously connected or starting
          if (currentStatus && (currentStatus.connected || !currentStatus.error)) {
             this.serverStatus.set(server.id!, {
               connected: false,
               lastCheck: Date.now(),
               toolsCount: 0,
               resourcesCount: 0,
               error: 'Connection closed unexpectedly'
             });
          }
        };
      }

      // 添加日志监听器
      if ('onstdout' in transport) {
        transport.onstdout = (data: string) => {
          // 检查是否为 tools/list 响应
          const isToolsListResp = isToolsListResponse(data);
          const logLevel = isToolsListResp ? 'debug' : 'info';
          logStorage.append(server.id!, logLevel, `[${server.name}] [STDOUT] ${data}`);
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

      // Get server version
      const serverInfo = client.getServerVersion();
      const serverVersion = serverInfo?.version || serverInfo?.name;

      this.serverStatus.set(server.id, {
        connected: true,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0,
        pid: pid,
        startTime: Date.now(),
        version: serverVersion
      });

      logger.info(`Connected to server [${server.id}]`);

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

      logger.info(`Refreshed tools for server [${serverId}]: ${tools.length} tools found`);
      return tools;
    } catch (error) {
      logger.error(`Failed to list tools for server [${serverId}]:`, error);
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
        logger.warn(`Server [${serverId}] does not support resources listing`);
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

      logger.info(`Refreshed resources for server [${serverId}]: ${resources.length} resources found`);
      return resources;
    } catch (error: any) {
      // Check if error is "Method not found" (MCP error -32601), which means server doesn't implement resources
      if (error.code === -32601 || error.message?.includes('Method not found')) {
        logger.debug(`Server [${serverId}] does not support resources functionality`);
      } else {
        logger.warn(`Failed to list resources for server [${serverId}]:`, error);
      }
      return [];
    }
  }

  public getStatus(serverId: string): ServerStatus | undefined {
    return this.serverStatus.get(serverId);
  }

  public getTools(serverId: string): McpTool[] {
    const tools = this.toolCache.get(serverId) || [];
    logger.info(`getTools for [${serverId}]: returned ${tools.length} tools`);
    return tools;
  }

  public getResources(serverId: string): McpResource[] {
    const resources = this.resourceCache.get(serverId) || [];
    logger.info(`getResources for [${serverId}]: returned ${resources.length} resources`);
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
      logger.error(`Failed to call tool ${toolName} on server [${serverId}]:`, error);
      throw error;
    }
  }

  public async disconnect(serverId: string): Promise<void> {
    logger.info(`Disconnecting from server [${serverId}]...`);
    
    const client = this.clients.get(serverId);
    const transport = this.transports.get(serverId);

    try {
      if (client) {
        // SDK client doesn't have close(), but we can try to close transport
      }

      if (transport && typeof transport.close === 'function') {
        await transport.close();
      }
    } catch (error) {
      logger.error(`Error disconnecting server [${serverId}]:`, error);
    } finally {
      this.clients.delete(serverId);
      this.transports.delete(serverId);
      this.toolCache.delete(serverId);
      this.resourceCache.delete(serverId);
      
      this.serverStatus.set(serverId, {
        connected: false,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
      });
      
      logger.info(`Disconnected from server [${serverId}]`);
    }
  }

  public async disconnectAll(): Promise<void> {
    logger.info('Disconnecting all servers...');
    const serverIds = Array.from(this.clients.keys());
    await Promise.all(serverIds.map(id => this.disconnect(id)));
    logger.info('All servers disconnected');
  }
}

export const mcpConnectionManager = new McpConnectionManager();