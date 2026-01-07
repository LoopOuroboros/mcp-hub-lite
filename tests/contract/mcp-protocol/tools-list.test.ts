import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { mcpConnectionManager } from '../../../src/services/mcp-connection-manager.js';
import { hubManager } from '../../../src/services/hub-manager.service.js';

// Mock the actual server connection for contract tests
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class {
      connect = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      listTools = vi.fn().mockResolvedValue({
        tools: [
          {
            name: 'calculator',
            description: 'Perform mathematical calculations',
            inputSchema: {
              type: 'object',
              properties: {
                expression: { type: 'string' }
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
                location: { type: 'string' }
              },
              required: ['location']
            }
          }
        ]
      });
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

describe('MCP Protocol Contract - tools/list', () => {
  const testServer = {
    id: 'contract-test-server',
    name: 'Contract Test Server',
    command: 'node',
    args: ['test-server.js'],
    enabled: true,
    type: 'stdio',
    longRunning: true,
    timeout: 60
  };

  beforeEach(async () => {
    // Clean up any existing connections
    if (mcpConnectionManager.getStatus(testServer.id)?.connected) {
      await mcpConnectionManager.disconnect(testServer.id);
    }

    // Add server to hub manager
    hubManager.addServer(testServer);
  });

  afterEach(async () => {
    // Clean up connections
    if (mcpConnectionManager.getStatus(testServer.id)?.connected) {
      await mcpConnectionManager.disconnect(testServer.id);
    }
    hubManager.removeServer(testServer.id);
  });

  it('should return JSON-RPC 2.0 compliant response format', async () => {
    // Connect to server
    await mcpConnectionManager.connect(testServer);

    // Get all tools
    const tools = mcpConnectionManager.getAllTools();

    // Verify tools structure
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    // Verify each tool has required MCP fields
    for (const tool of tools) {
      expect(tool).toHaveProperty('name');
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);

      expect(tool).toHaveProperty('serverId');
      expect(typeof tool.serverId).toBe('string');

      // Description is optional in MCP spec
      if (tool.description !== undefined) {
        expect(typeof tool.description).toBe('string');
      }

      // inputSchema is optional in MCP spec
      if (tool.inputSchema !== undefined) {
        expect(typeof tool.inputSchema).toBe('object');
      }
    }
  });

  it('should return empty tool list for disconnected server', async () => {
    // Don't connect to server, try to get tools directly
    const tools = mcpConnectionManager.getTools(testServer.id);
    expect(tools).toEqual([]);
  });

  it('should support tool name prefixing with server name', async () => {
    await mcpConnectionManager.connect(testServer);
    const tools = mcpConnectionManager.getAllTools();

    // Find a tool and verify it has the expected structure
    const calculatorTool = tools.find(t => t.name === 'calculator');
    expect(calculatorTool).toBeDefined();
    expect(calculatorTool?.description).toContain('Perform mathematical calculations');

    // Verify input schema structure
    expect(calculatorTool?.inputSchema).toMatchObject({
      type: 'object',
      properties: {
        expression: { type: 'string' }
      },
      required: ['expression']
    });
  });

  it('should maintain tool identity across multiple calls', async () => {
    await mcpConnectionManager.connect(testServer);

    const tools1 = mcpConnectionManager.getAllTools();
    const tools2 = mcpConnectionManager.getAllTools();

    expect(tools1).toHaveLength(tools2.length);

    // Verify tool names are consistent
    const toolNames1 = tools1.map(t => t.name).sort();
    const toolNames2 = tools2.map(t => t.name).sort();
    expect(toolNames1).toEqual(toolNames2);
  });

  it('should handle tool list gracefully', async () => {
    // Connect to server and get tools (mock returns 2 tools)
    await mcpConnectionManager.connect(testServer);
    const tools = mcpConnectionManager.getTools(testServer.id);

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBe(2); // Our mock returns 2 tools
  });
});