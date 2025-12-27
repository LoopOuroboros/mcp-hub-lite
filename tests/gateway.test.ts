import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Define mocks first
const mocks = vi.hoisted(() => ({
  setRequestHandler: vi.fn(),
  connect: vi.fn(),
  getAllTools: vi.fn(),
  callTool: vi.fn(),
  getServerById: vi.fn(),
}));

// Mock dependencies
vi.mock('../src/services/mcp-connection.manager.js', () => ({
  mcpConnectionManager: {
    getAllTools: mocks.getAllTools,
    callTool: mocks.callTool,
  }
}));

vi.mock('../src/services/hub-manager.service.js', () => ({
  hubManager: {
    getServerById: mocks.getServerById,
  }
}));

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: class {
      setRequestHandler = mocks.setRequestHandler;
      connect = mocks.connect;
    }
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: class {}
  };
});

// Import after mocks
import { StreamingGatewayService } from '../src/services/streaming-gateway.service.js';
import { mcpConnectionManager } from '../src/services/mcp-connection.manager.js';
import { hubManager } from '../src/services/hub-manager.service.js';

describe('StreamingGatewayService', () => {
  let gateway: StreamingGatewayService;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new StreamingGatewayService();
  });

  it('should register handlers on initialization', () => {
    // Check call arguments by type (zod schema)
    const calls = mocks.setRequestHandler.mock.calls;
    expect(calls.length).toBe(2);
  });

  it('should list tools with prefixed names', async () => {
    // Setup mock data
    const mockTools = [
      { name: 'testTool', description: 'desc', inputSchema: {}, serverId: 'server1' }
    ];
    vi.mocked(mocks.getAllTools).mockReturnValue(mockTools as any);
    vi.mocked(mocks.getServerById).mockReturnValue({ name: 'Test Server', id: 'server1' } as any);

    // Get the registered handler for ListTools
    // We assume the first one is ListToolsRequestSchema based on implementation
    // But better to check or just try both?
    // In our implementation, ListTools is registered first.
    
    const listToolsHandler = mocks.setRequestHandler.mock.calls[0][1];
    
    const result = await listToolsHandler();
    
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('Test_Server_testTool');
    expect(result.tools[0].description).toContain('[From Test Server]');
  });

  it('should route callTool to correct server', async () => {
    // Setup mock data for mapping (simulate listTools call first)
    const mockTools = [
      { name: 'testTool', description: 'desc', inputSchema: {}, serverId: 'server1' }
    ];
    vi.mocked(mocks.getAllTools).mockReturnValue(mockTools as any);
    vi.mocked(mocks.getServerById).mockReturnValue({ name: 'Test Server', id: 'server1' } as any);

    const listToolsHandler = mocks.setRequestHandler.mock.calls[0][1];
    await listToolsHandler(); // This populates the internal map

    // Now call the tool
    const callToolHandler = mocks.setRequestHandler.mock.calls[1][1];
    
    vi.mocked(mocks.callTool).mockResolvedValue({ content: [] });

    await callToolHandler({
      params: {
        name: 'Test_Server_testTool',
        arguments: { arg: 1 }
      }
    });

    expect(mocks.callTool).toHaveBeenCalledWith('server1', 'testTool', { arg: 1 });
  });
});
