import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { resolveInstanceConfig } from '@config/config-migrator.js';

// Mock MCP SDK Client
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

// Mock transport factory
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

describe('Gateway Fault Tolerance', () => {
  let mockServerInstance: { id: string; timestamp: number; hash: string };

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Add test server (v1.1 format)
    await hubManager.addServer('test-server', {
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });

    // Add server instance
    const instance = (await hubManager.addServerInstance('test-server', {})) as unknown as {
      id: string;
      timestamp: number;
      hash: string;
    };
    mockServerInstance = {
      id: instance.id,
      timestamp: instance.timestamp || Date.now(),
      hash: instance.hash || 'test-hash'
    };
  });

  it('should handle connection failure gracefully', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

    // Directly use hubManager.getServerById to get complete server configuration
    const serverInfo = hubManager.getServerById(mockServerInstance.id);
    if (!serverInfo) {
      throw new Error('Server not found');
    }

    // Resolve the complete configuration using v1.1 resolveInstanceConfig
    const resolvedConfig = resolveInstanceConfig(serverInfo.config, mockServerInstance.id);
    if (!resolvedConfig) {
      throw new Error('Failed to resolve server configuration');
    }

    const success = await mcpConnectionManager.connect({
      ...resolvedConfig,
      id: mockServerInstance.id,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('Connection failed');
  });

  it('should handle listTools failure gracefully', async () => {
    mockConnect.mockResolvedValueOnce(undefined);
    mockListTools.mockRejectedValueOnce(new Error('List tools failed'));

    // Directly use hubManager.getServerById to get complete server configuration
    const serverInfo = hubManager.getServerById(mockServerInstance.id);
    if (!serverInfo) {
      throw new Error('Server not found');
    }

    // Resolve the complete configuration using v1.1 resolveInstanceConfig
    const resolvedConfig = resolveInstanceConfig(serverInfo.config, mockServerInstance.id);
    if (!resolvedConfig) {
      throw new Error('Failed to resolve server configuration');
    }

    const success = await mcpConnectionManager.connect({
      ...resolvedConfig,
      id: mockServerInstance.id,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('List tools failed');
  });

  it('should not affect other servers when one fails', async () => {
    // Add second server (v1.1 format)
    await hubManager.addServer('working-server', {
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });
    const workingInstance = await hubManager.addServerInstance('working-server', {});

    // Simulate first server failure, second server success
    mockConnect
      .mockImplementationOnce(() => Promise.reject(new Error('First server failed')))
      .mockImplementationOnce(() => Promise.resolve());

    mockListTools.mockImplementationOnce(() => Promise.resolve({ tools: [] }));

    // Connect first server (should fail)
    const serverInfo1 = hubManager.getServerById(mockServerInstance.id);
    if (!serverInfo1) {
      throw new Error('Server 1 not found');
    }
    const resolvedConfig1 = resolveInstanceConfig(serverInfo1.config, mockServerInstance.id);
    if (!resolvedConfig1) {
      throw new Error('Failed to resolve server 1 configuration');
    }
    await mcpConnectionManager.connect({
      ...resolvedConfig1,
      id: mockServerInstance.id,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    // Connect second server (should succeed)
    const serverInfo2 = hubManager.getServerById(workingInstance.id);
    if (!serverInfo2) {
      throw new Error('Server 2 not found');
    }
    const resolvedConfig2 = resolveInstanceConfig(serverInfo2.config, workingInstance.id);
    if (!resolvedConfig2) {
      throw new Error('Failed to resolve server 2 configuration');
    }
    const success2 = await mcpConnectionManager.connect({
      ...resolvedConfig2,
      id: workingInstance.id,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    expect(success2).toBe(true);
    const status1 = mcpConnectionManager.getStatus(mockServerInstance.id);
    const status2 = mcpConnectionManager.getStatus(workingInstance.id);

    expect(status1?.connected).toBe(false);
    expect(status2?.connected).toBe(true);
  });
});
