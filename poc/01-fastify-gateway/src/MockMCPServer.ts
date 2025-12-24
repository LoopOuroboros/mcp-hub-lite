import type { MCPRequest, MCPResponse, MCPTool } from './types.js';

/**
 * 模拟 MCP 服务器
 * 用于测试 Gateway 转发功能
 */
export class MockMCPServer {
  private tools: Map<string, MCPTool> = new Map();
  private serverId: string;
  private port: number;

  constructor(serverId: string, port: number) {
    this.serverId = serverId;
    this.port = port;
    this.registerTools();
  }

  private registerTools() {
    // 模拟工具清单
    this.tools.set('database-query', {
      name: 'database-query',
      description: '执行数据库查询',
      inputSchema: {
        type: 'object',
        properties: {
          sql: { type: 'string' },
          params: { type: 'array' }
        },
        required: ['sql']
      }
    });

    this.tools.set('file-read', {
      name: 'file-read',
      description: '读取文件内容',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        },
        required: ['path']
      }
    });

    this.tools.set('http-request', {
      name: 'http-request',
      description: '发起 HTTP 请求',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          method: { type: 'string' },
          headers: { type: 'object' }
        },
        required: ['url']
      }
    });
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    // 验证 JSON-RPC 格式
    if (request.jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc version must be "2.0"'
        }
      };
    }

    // 处理具体方法
    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(request);

      case 'tools/list':
        return this.handleToolsList(request);

      case 'tools/call':
        return this.handleToolsCall(request);

      case 'ping':
        return this.handlePing(request);

      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
  }

  private handleInitialize(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        serverInfo: {
          name: `Mock-MCP-Server-${this.serverId}`,
          version: '1.0.0'
        },
        capabilities: {
          tools: {
            list: true,
            execute: true
          }
        }
      }
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: Array.from(this.tools.values())
      }
    };
  }

  private handleToolsCall(request: MCPRequest): MCPResponse {
    const params = request.params as { tool: string; arguments?: Record<string, unknown> };
    const toolName = params?.tool;

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: 'Invalid params: tool name is required'
        }
      };
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Tool not found: ${toolName}`
        }
      };
    }

    // 模拟工具执行
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tool: toolName,
        result: `Executed ${toolName} successfully`,
        executedAt: new Date().toISOString()
      }
    };
  }

  private handlePing(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        pong: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  getServerInfo() {
    return {
      id: this.serverId,
      port: this.port,
      toolCount: this.tools.size,
      toolNames: Array.from(this.tools.keys())
    };
  }
}