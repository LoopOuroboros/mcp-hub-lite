import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { MCPRequest, MCPResponse, ServerConfig } from './types.js';

import { MockMCPServer } from './MockMCPServer.js';

/**
 * MCP Gateway 核心实现
 * 验证 Fastify 作为 MCP 网关的可行性
 */
export class MCPGateway {
  private fastify: FastifyInstance;
  private servers: Map<string, MockMCPServer> = new Map();
  private serverConfigs: Map<string, ServerConfig> = new Map();

  constructor() {
    this.fastify = Fastify({
      logger: {
        level: 'info'
      }
    });

    this.setupRoutes();
  }

  private setupRoutes() {
    // Health check
    this.fastify.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        serverCount: this.servers.size
      };
    });

    // 注册 MCP 服务器
    this.fastify.post('/api/servers/register', async (request, reply) => {
      const config = request.body as ServerConfig;
      this.registerServer(config);
      reply.code(201);
      return { success: true, serverId: config.id };
    });

    // 获取服务器列表
    this.fastify.get('/api/servers', async () => {
      return {
        servers: Array.from(this.serverConfigs.values())
      };
    });

    // 代理 MCP 请求
    this.fastify.post<{
      Body: { serverId: string; request: MCPRequest };
    }>('/api/mcp/proxy', async (request, reply) => {
      // 手动设置 CORS 头
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (request.method === 'OPTIONS') {
        reply.code(200);
        return;
      }
      const { serverId, request: mcpRequest } = request.body;
      const server = this.servers.get(serverId);

      if (!server) {
        reply.code(404);
        return {
          success: false,
          error: {
            code: -32001,
            message: `Server not found: ${serverId}`
          }
        };
      }

      try {
        const response = await server.handleRequest(mcpRequest);
        return response;
      } catch (error) {
        this.fastify.log.error({ err: error }, 'Error handling MCP request');
        reply.code(500);
        return {
          success: false,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : 'Internal error'
          }
        };
      }
    });

    // 批量代理 MCP 请求
    this.fastify.post<{
      Body: { requests: Array<{ serverId: string; request: MCPRequest }> };
    }>('/api/mcp/batch', async (request, reply) => {
      // 手动设置 CORS 头
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      const { requests } = request.body;

      const results = await Promise.allSettled(
        requests.map(async ({ serverId, request }) => {
          const server = this.servers.get(serverId);
          if (!server) {
            throw new Error(`Server not found: ${serverId}`);
          }
          return server.handleRequest(request);
        })
      );

      return {
        results: results.map((result, index) => ({
          index,
          status: result.status,
          response: result.status === 'fulfilled' ? result.value : null,
          error: result.status === 'rejected' ? result.reason : null
        }))
      };
    });
  }

  private registerServer(config: ServerConfig) {
    const server = new MockMCPServer(config.id, 4000 + Math.floor(Math.random() * 1000));
    this.servers.set(config.id, server);
    this.serverConfigs.set(config.id, config);

    this.fastify.log.info(`Registered server: ${config.id}`);
  }

  async start(port: number = 3000) {
    try {
      await this.fastify.listen({ port, host: '0.0.0.0' });
      this.fastify.log.info(`MCP Gateway started on port ${port}`);

      // 自动注册一些测试服务器
      this.registerTestServers();

      return this;
    } catch (error) {
      this.fastify.log.error({ err: error }, 'Failed to start server');
      process.exit(1);
    }
  }

  private registerTestServers() {
    // 注册 3 个测试服务器
    for (let i = 1; i <= 3; i++) {
      this.registerServer({
        id: `server-${i}`,
        name: `Test Server ${i}`,
        endpoint: `http://localhost:${4000 + i}`,
        status: 'online',
        tools: []
      });
    }

    this.fastify.log.info('Registered 3 test MCP servers');
  }

  async stop() {
    await this.fastify.close();
    this.fastify.log.info('MCP Gateway stopped');
  }

  getFastifyInstance() {
    return this.fastify;
  }

  getServerInfo(serverId: string) {
    const server = this.servers.get(serverId);
    return server ? server.getServerInfo() : null;
  }
}