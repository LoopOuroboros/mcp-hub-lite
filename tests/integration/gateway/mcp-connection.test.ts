import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mcpConnectionManager } from '../../../src/services/mcp-connection-manager.js';
import { simpleSearchService } from '../../../src/services/simple-search.service.js';
import { configManager } from '../../../src/config/config-manager.js';

// Mock SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class {
      connect = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      listTools = vi.fn().mockResolvedValue({
        tools: [
          { name: 'test-tool', description: 'A test tool', inputSchema: {} }
        ]
      });
      getServerVersion = vi.fn().mockReturnValue({ version: '1.0.0' });
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

describe('McpConnectionManager', () => {
  const mockServer = {
    id: 'test-server-1',
    name: 'Test Server',
    command: 'node',
    args: ['test-script.js'],
    enabled: true,
    type: 'stdio' as const,
    longRunning: true,
    timeout: 60
  };

  beforeEach(async () => {
    // Clean up
    if (mcpConnectionManager.getStatus(mockServer.id)?.connected) {
        await mcpConnectionManager.disconnect(mockServer.id);
    }
  });

  afterEach(async () => {
    // Clean up and restore original config
    if (mcpConnectionManager.getStatus(mockServer.id)?.connected) {
        await mcpConnectionManager.disconnect(mockServer.id);
    }
  });

  it('should connect to a server', async () => {
    const success = await mcpConnectionManager.connect(mockServer);
    expect(success).toBe(true);
    
    const status = mcpConnectionManager.getStatus(mockServer.id);
    expect(status?.connected).toBe(true);
    expect(status?.version).toBe('1.0.0');
  });

  it('should list tools after connection', async () => {
    await mcpConnectionManager.connect(mockServer);
    const tools = mcpConnectionManager.getTools(mockServer.id);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('test-tool');
  });

  it('should disconnect from a server', async () => {
    await mcpConnectionManager.connect(mockServer);
    await mcpConnectionManager.disconnect(mockServer.id);
    
    const status = mcpConnectionManager.getStatus(mockServer.id);
    expect(status?.connected).toBe(false);
  });
});

describe('SimpleSearchService', () => {
    it('should search tools', () => {
         // Placeholder
    });

    it('should find tool by name', async () => {
        const mockServer = {
            id: 'search-test-server',
            name: 'Search Test',
            command: 'node',
            args: [],
            enabled: true,
            type: 'stdio' as const,
            longRunning: true,
            timeout: 60
        };

        await mcpConnectionManager.connect(mockServer);

        const results = simpleSearchService.search('test');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].tool.name).toBe('test-tool');

        // Clean up
        await mcpConnectionManager.disconnect(mockServer.id);
    });
});
