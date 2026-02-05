import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
            description: 'Perform mathematical calculations',
            inputSchema: {
              type: 'object',
              properties: {
                expression: { type: 'string' },
                precision: { type: 'number', default: 2 }
              },
              required: ['expression']
            }
          },
          {
            name: 'weather',
            description: 'Get weather information',
            inputSchema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
                unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
              },
              required: ['location']
            }
          }
        ]
      });
      getServerVersion = vi.fn().mockReturnValue({ name: 'Test SDK Server', version: '1.0.0' });
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

describe('MCP Protocol Contract - tools/list (with SDK)', () => {
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

  it('should return tools with correct MCP schema', async () => {
    await mcpConnectionManager.connect({
      id: serverId,
      name: serverName,
      command: 'node',
      args: [],
      type: 'stdio'
    });

    const tools = mcpConnectionManager.getTools(serverId);

    expect(tools).toHaveLength(2);

    // 验证 calculator 工具
    const calculator = tools.find(t => t.name === 'calculator');
    expect(calculator).toBeDefined();
    expect(calculator?.description).toBe('Perform mathematical calculations');
    expect(calculator?.inputSchema).toMatchObject({
      type: 'object',
      properties: expect.objectContaining({
        expression: { type: 'string' },
        precision: { type: 'number', default: 2 }
      }),
      required: ['expression']
    });
  });

  it('should maintain tool identity across calls', async () => {
    await mcpConnectionManager.connect({
      id: serverId,
      name: serverName,
      command: 'node',
      args: [],
      type: 'stdio'
    });

    const tools1 = mcpConnectionManager.getTools(serverId);
    const tools2 = await mcpConnectionManager.refreshTools(serverId);

    expect(tools1).toHaveLength(tools2.length);
    expect(tools1.map(t => t.name)).toEqual(tools2.map(t => t.name));
  });
});
