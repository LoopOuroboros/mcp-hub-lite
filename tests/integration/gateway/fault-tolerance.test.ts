import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';

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

import type { ServerInstanceConfig } from '@shared-models/server.model.js';

describe('Gateway Fault Tolerance', () => {
  let mockServerInstance: ServerInstanceConfig;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Add test server
    await hubManager.addServer('test-server', {
      command: 'node',
      args: [],
      enabled: true,
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });

    // Add server instance
    mockServerInstance = await hubManager.addServerInstance('test-server', {});
  });

  it('should handle connection failure gracefully', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection failed'));

    // Directly use hubManager.getServerById to get complete server configuration
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

    // Directly use hubManager.getServerById to get complete server configuration
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
    // Add second server
    await hubManager.addServer('working-server', {
      command: 'node',
      args: [],
      enabled: true,
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
    await mcpConnectionManager.connect({
      ...serverInfo1!.config,
      ...serverInfo1!.instance
    });

    // Connect second server (should succeed)
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
