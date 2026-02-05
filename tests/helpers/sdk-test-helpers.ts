import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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
        inputSchema?: any;
        handler: (args: any) => Promise<any>;
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

        this.server.server.setRequestHandler(schema as any, async (request) => {
          return tool.handler(request.params?.arguments);
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
  constructor(
    _config: {
      name: string;
      version: string;
      tools?: Array<{
        name: string;
        description?: string;
        inputSchema?: any;
        handler: (args: any) => Promise<any>;
      }>;
    }
  ) {
    // 目前未实现内存传输
  }
}
