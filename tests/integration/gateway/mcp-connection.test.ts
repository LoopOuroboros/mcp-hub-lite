import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { simpleSearchService } from '@services/simple-search.service.js';
import { hubManager } from '@services/hub-manager.service.js';

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

import { eventBus, EventTypes } from '@services/event-bus.service.js';

describe('McpConnectionManager', () => {
  const mockServerConfig = {
    command: 'node',
    args: ['test-script.js'],
    enabled: true,
    type: 'stdio' as const,
    timeout: 60,
    allowedTools: ['test-tool']
  };
  const mockServerName = 'Test Server';
  let mockServerInstance: any;

  beforeEach(async () => {
    // 添加测试服务器
    await hubManager.addServer(mockServerName, mockServerConfig);
    // 添加服务器实例
    const instances = hubManager.getServerInstanceByName(mockServerName);
    if (instances.length === 0) {
      mockServerInstance = await hubManager.addServerInstance(mockServerName, {
        id: 'test-server-1',
        timestamp: Date.now(),
        hash: 'test-hash'
      });
    } else {
      mockServerInstance = instances[0];
    }
  });

  afterEach(async () => {
    // 清理测试服务器
    await hubManager.removeServer(mockServerName);
  });

  it('should auto-disconnect when server is deleted', async () => {
    // 1. Connect to server
    await mcpConnectionManager.connect({
      ...mockServerConfig,
      ...mockServerInstance,
      name: mockServerName
    });
    const statusBefore = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(statusBefore?.connected).toBe(true);

    // 2. Publish server deleted event
    eventBus.publish(EventTypes.SERVER_DELETED, mockServerName);

    // 3. Wait briefly for event to be processed
    await new Promise(resolve => setTimeout(resolve, 10));

    // 4. Check if server is disconnected
    const statusAfter = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(statusAfter?.connected).toBe(false);
  });

  it('should connect to a server', async () => {
    const success = await mcpConnectionManager.connect({
      ...mockServerConfig,
      ...mockServerInstance,
      name: mockServerName
    });
    expect(success).toBe(true);

    const status = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(status?.connected).toBe(true);
    expect(status?.version).toBe('1.0.0');
  });

  it('should list tools after connection', async () => {
    await mcpConnectionManager.connect({
      ...mockServerConfig,
      ...mockServerInstance,
      name: mockServerName
    });
    const tools = mcpConnectionManager.getTools(mockServerInstance.id);
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('test-tool');
  });

  it('should disconnect from a server', async () => {
    await mcpConnectionManager.connect({
      ...mockServerConfig,
      ...mockServerInstance,
      name: mockServerName
    });
    await mcpConnectionManager.disconnect(mockServerInstance.id);

    const status = mcpConnectionManager.getStatus(mockServerInstance.id);
    expect(status?.connected).toBe(false);
  });
});

describe('SimpleSearchService', () => {
    it('should search tools', () => {
         // Placeholder
    });

    it('should find tool by name', async () => {
        const searchServerConfig = {
            command: 'node',
            args: [],
            enabled: true,
            type: 'stdio' as const,
            timeout: 60,
            allowedTools: ['test-tool']
        };
        const searchServerName = 'Search Test';

        // 添加测试服务器
        await hubManager.addServer(searchServerName, searchServerConfig);
        const searchServerInstance = await hubManager.addServerInstance(searchServerName, {
            id: 'search-test-server',
            timestamp: Date.now(),
            hash: 'search-hash'
        });

        await mcpConnectionManager.connect({
            ...searchServerConfig,
            ...searchServerInstance,
            name: searchServerName
        });

        const results = simpleSearchService.search('test');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].tool.name).toBe('test-tool');

        // Clean up
        await mcpConnectionManager.disconnect(searchServerInstance.id);
        await hubManager.removeServer(searchServerName);
    });
});
