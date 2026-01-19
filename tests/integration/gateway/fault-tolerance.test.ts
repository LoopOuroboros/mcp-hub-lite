import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mcpConnectionManager } from '../../../src/services/mcp-connection-manager.js';

// We need to mock BEFORE import
const mockConnect = vi.fn();
const mockListTools = vi.fn();

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
  return {
    Client: class {
      connect = mockConnect;
      close = vi.fn().mockResolvedValue(undefined);
      listTools = mockListTools;
      callTool = vi.fn();
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

describe('Fault Tolerance', () => {
  const mockServer = {
    id: 'faulty-server',
    name: 'Faulty Server',
    command: 'node',
    args: ['server.js'],
    enabled: true,
    type: 'stdio' as const,
    longRunning: true,
    timeout: 60
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Ensure clean state
    if (mcpConnectionManager.getStatus(mockServer.id)) {
        await mcpConnectionManager.disconnect(mockServer.id);
    }
  });

  it('should handle connection failure gracefully', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection failed'));
    
    const success = await mcpConnectionManager.connect(mockServer);
    
    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(mockServer.id);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('Connection failed');
  });

  it('should handle listTools failure gracefully', async () => {
    mockConnect.mockResolvedValueOnce(undefined);
    mockListTools.mockRejectedValueOnce(new Error('List tools failed'));
    
    const success = await mcpConnectionManager.connect(mockServer);
    
    expect(success).toBe(false);
    const status = mcpConnectionManager.getStatus(mockServer.id);
    expect(status?.connected).toBe(false);
    expect(status?.error).toContain('List tools failed');
  });
});
