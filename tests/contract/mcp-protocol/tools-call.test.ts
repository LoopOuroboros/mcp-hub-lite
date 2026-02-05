import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';

// 模拟 MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class {
      connect = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      listTools = vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'calculator',
            description: 'Perform calculations',
            inputSchema: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' },
                operation: { type: 'string', enum: ['add', 'subtract', 'multiply'] }
              },
              required: ['a', 'b', 'operation']
            }
          }
        ]
      });
      getServerVersion = vi.fn().mockReturnValue({ name: 'Test SDK Server', version: '1.0.0' });
      callTool = vi.fn().mockImplementation(async (request) => {
        if (request.name === 'calculator') {
          const { a, b, operation } = request.arguments;
          switch (operation) {
            case 'add': return { result: a + b };
            case 'subtract': return { result: a - b };
            case 'multiply': return { result: a * b };
            default: throw new McpError(-32802, 'Invalid operation');
          }
        }
        throw new McpError(-32801, `Tool ${request.name} not found`);
      });
    }
  };
});

// 模拟传输
vi.mock('@utils/transports/transport-factory.js', () => {
  return {
    TransportFactory: {
      createTransport: vi.fn().mockReturnValue({
        onclose: null,
        onstdout: null,
        onstderr: null,
        close: vi.fn().mockResolvedValue(undefined)
      })
    }
  };
});

describe('MCP Protocol Contract - tools/call (with SDK)', () => {
  const serverName = 'test-sdk-server';
  let serverId: string;

  beforeEach(async () => {
    // 添加到 hub manager
    await hubManager.addServer(serverName, {
      command: 'node',
      args: [],
      enabled: true,
      type: 'stdio' as const,
      timeout: 60000
    });

    // 添加服务器实例
    const instance = await hubManager.addServerInstance(serverName, {});
    serverId = instance.id;
  });

  afterEach(async () => {
    await mcpConnectionManager.disconnect(serverId);
    hubManager.removeServer('test-sdk-server');
  });

  it('should execute tool with correct arguments', async () => {
    await mcpConnectionManager.connect({
      id: serverId,
      name: serverName,
      command: 'node',
      args: [],
      type: 'stdio'
    });

    const result = await mcpConnectionManager.callTool(
      serverId,
      'calculator',
      { a: 5, b: 3, operation: 'add' }
    );

    expect(result).toHaveProperty('result');
    expect(result.result).toBe(8);
  });

  it('should handle invalid parameters', async () => {
    await mcpConnectionManager.connect({
      id: serverId,
      name: serverName,
      command: 'node',
      args: [],
      type: 'stdio'
    });

    await expect(
      mcpConnectionManager.callTool(
        serverId,
        'calculator',
        { a: 5, b: 3 } // missing operation
      )
    ).rejects.toBeDefined();
  });

  it('should handle tool errors correctly', async () => {
    await mcpConnectionManager.connect({
      id: serverId,
      name: serverName,
      command: 'node',
      args: [],
      type: 'stdio'
    });

    await expect(
      mcpConnectionManager.callTool(
        serverId,
        'calculator',
        { a: 5, b: 3, operation: 'divide' } // invalid operation
      )
    ).rejects.toBeDefined();
  });

  it('should maintain isolation between calls', async () => {
    await mcpConnectionManager.connect({
      id: serverId,
      name: serverName,
      command: 'node',
      args: [],
      type: 'stdio'
    });

    const result1 = await mcpConnectionManager.callTool(
      serverId,
      'calculator',
      { a: 10, b: 5, operation: 'subtract' }
    );

    const result2 = await mcpConnectionManager.callTool(
      serverId,
      'calculator',
      { a: 3, b: 4, operation: 'multiply' }
    );

    expect(result1.result).toBe(5);
    expect(result2.result).toBe(12);
  });
});
