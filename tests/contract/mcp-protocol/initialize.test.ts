import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { resolveInstanceConfig } from '@config/config-migrator.js';

// Mock MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class {
      connect = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      listTools = vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'echo',
            description: 'Echo the input',
            inputSchema: {
              type: 'object',
              properties: { message: { type: 'string' } }
            }
          }
        ]
      });
      getServerVersion = vi.fn().mockReturnValue({ name: 'Test SDK Server', version: '1.0.0' });
    }
  };
});

// Mock transport
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

describe('MCP Protocol Contract - initialize (with SDK)', () => {
  const serverName = 'test-sdk-server';
  let serverId: string;

  beforeEach(async () => {
    // Add to hub manager (v1.1 format)
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

  it('should correctly initialize MCP connection with SDK', async () => {
    // Get server configuration and instance configuration
    const serverInfo = hubManager.getServerById(serverId);
    if (!serverInfo) {
      throw new Error('Server not found');
    }

    // Resolve the complete configuration using v1.1 resolveInstanceConfig
    const resolvedConfig = resolveInstanceConfig(serverInfo.config, serverId);
    if (!resolvedConfig) {
      throw new Error('Failed to resolve server configuration');
    }

    await mcpConnectionManager.connect({
      ...resolvedConfig,
      id: serverId,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    const status = mcpConnectionManager.getStatus(serverId);
    expect(status?.connected).toBe(true);
    expect(status?.version).toBe('1.0.0');
  });

  it('should list tools using SDK Client', async () => {
    // Get server configuration and instance configuration
    const serverInfo = hubManager.getServerById(serverId);
    if (!serverInfo) {
      throw new Error('Server not found');
    }

    // Resolve the complete configuration using v1.1 resolveInstanceConfig
    const resolvedConfig = resolveInstanceConfig(serverInfo.config, serverId);
    if (!resolvedConfig) {
      throw new Error('Failed to resolve server configuration');
    }

    await mcpConnectionManager.connect({
      ...resolvedConfig,
      id: serverId,
      timestamp: Date.now(),
      hash: 'test-hash'
    });

    const tools = mcpConnectionManager.getTools(serverId);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('echo');
    expect(tools[0].description).toBe('Echo the input');
  });
});
