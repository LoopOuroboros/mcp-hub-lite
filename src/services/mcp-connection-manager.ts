import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { TransportFactory } from '@utils/transports/transport-factory.js';
import { logger } from '@utils/logger.js';
import { withSpan, createMcpSpanOptions } from '@utils/index.js';
import type { Tool, JsonSchema } from '@shared-models/tool.model.js';
import type { Resource } from '@shared-models/resource.model.js';
import { logStorage } from '@services/log-storage.service.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';
import { hubManager } from '@services/hub-manager.service.js';
import { MCP_HUB_LITE_SERVER } from '@models/system-tools.constants.js';
import type { ServerConfig } from '@config/config.schema.js';
import type { ServerInstanceConfig } from '@config/config.schema.js';

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
  private transports: Map<string, Transport> = new Map();
  private serverStatus: Map<string, ServerStatus> = new Map();
  public toolCache: Map<string, Tool[]> = new Map();
  private serverNameToolCache: Map<string, Tool[]> = new Map(); // 服务器名称级别的工具缓存
  private resourceCache: Map<string, Resource[]> = new Map();
  private nameToIdMap: Map<string, string> = new Map(); // 服务器名称到ID的映射

  constructor() {
    // 监听服务器删除事件，自动断开连接
    eventBus.subscribe(EventTypes.SERVER_DELETED, (data: unknown) => {
      const serverName = data as string;
      // 根据服务器名称找到所有实例并断开连接
      const serverInstances = hubManager.getServerInstanceByName(serverName);
      serverInstances.forEach(instance => {
        this.disconnect(instance.id!).catch(err => {
          logger.warn(`Failed to disconnect deleted server instance ${instance.id}:`, err);
        });
      });
    });
  }

  public async connect(server: ServerConfig & ServerInstanceConfig): Promise<boolean> {
    // Use trace helper to wrap the entire connection process
    return withSpan<boolean>(
      'mcp.connection.connect',
      createMcpSpanOptions('connect', server.id || 'unknown', undefined, {
        'mcp.server.type': server.type,
        'mcp.server.name': 'unknown' // Will be updated with actual name after serverInfo is retrieved
      }),
      async () => {
        let serverInfo: { name: string; config: ServerConfig; instance: ServerInstanceConfig } | undefined;
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

          if ((server.type === 'sse' || server.type === 'streamable-http' || server.type === 'http') && (!server.url || server.url.trim() === '')) {
            const displayType = server.type === 'http' ? 'streamable-http' : server.type;
            throw new Error(`${displayType.toUpperCase()} server requires a valid URL`);
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
            transport.onstdout = () => {
              // 不记录原始的JSON-RPC通信到日志或控制台，以避免日志噪音
              // 只有在开发调试时才需要查看原始通信
            };
          }
          if ('onstderr' in transport) {
            transport.onstderr = (data: string) => {
              // 使用服务器ID和名称进行日志存储
              const serverId = server?.id ?? 'unknown';
              const serverName = serverInfo!.name;
              logStorage.append(serverId, 'error', `[${serverName}] [STDERR] ${data}`);
            };
          }

          const client = new Client({
            name: MCP_HUB_LITE_SERVER,
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
    );
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

      // 更新服务器名称级别的工具缓存
      let disconnectedServerName = 'unknown';
      for (const [name, id] of this.nameToIdMap.entries()) {
        if (id === serverId) {
          disconnectedServerName = name;
          break;
        }
      }
      if (disconnectedServerName !== 'unknown') {
        // 重新计算该服务器名称下所有实例的工具
        const allToolsForServer: Tool[] = [];
        for (const [id, cachedTools] of this.toolCache.entries()) {
          let instanceServerName = 'unknown';
          for (const [name, instanceId] of this.nameToIdMap.entries()) {
            if (instanceId === id) {
              instanceServerName = name;
              break;
            }
          }
          if (instanceServerName === disconnectedServerName) {
            allToolsForServer.push(...cachedTools);
          }
        }
        if (allToolsForServer.length > 0) {
          this.serverNameToolCache.set(disconnectedServerName, allToolsForServer);
        } else {
          this.serverNameToolCache.delete(disconnectedServerName);
        }
      }

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
    logger.info(`Found ${serverIds.length} connected server(s)`);

    const disconnectPromises = serverIds.map(async (id) => {
      logger.info(`Disconnecting server [${id}]...`);
      try {
        await this.disconnect(id);
        logger.info(`Successfully disconnected server [${id}]`);
      } catch (error) {
        logger.error(`Failed to disconnect server [${id}]:`, error);
      }
    });

    await Promise.all(disconnectPromises);
    logger.info('All servers disconnected');
  }

  public async refreshTools(serverId: string): Promise<Tool[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not connected`);
    }

    try {
      const result = await client.listTools();
      // 从 serverId 找到对应的服务器名称
      let serverName = 'unknown';
      for (const [name, id] of this.nameToIdMap.entries()) {
        if (id === serverId) {
          serverName = name;
          break;
        }
      }
      const tools: Tool[] = result.tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as JsonSchema,
        serverName: serverName
      }));

      this.toolCache.set(serverId, tools);

      // 更新服务器名称级别的工具缓存
      if (serverName !== 'unknown') {
        // 获取该服务器名称下所有实例的工具
        const allToolsForServer: Tool[] = [];
        for (const [id, cachedTools] of this.toolCache.entries()) {
          // 检查这个 id 是否属于当前服务器名称
          let instanceServerName = 'unknown';
          for (const [name, instanceId] of this.nameToIdMap.entries()) {
            if (instanceId === id) {
              instanceServerName = name;
              break;
            }
          }
          if (instanceServerName === serverName) {
            allToolsForServer.push(...cachedTools);
          }
        }
        this.serverNameToolCache.set(serverName, allToolsForServer);
      }

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

  public async refreshResources(serverId: string): Promise<Resource[]> {
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
      const resources: Resource[] = result.resources.map(r => ({
        name: r.name,
        uri: r.uri,
        mimeType: r.mimeType,
        description: r.description
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
    } catch (error: unknown) {
      // Check if error is "Method not found" (MCP error -32601), which means server doesn't implement resources
      if (error && typeof error === 'object' && 'code' in error && error.code === -32601) {
        logger.info(`Server [${serverId}] does not support resources functionality`);
      } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.includes('Method not found')) {
        logger.info(`Server [${serverId}] does not support resources functionality`);
      } else {
        logger.warn(`Failed to list resources for server [${serverId}]:`, error);
      }
      return [];
    }
  }

  public getStatus(serverId: string): ServerStatus | undefined {
    return this.serverStatus.get(serverId);
  }

  public getTools(serverId: string): Tool[] {
    const tools = this.toolCache.get(serverId) || [];
    logger.info(`getTools for [${serverId}]: returned ${tools.length} tools`);
    return tools;
  }

  public getResources(serverId: string): Resource[] {
    const resources = this.resourceCache.get(serverId) || [];
    logger.info(`getResources for [${serverId}]: returned ${resources.length} resources`);
    return resources;
  }

  public async readResource(serverId: string, uri: string): Promise<unknown> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server ${serverId} not connected`);
    }
    return client.readResource({ uri });
  }

  public getAllTools(): Tool[] {
    const allTools: Tool[] = [];
    for (const tools of this.toolCache.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  public getToolCacheEntries(): [string, Tool[]][] {
    return Array.from(this.toolCache.entries());
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

  public async callToolByName(name: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
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

  public getToolsByName(name: string): Tool[] {
    const serverId = this.nameToIdMap.get(name);
    if (!serverId) {
      return [];
    }
    return this.toolCache.get(serverId) || [];
  }

  public getResourcesByName(name: string): Resource[] {
    const serverId = this.nameToIdMap.get(name);
    if (!serverId) {
      return [];
    }
    return this.resourceCache.get(serverId) || [];
  }

  public getTool(serverName: string, toolName: string): Tool | undefined {
    const tools = this.serverNameToolCache.get(serverName);
    return tools?.find(t => t.name === toolName);
  }

  public getAllResources(): Record<string, Resource[]> {
    const result: Record<string, Resource[]> = {};

    // Group resources by server name
    for (const [serverId, resources] of this.resourceCache.entries()) {
      // Find server name for this ID
      let serverName = 'unknown';
      for (const [name, id] of this.nameToIdMap.entries()) {
        if (id === serverId) {
          serverName = name;
          break;
        }
      }

      if (!result[serverName]) {
        result[serverName] = [];
      }
      result[serverName].push(...resources);
    }

    return result;
  }

  public async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // Use trace helper to wrap the tool call
    return withSpan<unknown>(
      'mcp.tool.call',
      createMcpSpanOptions('call', serverId, toolName, {
        'mcp.tool.args': JSON.stringify(args)
      }),
      async () => {
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
    );
  }

  // 获取基于服务器名称的工具缓存
  public getToolsByServerName(serverName: string): Tool[] {
    return this.serverNameToolCache.get(serverName) || [];
  }

  // 获取所有服务器名称的工具（用于搜索）
  public getAllToolsByServerName(): Tool[] {
    const allTools: Tool[] = [];
    for (const tools of this.serverNameToolCache.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }
}

export const mcpConnectionManager = new McpConnectionManager();