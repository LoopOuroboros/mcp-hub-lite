import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';

// We need to mock BEFORE import
const mockConnect = vi.fn();
const mockListTools = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class {
      connect = mockConnect;
      close = vi.fn().mockResolvedValue(undefined);
      listTools = mockListTools;
      callTool = vi.fn();
      getServerVersion = vi.fn().mockReturnValue({ name: 'Test Server', version: '1.0.0' });
    }
  };
});

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => {
  return {
    StdioClientTransport: class {
      close = vi.fn().mockResolvedValue(undefined);
    }
  };
});

describe('Fault Tolerance', () => {
  const mockServerConfig = {
    command: 'node',
    args: ['server.js'],
    enabled: true,
    type: 'stdio' as const,
    longRunning: true,
    timeout: 60,
    allowedTools: []
  };
  const mockServerName = 'Faulty Server';
  let mockServerInstance: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // 添加测试服务器
    await hubManager.addServer(mockServerName, mockServerConfig);
    // 添加服务器实例
    const instances = hubManager.getServerInstanceByName(mockServerName);
    if (instances.length === 0) {
      mockServerInstance = await hubManager.addServerInstance(mockServerName, {
        id: 'faulty-server',
        timestamp: Date.now(),
        hash: 'faulty-hash'
      });
    } else {
      mockServerInstance = instances[0];
    }
  });

  afterEach(async () => {
    // 清理测试服务器
    await hubManager.removeServer(mockServerName);
  });

  it('should handle connection failure gracefully', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

    // 直接使用hubManager.getServerById获取完整的服务器配置
    const serverInfo = hubManager.getServerById(mockServerInstance.id);
    const success = await mcpConnectionManager.connect({
      ...serverInfo!.config,
      ...serverInfo!.instance,
      name: serverInfo!.name
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('Connection failed');
  });

  it('should handle listTools failure gracefully', async () => {
    mockConnect.mockResolvedValueOnce(undefined);
    mockListTools.mockRejectedValueOnce(new Error('List tools failed'));

    // 直接使用hubManager.getServerById获取完整的服务器配置
    const serverInfo = hubManager.getServerById(mockServerInstance.id);
    const success = await mcpConnectionManager.connect({
      ...serverInfo!.config,
      ...serverInfo!.instance,
      name: serverInfo!.name
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('List tools failed');
  });
});
