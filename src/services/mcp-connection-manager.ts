import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { TransportFactory } from '../utils/transports/transport-factory.js';
import { logger, isToolsListResponse } from '../utils/logger.js';
import { McpTool } from '../models/tool.model.js';
import { McpResource } from '../models/resource.model.js';
import { logStorage } from './log-storage.service.js';
import { eventBus, EventTypes } from './event-bus.service.js';
import { hubManager } from './hub-manager.service.js';

export interface ServerStatus {
  connected: boolean;
  error?: string;
  lastCheck: number;
  toolsCount: number;
  resourcesCount: number;
  pid?: number;
  startTime?: number;
  version?: string;
  hash?: string;
}

class McpConnectionManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, any> = new Map(); // Using 'any' for transport types
  private serverStatus: Map<string, ServerStatus> = new Map();
  private toolCache: Map<string, McpTool[]> = new Map();
  private resourceCache: Map<string, McpResource[]> = new Map();
  private nameToIdMap: Map<string, string> = new Map(); // 服务器名称到ID的映射

  constructor() {
    // 监听服务器删除事件，自动断开连接
    eventBus.subscribe(EventTypes.SERVER_DELETED, (serverName: string) => {
      // 根据服务器名称找到所有实例并断开连接
      const serverInstances = hubManager.getServerInstanceByName(serverName);
      serverInstances.forEach(instance => {
        this.disconnect(instance.id!).catch(err => {
          logger.warn(`Failed to disconnect deleted server instance ${instance.id}:`, err);
        });
      });
    });
  }

  public async connect(server: any): Promise<boolean> {
    let serverInfo;
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

      // 从服务器实例ID中获取服务器名称（通过 hubManager.getServerById）
      serverInfo = hubManager.getServerById(server.id);
      if (!serverInfo) {
        throw new Error(`Server not found for instance: ${server.id}`);
      }

      if (server.type === 'stdio' && (!server.command || server.command.trim() === '')) {
        throw new Error('STDIO server requires a valid command');
      }

      if ((server.type === 'sse' || server.type === 'streamable-http') && (!server.url || server.url.trim() === '')) {
        throw new Error(`${server.type.toUpperCase()} server requires a valid URL`);
      }

      // Create transport based on server type
      const transport = TransportFactory.createTransport({
        ...server,
        name: serverInfo.name
      });

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
        // 获取安全的服务器名称（处理可能的 undefined 情况）
        const safeServerName = server?.name ?? server?.id ?? 'unknown';
        const safeServerId = server?.id ?? 'unknown';

        transport.onstdout = (data: string) => {
          // 检查是否为 tools/list 响应
          const isToolsListResp = isToolsListResponse(data);
          if (isToolsListResp) {
            // 完全跳过 tools/list 响应的日志存储，仅在控制台输出 debug 级别日志
            logger.debug(`[${safeServerName}] [STDOUT] ${data}`);
            return;
          }
          logStorage.append(safeServerId, 'info', `[${safeServerName}] [STDOUT] ${data}`);
        };
      }
      if ('onstderr' in transport) {
        // 获取安全的服务器名称（处理可能的 undefined 情况）
        const safeServerName = server?.name ?? server?.id ?? 'unknown';
        const safeServerId = server?.id ?? 'unknown';

        transport.onstderr = (data: string) => {
          logStorage.append(safeServerId, 'error', `[${safeServerName}] [STDERR] ${data}`);
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
      this.nameToIdMap.set(serverInfo.name, server.id);

      // Get PID if available (only for stdio transport)
      let pid: number | undefined;
      if ('pid' in transport && typeof transport.pid === 'number') {
        pid = transport.pid;
      }

      // Get server version
      const clientServerInfo = client.getServerVersion();
      const serverVersion = clientServerInfo?.version || clientServerInfo?.name;

      // 更新服务器实例信息（合并 pid 和 startTime）
      const serverName = serverInfo.name;
      const instances = hubManager.getServerInstanceByName(serverName);
      const instanceIndex = instances.findIndex(inst => inst.id === server.id);
      if (instanceIndex !== -1) {
        hubManager.updateServerInstance(serverName, instanceIndex, {
          pid: pid,
          startTime: Date.now() // 启动时间与 timestamp 相同
        });
      }

      this.serverStatus.set(server.id, {
        connected: true,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0,
        pid: pid,
        startTime: Date.now(),
        version: serverVersion,
        hash: server.hash
      });

      logger.info(`Connected to server [${server.id}]`);

      // 发布服务器连接成功事件
      eventBus.publish(EventTypes.SERVER_CONNECTED, {
        serverId: server.id,
        status: 'online',
        timestamp: Date.now()
      });

      // 发布服务器状态变化事件
      eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
        serverId: server.id,
        status: 'online',
        timestamp: Date.now()
      });

      // Fetch tools and resources immediately (only for bidirectional transports)
      if (server.type !== 'sse') {
        const tools = await this.refreshTools(server.id);
        const resources = await this.refreshResources(server.id);

        // 发布工具和资源更新事件
        eventBus.publish(EventTypes.TOOLS_UPDATED, {
          serverId: server.id,
          tools
        });

        eventBus.publish(EventTypes.RESOURCES_UPDATED, {
          serverId: server.id,
          resources
        });
      } else {
        logger.info('SSE transport is unidirectional, skipping tool/resource refresh');
      }

      return true;
    } catch (error) {
      logger.error(`Failed to connect to server ${serverInfo?.name || server.id || 'unknown'}:`, error);
      const serverId = server.id || 'unknown';
      this.serverStatus.set(serverId, {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
      });

      // 发布服务器状态变化事件（错误状态）
      eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
        serverId,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });

      return false;
    }
  }

  public async disconnect(serverId: string): Promise<void> {
    logger.info(`Disconnecting from server [${serverId}]...`);

    const client = this.clients.get(serverId);
    const transport = this.transports.get(serverId);

    try {
      if (client) {
        try {
          await client.close();
        } catch (e) {
          logger.warn(`Error closing client for [${serverId}]:`, e);
        }
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

      // 删除名称到ID的映射
      for (const [name, id] of this.nameToIdMap.entries()) {
        if (id === serverId) {
          this.nameToIdMap.delete(name);
          break;
        }
      }

      this.serverStatus.set(serverId, {
        connected: false,
        lastCheck: Date.now(),
        toolsCount: 0,
        resourcesCount: 0
      });

      // 发布服务器断开连接事件
      eventBus.publish(EventTypes.SERVER_DISCONNECTED, {
        serverId,
        status: 'offline',
        timestamp: Date.now()
      });

      // 发布服务器状态变化事件
      eventBus.publish(EventTypes.SERVER_STATUS_CHANGE, {
        serverId,
        status: 'offline',
        timestamp: Date.now()
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

  public getServerIdByName(name: string): string | undefined {
    return this.nameToIdMap.get(name);
  }

  public getClientByName(name: string): Client | undefined {
    const serverId = this.nameToIdMap.get(name);
    if (!serverId) {
      return undefined;
    }
    return this.clients.get(serverId);
  }

  public async callToolByName(name: string, toolName: string, args: any): Promise<any> {
    const serverId = this.nameToIdMap.get(name);
    if (!serverId) {
      throw new Error(`Server ${name} not connected or not found`);
    }

    return this.callTool(serverId, toolName, args);
  }

  public getStatusByName(name: string): ServerStatus | undefined {
    const serverId = this.nameToIdMap.get(name);
    if (!serverId) {
      return undefined;
    }
    return this.serverStatus.get(serverId);
  }

  public getToolsByName(name: string): McpTool[] {
    const serverId = this.nameToIdMap.get(name);
    if (!serverId) {
      return [];
    }
    return this.toolCache.get(serverId) || [];
  }

  public getResourcesByName(name: string): McpResource[] {
    const serverId = this.nameToIdMap.get(name);
    if (!serverId) {
      return [];
    }
    return this.resourceCache.get(serverId) || [];
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
}

export const mcpConnectionManager = new McpConnectionManager();