import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { configManager } from '@config/config-manager.js';
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
  let mockServerInstance: { id: string; index: number; timestamp: number };

  beforeEach(async () => {
    // Clear mock call history
    vi.clearAllMocks();

    // Mock config to reduce retry delay in tests (maxRetries: 1, delay: 10ms)
    vi.spyOn(configManager, 'getConfig').mockReturnValue({
      system: {
        startup: {
          maxConnectRetries: 1,
          connectRetryDelay: 10
        }
      }
    } as ReturnType<typeof configManager.getConfig>);

    // Add test server (v1.1 format)
    await hubManager.addServer('test-server', {
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 60000,
      aggregatedTools: []
    });

    // Add server instance
    const instance = (await hubManager.addServerInstance('test-server', {})) as unknown as {
      id: string;
      index: number;
      timestamp: number;
    };
    mockServerInstance = {
      id: instance.id,
      index: instance.index,
      timestamp: instance.timestamp || Date.now()
    };
  });

  it('should handle connection failure gracefully', async () => {
    // Use mockRejectedValue instead of mockRejectedValueOnce to avoid retry delay
    mockConnect.mockRejectedValue(new Error('Connection failed'));

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

    const success = await mcpConnectionManager.connect(serverInfo.name, mockServerInstance.index, {
      ...resolvedConfig,
      id: mockServerInstance.id,
      timestamp: Date.now()
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(serverInfo.name, mockServerInstance.index);
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

    const success = await mcpConnectionManager.connect(serverInfo.name, mockServerInstance.index, {
      ...resolvedConfig,
      id: mockServerInstance.id,
      timestamp: Date.now()
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(serverInfo.name, mockServerInstance.index);
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
      aggregatedTools: []
    });
    const workingInstance = (await hubManager.addServerInstance(
      'working-server',
      {}
    )) as unknown as {
      id: string;
      index: number;
      timestamp: number;
    };

    // Simulate first server failure, second server success
    mockConnect
      .mockImplementationOnce(() => Promise.reject(new Error('First server failed')))
      .mockImplementationOnce(() => Promise.resolve());

    mockListTools
      .mockImplementationOnce(() => Promise.resolve({ tools: [] })) // First server
      .mockImplementationOnce(() => Promise.resolve({ tools: [] })); // Second server

    // Connect first server (should fail)
    const serverInfo1 = hubManager.getServerById(mockServerInstance.id);
    if (!serverInfo1) {
      throw new Error('Server 1 not found');
    }
    const resolvedConfig1 = resolveInstanceConfig(serverInfo1.config, mockServerInstance.id);
    if (!resolvedConfig1) {
      throw new Error('Failed to resolve server 1 configuration');
    }
    await mcpConnectionManager.connect(serverInfo1.name, mockServerInstance.index, {
      ...resolvedConfig1,
      id: mockServerInstance.id,
      timestamp: Date.now()
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
    const success2 = await mcpConnectionManager.connect(serverInfo2.name, workingInstance.index, {
      ...resolvedConfig2,
      id: workingInstance.id,
      timestamp: Date.now()
    });

    expect(success2).toBe(true);
    const status1 = mcpConnectionManager.getStatus(serverInfo1.name, mockServerInstance.index);
    const status2 = mcpConnectionManager.getStatus(serverInfo2.name, workingInstance.index);

    expect(status1?.connected).toBe(false);
    expect(status2?.connected).toBe(true);
  });
});
