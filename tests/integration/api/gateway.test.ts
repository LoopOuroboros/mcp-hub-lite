import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define mocks first
const mocks = vi.hoisted(() => ({
  setRequestHandler: vi.fn(),
  connect: vi.fn(),
  getAllTools: vi.fn(),
  callTool: vi.fn(),
  getServerById: vi.fn(),
  listAllToolsInServer: vi.fn(),
  findToolsInServer: vi.fn(),
  getTool: vi.fn(),
  callToolDirect: vi.fn(),
  listAllTools: vi.fn(),
  findTools: vi.fn(),
  listServers: vi.fn(),
  findServers: vi.fn(),
  getSystemTools: vi.fn().mockReturnValue([]),
}));

// Mock dependencies
vi.mock('../../../src/services/mcp-connection-manager.js', () => ({
  mcpConnectionManager: {
    getAllTools: mocks.getAllTools,
    callTool: mocks.callTool,
  }
}));

vi.mock('../../../src/services/hub-manager.service.js', () => ({
  hubManager: {
    getServerById: mocks.getServerById,
    getAllServers: vi.fn().mockReturnValue([{ id: 'server1', name: 'Test Server' }]),
  }
}));

vi.mock('../../../src/services/hub-tools.service.js', () => ({
  hubToolsService: {
    listAllToolsInServer: mocks.listAllToolsInServer,
    findToolsInServer: mocks.findToolsInServer,
    getTool: mocks.getTool,
    callTool: mocks.callToolDirect,
    listAllTools: mocks.listAllTools,
    findTools: mocks.findTools,
    listServers: mocks.listServers,
    findServers: mocks.findServers,
    getSystemTools: mocks.getSystemTools,
  }
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: class {
      server = {
        setRequestHandler: mocks.setRequestHandler
      };
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
import { GatewayService } from '../../../src/services/gateway.service.js';

describe('GatewayService', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    new GatewayService();
  });

  it('should register handlers on initialization', () => {
    // Check call arguments by type (zod schema)
    const calls = mocks.setRequestHandler.mock.calls;
    // We now register multiple handlers: initialize, ping, search, list servers, find servers, etc.
    expect(calls.length).toBeGreaterThanOrEqual(10);
  });

  it('should list tools with prefixed names', async () => {
    // Setup mock data
    const mockTools = [
      { name: 'testTool', description: 'desc', inputSchema: {}, serverId: 'server1' }
    ];
    vi.mocked(mocks.getAllTools).mockReturnValue(mockTools as any);
    vi.mocked(mocks.getServerById).mockReturnValue({ name: 'Test Server', id: 'server1' } as any);

    // Find the registered handler for ListTools
    // We can identify ListTools handler by checking if the schema has 'method' literal 'tools/list'
    // Since ListToolsRequestSchema is from @modelcontextprotocol/sdk, we can stringify schemas for comparison
    let listToolsHandler: Function | undefined;
    for (const call of mocks.setRequestHandler.mock.calls) {
      const schema = call[0];
      const handler = call[1];

      // Convert schema to string for identification
      const schemaStr = JSON.stringify(schema);

      // Look for schema that has the method: 'tools/list' which is characteristic of ListTools
      if (schemaStr.includes('"tools/list"')) {
        listToolsHandler = handler;
        break;
      }
    }

    expect(listToolsHandler).toBeDefined();

    const result = await listToolsHandler!({
      params: {},
      id: 'test-id',
      jsonrpc: '2.0',
      method: 'tools/list'
    });

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

    // Find list tools handler to populate tool map
    let listToolsHandler: Function | undefined;
    for (const call of mocks.setRequestHandler.mock.calls) {
      const schemaStr = JSON.stringify(call[0]);
      if (schemaStr.includes('"tools/list"')) {
        listToolsHandler = call[1];
        break;
      }
    }

    expect(listToolsHandler).toBeDefined();
    await listToolsHandler!({
      params: {},
      id: 'test-id',
      jsonrpc: '2.0',
      method: 'tools/list'
    }); // This populates the internal map

    // Find call tool handler by checking if schema has 'method' literal 'tools/call'
    let callToolHandler: Function | undefined;
    for (const call of mocks.setRequestHandler.mock.calls) {
      const schemaStr = JSON.stringify(call[0]);
      if (schemaStr.includes('"tools/call"')) {
        callToolHandler = call[1];
        break;
      }
    }

    expect(callToolHandler).toBeDefined();

    vi.mocked(mocks.callTool).mockResolvedValue({ content: [] });

    await callToolHandler!({
      params: {
        name: 'Test_Server_testTool',
        arguments: { arg: 1 }
      },
      id: 'test-id',
      jsonrpc: '2.0',
      method: 'tools/call'
    });

    expect(mocks.callTool).toHaveBeenCalledWith('server1', 'testTool', { arg: 1 });
  });

  it('should list system tools', async () => {
    // Setup mock data
    const mockTools: any[] = [];
    vi.mocked(mocks.getAllTools).mockReturnValue(mockTools as any);
    vi.mocked(mocks.getSystemTools).mockReturnValue([
        { name: 'list-servers', description: 'List all servers', inputSchema: {} }
    ]);

    // Find list tools handler
    let listToolsHandler: Function | undefined;
    for (const call of mocks.setRequestHandler.mock.calls) {
      const schemaStr = JSON.stringify(call[0]);
      if (schemaStr.includes('"tools/list"')) {
        listToolsHandler = call[1];
        break;
      }
    }

    expect(listToolsHandler).toBeDefined();

    const result = await listToolsHandler!({
      params: {},
      id: 'test-id',
      jsonrpc: '2.0',
      method: 'tools/list'
    });

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('list-servers');
    expect(result.tools[0].description).toContain('[System]');
  });

  it('should call system tools', async () => {
    // Find call tool handler
    let callToolHandler: Function | undefined;
    for (const call of mocks.setRequestHandler.mock.calls) {
      const schemaStr = JSON.stringify(call[0]);
      if (schemaStr.includes('"tools/call"')) {
        callToolHandler = call[1];
        break;
      }
    }

    expect(callToolHandler).toBeDefined();

    vi.mocked(mocks.listServers).mockResolvedValue([{ name: 'server1' }]);

    const result = await callToolHandler!({
      params: {
        name: 'list-servers',
        arguments: {}
      },
      id: 'test-id',
      jsonrpc: '2.0',
      method: 'tools/call'
    });

    expect(mocks.listServers).toHaveBeenCalled();
    expect(result.content[0].text).toContain('server1');
  });
});
