import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * 创建模拟的 MCP 服务器用于测试
 */
export class MockMcpServer {
  private server: McpServer;

  constructor(
    private config: {
      name: string;
      version: string;
      tools?: Array<{
        name: string;
        description?: string;
        inputSchema?: unknown;
        handler: (args: unknown) => Promise<unknown>;
      }>;
    }
  ) {
    this.server = new McpServer(
      { name: config.name, version: config.version },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // 为每个工具注册处理器
    if (this.config.tools) {
      for (const tool of this.config.tools) {
        const schema = {
          method: 'tools/call' as const,
          params: {
            name: tool.name,
            arguments: tool.inputSchema || {}
          },
          id: '1',
          jsonrpc: '2.0' as const
        };

        // @ts-expect-error - Test helper schema doesn't need full type safety
        this.server.server.setRequestHandler(schema, async (request: ServerRequest) => {
          // Safely extract arguments from request params
          let args: unknown = undefined;
          if (
            request.params &&
            typeof request.params === 'object' &&
            'arguments' in request.params
          ) {
            args = (request.params as { arguments?: unknown }).arguments;
          }
          const result = await tool.handler(args);
          // For test purposes, wrap the result in a valid CallToolResult structure
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
        });
      }
    }
  }

  // 获取用于连接的配置
  getConnectConfig() {
    return {
      command: 'node',
      args: ['-e', this.getServerScript()],
      type: 'stdio' as const
    };
  }

  // 生成可执行的服务器脚本
  private getServerScript(): string {
    // 返回一个内联的 MCP 服务器脚本
    // 使用 SDK 的 StdioServerTransport
    return `
      // 内联服务器代码...
    `;
  }
}

/**
 * 使用内存传输的测试服务器
 * 更高效，无需启动子进程
 */
export class InMemoryMcpServer {
  constructor() {
    // 目前未实现内存传输
  }
}
