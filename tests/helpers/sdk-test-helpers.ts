import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Create a mock MCP server for testing
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
    // Register handler for each tool
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

  // Get connection configuration
  getConnectConfig() {
    return {
      command: 'node',
      args: ['-e', this.getServerScript()],
      type: 'stdio' as const
    };
  }

  // Generate executable server script
  private getServerScript(): string {
    // Return an inline MCP server script
    // Using SDK's StdioServerTransport
    return `
      // Inline server code...
    `;
  }
}

/**
 * In-memory test server using memory transport
 * More efficient, no need to spawn child processes
 */
export class InMemoryMcpServer {
  constructor() {
    // Memory transport not implemented yet
  }
}
