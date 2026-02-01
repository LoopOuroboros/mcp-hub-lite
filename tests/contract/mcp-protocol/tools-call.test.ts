import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
          }
        ]
      });
      getServerVersion = vi.fn().mockReturnValue({ name: 'Contract Test Server', version: '1.0.0' });
      callTool = vi.fn().mockImplementation(async (request) => {
        if (request.name === 'calculator') {
          const expr = request.arguments?.expression;
          if (!expr) {
            throw new McpError(-32602, 'Missing expression parameter');
          }

          // Simple evaluation (for testing purposes)
          try {
            const result = eval(expr); // In real implementation, this would be safer
            return { result };
          } catch (e) {
            throw new McpError(-32802, `Evaluation error: ${e}`);
          }
        }
        throw new McpError(-32801, `Tool ${request.name} not found`);
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

describe('MCP Protocol Contract - tools/call', () => {
  const testServer = {
    id: 'contract-test-server',
    name: 'Contract Test Server',
    command: 'node',
    args: ['test-server.js'],
    enabled: true,
    type: 'stdio' as const,
    longRunning: true,
    timeout: 60,
    allowedTools: ['calculator']
  };

  let tempConfigPath: string;

  beforeEach(async () => {
    // Create a temporary directory for test configuration
    const tempDir = path.join(os.tmpdir(), `mcp-hub-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    tempConfigPath = path.join(tempDir, '.mcp-hub.json');

    // Clean up any existing connections
    if (mcpConnectionManager.getStatus(testServer.id)?.connected) {
      await mcpConnectionManager.disconnect(testServer.id);
    }

    // Add server to hub manager
    hubManager.addServer(testServer.name, testServer);

    // Add server instance (id, timestamp, hash)
    hubManager.addServerInstance(testServer.name, {
      id: testServer.id,
      timestamp: Date.now(),
      hash: 'test-hash'
    });
  });

  afterEach(async () => {
    // Clean up connections
    if (mcpConnectionManager.getStatus(testServer.id)?.connected) {
      await mcpConnectionManager.disconnect(testServer.id);
    }
    hubManager.removeServer(testServer.name);

    // Clean up temporary configuration
    if (tempConfigPath && fs.existsSync(tempConfigPath)) {
      const tempDir = path.dirname(tempConfigPath);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should execute tool with valid arguments and return JSON-RPC 2.0 compliant result', async () => {
    await mcpConnectionManager.connect(testServer);

    const result = await mcpConnectionManager.callTool(
      testServer.id,
      'calculator',
      { expression: '2 + 2' }
    );

    expect(result).toHaveProperty('result');
    expect(result.result).toBe(4);
  });

  it('should return proper MCP error for invalid tool name', async () => {
    await mcpConnectionManager.connect(testServer);

    await expect(
      mcpConnectionManager.callTool(testServer.id, 'non-existent-tool', {})
    ).rejects.toThrowError(McpError);

    // The error should have the correct MCP error code
    try {
      await mcpConnectionManager.callTool(testServer.id, 'non-existent-tool', {});
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).code).toBe(-32801); // Tool not found
    }
  });

  it('should return proper MCP error for invalid arguments', async () => {
    await mcpConnectionManager.connect(testServer);

    await expect(
      mcpConnectionManager.callTool(testServer.id, 'calculator', {})
    ).rejects.toThrowError(McpError);

    try {
      await mcpConnectionManager.callTool(testServer.id, 'calculator', {});
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).code).toBe(-32602); // Invalid params
    }
  });

  it('should handle execution errors with proper MCP error code', async () => {
    await mcpConnectionManager.connect(testServer);

    await expect(
      mcpConnectionManager.callTool(testServer.id, 'calculator', { expression: 'invalid syntax' })
    ).rejects.toThrowError(McpError);

    try {
      await mcpConnectionManager.callTool(testServer.id, 'calculator', { expression: 'invalid syntax' });
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).code).toBe(-32802); // Execution failed
    }
  });

  it('should maintain tool execution isolation between calls', async () => {
    await mcpConnectionManager.connect(testServer);

    const result1 = await mcpConnectionManager.callTool(
      testServer.id,
      'calculator',
      { expression: '1 + 1' }
    );

    const result2 = await mcpConnectionManager.callTool(
      testServer.id,
      'calculator',
      { expression: '2 * 3' }
    );

    expect(result1.result).toBe(2);
    expect(result2.result).toBe(6);
    expect(result1.result).not.toBe(result2.result);
  });
});