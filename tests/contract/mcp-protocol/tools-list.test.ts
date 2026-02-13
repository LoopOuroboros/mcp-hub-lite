import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';

// 模拟 MCP SDK
const mockListTools = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class {
      connect = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      listTools = mockListTools;
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
      timeout: 60000,
      allowedTools: []
    });

    // 添加服务器实例
    const instance = await hubManager.addServerInstance(serverName, {});
    serverId = instance.id;
  });

  afterEach(async () => {
    await mcpConnectionManager.disconnect(serverId);
    hubManager.removeServer(serverName);
  });

  it('should return tools with correct MCP schema', async () => {
    // 模拟返回2个工具，包括 calculator 工具
    mockListTools.mockResolvedValueOnce({
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
          description: 'Get current weather information',
          inputSchema: {
            type: 'object',
            properties: {
              location: { type: 'string' },
              units: { type: 'string', enum: ['metric', 'imperial'], default: 'metric' }
            },
            required: ['location']
          }
        }
      ]
    });

    // 获取服务器配置和实例配置
    const serverInfo = hubManager.getServerById(serverId);
    if (!serverInfo) {
      throw new Error('Server not found');
    }

    await mcpConnectionManager.connect({
      id: serverId,
      command: serverInfo.config.command,
      args: serverInfo.config.args,
      enabled: serverInfo.config.enabled,
      type: serverInfo.config.type,
      timeout: serverInfo.config.timeout,
      allowedTools: serverInfo.config.allowedTools,
      timestamp: serverInfo.instance.timestamp,
      hash: serverInfo.instance.hash
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
    // 获取服务器配置和实例配置
    const serverInfo = hubManager.getServerById(serverId);
    if (!serverInfo) {
      throw new Error('Server not found');
    }

    await mcpConnectionManager.connect({
      id: serverId,
      command: serverInfo.config.command,
      args: serverInfo.config.args,
      enabled: serverInfo.config.enabled,
      type: serverInfo.config.type,
      timeout: serverInfo.config.timeout,
      allowedTools: serverInfo.config.allowedTools,
      timestamp: serverInfo.instance.timestamp,
      hash: serverInfo.instance.hash
    });

    const tools1 = mcpConnectionManager.getTools(serverId);
    const tools2 = mcpConnectionManager.getTools(serverId);

    expect(tools1).toEqual(tools2);
    expect(tools1[0]).toBe(tools2[0]); // 引用相等
  });

  it('should handle empty tool list', async () => {
    // 模拟空工具列表
    mockListTools.mockResolvedValueOnce({ tools: [] });

    // 获取服务器配置和实例配置
    const serverInfo = hubManager.getServerById(serverId);
    if (!serverInfo) {
      throw new Error('Server not found');
    }

    await mcpConnectionManager.connect({
      id: serverId,
      command: serverInfo.config.command,
      args: serverInfo.config.args,
      enabled: serverInfo.config.enabled,
      type: serverInfo.config.type,
      timeout: serverInfo.config.timeout,
      allowedTools: serverInfo.config.allowedTools,
      timestamp: serverInfo.instance.timestamp,
      hash: serverInfo.instance.hash
    });

    const tools = mcpConnectionManager.getTools(serverId);
    expect(tools).toHaveLength(0);
  });
});