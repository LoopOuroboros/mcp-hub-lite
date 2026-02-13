import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';

// 模拟 MCP SDK Client
const mockConnect = vi.fn();
const mockClose = vi.fn();
const mockListTools = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class {
      connect = mockConnect;
      close = mockClose;
      listTools = mockListTools;
      getServerVersion = vi.fn().mockReturnValue({ name: 'Test Server', version: '1.0.0' });
    }
  };
});

// 模拟传输工厂
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

import type { ServerInstanceConfig } from '@shared-models/server.model.js';

describe('Gateway Fault Tolerance', () => {
  let mockServerInstance: ServerInstanceConfig;

  beforeEach(async () => {
    // 清除所有模拟
    vi.clearAllMocks();

    // 添加测试服务器
    await hubManager.addServer('test-server', {
      command: 'node',
      args: [],
      enabled: true,
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });

    // 添加服务器实例
    mockServerInstance = await hubManager.addServerInstance('test-server', {});
  });

  it('should handle connection failure gracefully', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

    // 直接使用hubManager.getServerById获取完整的服务器配置
    const serverInfo = hubManager.getServerById(mockServerInstance.id);
    const success = await mcpConnectionManager.connect({
      ...serverInfo!.config,
      ...serverInfo!.instance
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
      ...serverInfo!.instance
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('List tools failed');
  });

  it('should not affect other servers when one fails', async () => {
    // 添加第二个服务器
    await hubManager.addServer('working-server', {
      command: 'node',
      args: [],
      enabled: true,
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });
    const workingInstance = await hubManager.addServerInstance('working-server', {});

    // 模拟第一个服务器失败，第二个成功
    mockConnect.mockImplementationOnce(() => Promise.reject(new Error('First server failed')))
                .mockImplementationOnce(() => Promise.resolve());

    mockListTools.mockImplementationOnce(() => Promise.resolve({ tools: [] }));

    // 连接第一个服务器（应该失败）
    const serverInfo1 = hubManager.getServerById(mockServerInstance.id);
    await mcpConnectionManager.connect({
      ...serverInfo1!.config,
      ...serverInfo1!.instance
    });

    // 连接第二个服务器（应该成功）
    const serverInfo2 = hubManager.getServerById(workingInstance.id);
    const success2 = await mcpConnectionManager.connect({
      ...serverInfo2!.config,
      ...serverInfo2!.instance
    });

    expect(success2).toBe(true);
    const status1 = mcpConnectionManager.getStatus(mockServerInstance.id);
    const status2 = mcpConnectionManager.getStatus(workingInstance.id);

    expect(status1?.connected).toBe(false);
    expect(status2?.connected).toBe(true);
  });
});