import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { resolveInstanceConfig } from '@config/config-migrator.js';

// Mock MCP SDK
const mockListTools = vi.fn().mockResolvedValue({ tools: [] });

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

describe('MCP Protocol Contract - tools/list (with SDK)', () => {
  const serverName = 'test-sdk-server';
  let serverId: string;

  beforeEach(async () => {
    // Add to hub manager (v1.1 format)
    await hubManager.addServer(serverName, {
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 60000,
      aggregatedTools: []
    });

    // Add server instance
    const instance = await hubManager.addServerInstance(serverName, {});
    serverId = instance.id;
  });

  afterEach(async () => {
    await mcpConnectionManager.disconnect(serverId);
    hubManager.removeServer(serverName);
  });

  it('should return tools with correct MCP schema', async () => {
    // Mock returning 2 tools, including calculator tool
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
      timestamp: Date.now()
    });

    const tools = mcpConnectionManager.getTools(serverId);

    expect(tools).toHaveLength(2);

    // Verify calculator tool
    const calculator = tools.find((t) => t.name === 'calculator');
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
      timestamp: Date.now()
    });

    const tools1 = mcpConnectionManager.getTools(serverId);
    const tools2 = mcpConnectionManager.getTools(serverId);

    expect(tools1).toEqual(tools2);
    expect(tools1[0]).toBe(tools2[0]); // Reference equality
  });

  it('should handle empty tool list', async () => {
    // Simulate empty tool list
    mockListTools.mockResolvedValueOnce({ tools: [] });

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
      timestamp: Date.now()
    });

    const tools = mcpConnectionManager.getTools(serverId);
    expect(tools).toHaveLength(0);
  });
});
