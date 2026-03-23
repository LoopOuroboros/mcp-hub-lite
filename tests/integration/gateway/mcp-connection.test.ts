import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { simpleSearchService } from '@services/simple-search.service.js';
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

describe('MCP Connection Integration', () => {
  const serverName = 'test-mcp-server';
  let serverId: string;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Add test server (v1.1 format)
    await hubManager.addServer(serverName, {
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });

    // Add server instance
    const instance = await hubManager.addServerInstance(serverName, {});
    serverId = instance.id;
  });

  afterEach(async () => {
    await mcpConnectionManager.disconnect(serverId);
    hubManager.removeServer(serverName);
  });

  it('should establish MCP connection successfully', async () => {
    mockConnect.mockResolvedValueOnce(undefined);
    mockListTools.mockResolvedValueOnce({ tools: [] });

    const serverInfo = hubManager.getServerById(serverId);
    if (!serverInfo) {
      throw new Error('Server not found');
    }
    const resolvedConfig = resolveInstanceConfig(serverInfo.config, serverId);
    if (!resolvedConfig) {
      throw new Error('Failed to resolve server configuration');
    }
    const success = await mcpConnectionManager.connect({
      ...resolvedConfig,
      id: serverId,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    expect(success).toBe(true);
    const status = mcpConnectionManager.getStatus(serverId);
    expect(status?.connected).toBe(true);
  });

  it('should handle connection errors properly', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

    const serverInfo = hubManager.getServerById(serverId);
    if (!serverInfo) {
      throw new Error('Server not found');
    }
    const resolvedConfig = resolveInstanceConfig(serverInfo.config, serverId);
    if (!resolvedConfig) {
      throw new Error('Failed to resolve server configuration');
    }
    const success = await mcpConnectionManager.connect({
      ...resolvedConfig,
      id: serverId,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(serverId);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('Connection refused');
  });

  it('should support concurrent connections', async () => {
    // Add second server (v1.1 format)
    const server2Name = 'test-mcp-server-2';
    await hubManager.addServer(server2Name, {
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });
    const instance2 = await hubManager.addServerInstance(server2Name, {});

    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({ tools: [] });

    const serverInfo1 = hubManager.getServerById(serverId);
    const serverInfo2 = hubManager.getServerById(instance2.id);
    if (!serverInfo1 || !serverInfo2) {
      throw new Error('Server not found');
    }
    const resolvedConfig1 = resolveInstanceConfig(serverInfo1.config, serverId);
    const resolvedConfig2 = resolveInstanceConfig(serverInfo2.config, instance2.id);
    if (!resolvedConfig1 || !resolvedConfig2) {
      throw new Error('Failed to resolve server configuration');
    }

    const [success1, success2] = await Promise.all([
      mcpConnectionManager.connect({
        ...resolvedConfig1,
        id: serverId,
        timestamp: Date.now(),
        hash: 'test-hash'
      }),
      mcpConnectionManager.connect({
        ...resolvedConfig2,
        id: instance2.id,
        timestamp: Date.now(),
        hash: 'test-hash-2'
      })
    ]);

    expect(success1).toBe(true);
    expect(success2).toBe(true);

    const status1 = mcpConnectionManager.getStatus(serverId);
    const status2 = mcpConnectionManager.getStatus(instance2.id);

    expect(status1?.connected).toBe(true);
    expect(status2?.connected).toBe(true);

    // Clean up
    await mcpConnectionManager.disconnect(instance2.id);
    await hubManager.removeServer(server2Name);
  });

  it('should integrate with search service', async () => {
    // Set up mock tool data
    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({
      tools: [
        {
          name: 'test-tool',
          description: 'A test tool for searching',
          inputSchema: { type: 'object', properties: { query: { type: 'string' } } }
        }
      ]
    });

    const searchServerName = 'search-test-server';
    await hubManager.addServer(searchServerName, {
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });
    const searchServerInstance = await hubManager.addServerInstance(searchServerName, {});

    const serverInfo = hubManager.getServerById(searchServerInstance.id);
    if (!serverInfo) {
      throw new Error('Server not found');
    }
    const resolvedConfig = resolveInstanceConfig(serverInfo.config, searchServerInstance.id);
    if (!resolvedConfig) {
      throw new Error('Failed to resolve server configuration');
    }
    await mcpConnectionManager.connect({
      ...resolvedConfig,
      id: searchServerInstance.id,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    const results = simpleSearchService.search('test');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tool.name).toBe('test-tool');

    // Clean up
    await mcpConnectionManager.disconnect(searchServerInstance.id);
    await hubManager.removeServer(searchServerName);
  });
});
