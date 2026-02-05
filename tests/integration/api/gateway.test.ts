import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define mocks first
const mocks = vi.hoisted(() => {
  const mockToolCache = new Map();

  return {
    setRequestHandler: vi.fn(),
    setNotificationHandler: vi.fn(),
    request: vi.fn(),
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
    updateClientRoots: vi.fn(),
    getClientContext: vi.fn().mockReturnValue({ sessionId: 'test-session' }),
    mockToolCache
  };
});

// Mock dependencies
vi.mock('@services/client-tracker.service.js', () => ({
  clientTrackerService: {
    updateClientRoots: mocks.updateClientRoots,
    getClients: vi.fn().mockReturnValue([])
  }
}));

vi.mock('@utils/request-context.js', () => ({
  getClientContext: mocks.getClientContext,
  getClientCwd: vi.fn()
}));

vi.mock('@utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

vi.mock('@services/mcp-connection-manager.js', () => ({
  mcpConnectionManager: {
    getAllTools: mocks.getAllTools,
    callTool: mocks.callTool,
    toolCache: mocks.mockToolCache,
    // Add method to access the mock toolCache
    getToolCache: () => mocks.mockToolCache
  }
}));

vi.mock('@services/hub-manager.service.js', () => ({
  hubManager: {
    getServerById: mocks.getServerById,
    getAllServers: vi.fn().mockReturnValue([{ id: 'server1', name: 'Test Server' }]),
  }
}));

vi.mock('@services/hub-tools.service.js', () => ({
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
        setRequestHandler: mocks.setRequestHandler,
        setNotificationHandler: mocks.setNotificationHandler,
        request: mocks.request
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
import { GatewayService } from '@services/gateway.service.js';
// Don't import actual mcpConnectionManager, use the mocked version through vi.mocked


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
    vi.mocked(mocks.getServerById).mockReturnValue({
      name: 'Test Server',
      id: 'server1',
      config: { allowedTools: ['testTool'] },
      instance: { id: 'server1', timestamp: Date.now(), hash: 'abc123' }
    } as any);

    // Populate toolCache for the test
    mocks.mockToolCache.set('server1', mockTools);

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

    // We expect 1 tool: 1 from mockTools
    // The name should be 'testTool' because it's unique
    expect(result.tools).toHaveLength(1);
    const testTool = result.tools.find((t: any) => t.name === 'testTool');
    expect(testTool).toBeDefined();
    expect(testTool.description).toContain('[From Test Server]');
  });

  it('should route callTool to correct server', async () => {
    // Setup mock data for mapping (simulate listTools call first)
    const mockTools = [
      { name: 'testTool', description: 'desc', inputSchema: {}, serverId: 'server1' }
    ];
    vi.mocked(mocks.getAllTools).mockReturnValue(mockTools as any);
    vi.mocked(mocks.getServerById).mockReturnValue({
      name: 'Test Server',
      id: 'server1',
      config: { allowedTools: ['testTool'] },
      instance: { id: 'server1', timestamp: Date.now(), hash: 'abc123' }
    } as any);

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

    // Use the correct tool name (testTool)
    await callToolHandler!({
      params: {
        name: 'testTool',
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
        { name: 'list-servers', description: 'List all servers', inputSchema: {} },
        { name: 'find-servers', description: 'Find servers matching a pattern', inputSchema: {} },
        { name: 'list-all-tools-in-server', description: 'List all tools from a specific server', inputSchema: {} },
        { name: 'find-tools-in-server', description: 'Find tools matching a pattern in a specific server', inputSchema: {} },
        { name: 'get-tool', description: 'Get complete schema for a specific tool from a specific server', inputSchema: {} },
        { name: 'call-tool', description: 'Call a specific tool from a specific server', inputSchema: {} },
        { name: 'find-tools', description: 'Find tools matching a pattern across all connected servers', inputSchema: {} }
    ]);

    // Clear toolCache to ensure only system tools are returned
    mocks.mockToolCache.clear();

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

    // Expect 7 system tools
    expect(result.tools).toHaveLength(7);
    expect(result.tools.some((t: any) => t.name === 'list-servers')).toBe(true);
  });

  // it('should fetch roots on initialized notification', async () => {
  //   // Find initialized notification handler
  //   let initializedHandler: Function | undefined;
  //   for (const call of mocks.setNotificationHandler.mock.calls) {
  //       const schemaStr = JSON.stringify(call[0]);
  //       if (schemaStr.includes('"notifications/initialized"')) {
  //           initializedHandler = call[1];
  //           break;
  //       }
  //   }
  //   expect(initializedHandler).toBeDefined();
  //
  //   // Mock server.request returning roots
  //   vi.mocked(mocks.request).mockResolvedValue({ roots: [{ uri: 'file:///test/path' }] });
  //
  //   // Call the handler
  //   await initializedHandler!();
  //
  //   // Verify request was made
  //   expect(mocks.request).toHaveBeenCalledWith(
  //       expect.objectContaining({ method: 'roots/list' }),
  //       expect.anything()
  //   );
  //
  //   // Verify client tracker was updated
  //   expect(mocks.updateClientRoots).toHaveBeenCalledWith('test-session', [{ uri: 'file:///test/path' }]);
  // });

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

    vi.mocked(mocks.listServers).mockResolvedValue(['server1']);

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

  it('should call call-tool system tool with undefined serverName', async () => {
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

    // Mock the actual listServers implementation to return expected result
    // Note: listServers returns server names, not server IDs
    vi.mocked(mocks.listServers).mockImplementation(async () => ['Test Server']);
    // Mock callToolDirect to return the expected result format
    vi.mocked(mocks.callToolDirect).mockImplementation(async (_serverName, toolName, _toolArgs) => {
      if (toolName === 'list-servers') {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(['Test Server'], null, 2)
            }
          ]
        };
      }
      return { content: [] };
    });

    const result = await callToolHandler!({
      params: {
        name: 'call-tool',
        arguments: {
          serverName: undefined,
          toolName: 'list-servers',
          toolArgs: {}
        }
      },
      id: 'test-id',
      jsonrpc: '2.0',
      method: 'tools/call'
    });

    // Verify the result contains the expected content
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content[0]).toBeDefined();
    expect(result.content[0].text).toContain('Test Server');
  });
});
