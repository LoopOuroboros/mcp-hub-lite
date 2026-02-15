import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { simpleSearchService } from '@services/simple-search.service.js';

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

    // Add test server
    await hubManager.addServer(serverName, {
      command: 'node',
      args: [],
      enabled: true,
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
    const success = await mcpConnectionManager.connect({
      ...serverInfo!.config,
      ...serverInfo!.instance
    });

    expect(success).toBe(true);
    const status = mcpConnectionManager.getStatus(serverId);
    expect(status?.connected).toBe(true);
  });

  it('should handle connection errors properly', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

    const serverInfo = hubManager.getServerById(serverId);
    const success = await mcpConnectionManager.connect({
      ...serverInfo!.config,
      ...serverInfo!.instance
    });

    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(serverId);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('Connection refused');
  });

  it('should support concurrent connections', async () => {
    // Add second server
    const server2Name = 'test-mcp-server-2';
    await hubManager.addServer(server2Name, {
      command: 'node',
      args: [],
      enabled: true,
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });
    const instance2 = await hubManager.addServerInstance(server2Name, {});

    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({ tools: [] });

    const serverInfo1 = hubManager.getServerById(serverId);
    const serverInfo2 = hubManager.getServerById(instance2.id);

    const [success1, success2] = await Promise.all([
      mcpConnectionManager.connect({
        ...serverInfo1!.config,
        ...serverInfo1!.instance
      }),
      mcpConnectionManager.connect({
        ...serverInfo2!.config,
        ...serverInfo2!.instance
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
      enabled: true,
      type: 'stdio' as const,
      timeout: 60000,
      allowedTools: []
    });
    const searchServerInstance = await hubManager.addServerInstance(searchServerName, {});

    const serverInfo = hubManager.getServerById(searchServerInstance.id);
    await mcpConnectionManager.connect({
      ...serverInfo!.config,
      ...serverInfo!.instance
    });

    const results = simpleSearchService.search('test');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tool.name).toBe('test-tool');

    // Clean up
    await mcpConnectionManager.disconnect(searchServerInstance.id);
    await hubManager.removeServer(searchServerName);
  });
});
