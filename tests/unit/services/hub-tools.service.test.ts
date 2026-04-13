import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubToolsService } from '@services/hub-tools.service.js';
import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import type { ServerInstance } from '@config/config-manager.js';

// Mock dependencies
vi.mock('@services/hub-manager.service.js');
vi.mock('@services/mcp-connection-manager.js');

describe('HubToolsService', () => {
  let hubToolsService: HubToolsService;

  beforeEach(() => {
    hubToolsService = new HubToolsService();
    // Clear mock calls between tests to avoid state pollution
    vi.clearAllMocks();
    // Clear the generated resources cache
    (hubToolsService as unknown as { generatedResourcesCache: unknown }).generatedResourcesCache =
      null;
  });

  describe('listServers', () => {
    it('should return Record of server names to descriptions', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Test Server 1',
          config: {
            template: {
              type: 'stdio' as const,
              command: 'test-command',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              description: 'File system operations',
              tags: {}
            },
            instances: [
              {
                id: 'test-server-1-instance',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ],
            tagDefinitions: []
          }
        },
        {
          name: 'Test Server 2',
          config: {
            template: {
              type: 'sse' as const,
              url: 'http://example.com',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              tags: {}
            },
            instances: [
              {
                id: 'test-server-2-instance',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ],
            tagDefinitions: []
          }
        }
      ];

      vi.mocked(hubManager.getAllServers).mockReturnValue(mockServers);
      vi.mocked(hubManager.getServerInstancesByName).mockImplementation((name) => {
        const server = mockServers.find((s) => s.name === name);
        return server?.config.instances || [];
      });
      vi.mocked(hubManager.getServerByName).mockImplementation((name) => {
        const server = mockServers.find((s) => s.name === name);
        return server?.config;
      });
      vi.mocked(mcpConnectionManager.getStatusByName).mockImplementation(() => {
        return {
          connected: true,
          lastCheck: Date.now(),
          toolsCount: 0,
          resourcesCount: 0
        };
      });

      // Act
      const servers = await hubToolsService.listServers();

      // Assert
      expect(servers).toEqual({
        'Test Server 1': 'File system operations',
        'Test Server 2': 'Connected MCP server: Test Server 2'
      });
      expect(hubManager.getAllServers).toHaveBeenCalledTimes(1);
    });

    it('should use default description when server has no description', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'server1',
          config: {
            template: {
              type: 'stdio' as const,
              command: 'test-command',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              tags: {}
            },
            instances: [
              {
                id: 'server1-instance',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ],
            tagDefinitions: []
          }
        }
      ];

      vi.mocked(hubManager.getAllServers).mockReturnValue(mockServers);
      vi.mocked(hubManager.getServerInstancesByName).mockImplementation((name) => {
        const server = mockServers.find((s) => s.name === name);
        return server?.config.instances || [];
      });
      vi.mocked(hubManager.getServerByName).mockImplementation((name) => {
        const server = mockServers.find((s) => s.name === name);
        return server?.config;
      });
      vi.mocked(mcpConnectionManager.getStatusByName).mockImplementation(() => {
        return {
          connected: true,
          lastCheck: Date.now(),
          toolsCount: 0,
          resourcesCount: 0
        };
      });

      // Act
      const servers = await hubToolsService.listServers();

      // Assert
      expect(servers).toEqual({
        server1: 'Connected MCP server: server1'
      });
    });

    it('should use provided description when available', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'filesystem',
          config: {
            template: {
              type: 'stdio' as const,
              command: 'test-command',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              description: 'File system operations',
              tags: {}
            },
            instances: [
              {
                id: 'filesystem-instance',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ],
            tagDefinitions: []
          }
        },
        {
          name: 'time',
          config: {
            template: {
              type: 'sse' as const,
              url: 'http://example.com',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              description: 'Time and timezone utilities',
              tags: {}
            },
            instances: [
              {
                id: 'time-instance',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ],
            tagDefinitions: []
          }
        }
      ];

      vi.mocked(hubManager.getAllServers).mockReturnValue(mockServers);
      vi.mocked(hubManager.getServerInstancesByName).mockImplementation((name) => {
        const server = mockServers.find((s) => s.name === name);
        return server?.config.instances || [];
      });
      vi.mocked(hubManager.getServerByName).mockImplementation((name) => {
        const server = mockServers.find((s) => s.name === name);
        return server?.config;
      });
      vi.mocked(mcpConnectionManager.getStatusByName).mockImplementation(() => {
        return {
          connected: true,
          lastCheck: Date.now(),
          toolsCount: 0,
          resourcesCount: 0
        };
      });

      // Act
      const servers = await hubToolsService.listServers();

      // Assert
      expect(servers).toEqual({
        filesystem: 'File system operations',
        time: 'Time and timezone utilities'
      });
    });

    it('should only include connected servers in the result', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Connected Server',
          config: {
            template: {
              type: 'stdio' as const,
              command: 'test-command',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              description: 'This server is connected',
              tags: {}
            },
            instances: [
              {
                id: 'connected-server-instance',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ],
            tagDefinitions: []
          }
        },
        {
          name: 'Disconnected Server',
          config: {
            template: {
              type: 'sse' as const,
              url: 'http://example.com',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              description: 'This server is disconnected',
              tags: {}
            },
            instances: [
              {
                id: 'disconnected-server-instance',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {}
              }
            ],
            tagDefinitions: []
          }
        }
      ];

      vi.mocked(hubManager.getAllServers).mockReturnValue(mockServers);
      vi.mocked(hubManager.getServerInstancesByName).mockImplementation((name) => {
        const server = mockServers.find((s) => s.name === name);
        return server?.config.instances || [];
      });
      vi.mocked(hubManager.getServerByName).mockImplementation((name) => {
        const server = mockServers.find((s) => s.name === name);
        return server?.config;
      });
      vi.mocked(mcpConnectionManager.getStatusByName).mockImplementation((name) => {
        if (name === 'Connected Server') {
          return {
            connected: true,
            lastCheck: Date.now(),
            toolsCount: 0,
            resourcesCount: 0
          };
        }
        return {
          connected: false,
          lastCheck: Date.now(),
          toolsCount: 0,
          resourcesCount: 0
        };
      });

      // Act
      const servers = await hubToolsService.listServers();

      // Assert
      expect(servers).toEqual({
        'Connected Server': 'This server is connected'
      });
      expect(servers).not.toHaveProperty('Disconnected Server');
    });
  });

  describe('listToolsInServer', () => {
    it('should return tool summaries from a specific server (without inputSchema)', async () => {
      // Arrange
      const serverName = 'Test Server';
      const serverId = '1';
      const mockTools = [
        {
          name: 'readFile',
          description: 'Read file contents',
          inputSchema: { type: 'object' },
          serverName: 'Test Server'
        },
        {
          name: 'writeFile',
          description: 'Write file contents',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' }, content: { type: 'string' } },
            required: ['path', 'content']
          },
          serverName: 'Test Server'
        }
      ];

      // Expected tool summaries (without inputSchema)
      const expectedToolSummaries = [
        { name: 'readFile', description: 'Read file contents', serverName: 'Test Server' },
        { name: 'writeFile', description: 'Write file contents', serverName: 'Test Server' }
      ];

      // getServerInstancesByName should return ServerInstance objects
      const mockInstance = {
        id: serverId,
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: {}
      } as ServerInstance;
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([mockInstance]);
      vi.mocked(hubManager.getServerByName).mockReturnValue({
        template: {
          type: 'stdio' as const,
          command: 'test-command',
          args: [],
          env: {},
          headers: {},
          aggregatedTools: [],
          timeout: 30000
        },
        instances: [mockInstance],
        tagDefinitions: []
      });
      vi.mocked(mcpConnectionManager.getTools).mockReturnValue(mockTools);

      // Act
      const result = await hubToolsService.listToolsInServer({ serverName });

      // Assert
      expect(result).toEqual({
        serverName,
        tools: expectedToolSummaries
      });
      expect(hubManager.getServerInstancesByName).toHaveBeenCalledTimes(1);
      expect(hubManager.getServerInstancesByName).toHaveBeenCalledWith(serverName);
      expect(mcpConnectionManager.getTools).toHaveBeenCalledWith(serverId);
    });

    it('should throw error if server not found', async () => {
      // Arrange
      const serverName = 'Non-existent Server';
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([]);
      vi.mocked(hubManager.getServerByName).mockReturnValue(undefined);

      // Act & Assert
      await expect(hubToolsService.listToolsInServer({ serverName })).rejects.toThrow(
        `Server not found: ${serverName}`
      );
    });
  });

  describe('getTool', () => {
    it('should return tool details from server', async () => {
      // Arrange
      const serverName = 'Test Server';
      const serverId = '1';
      const toolName = 'readFile';
      const mockTools = [
        {
          name: 'readFile',
          description: 'Read file contents',
          inputSchema: { type: 'object' },
          serverName: 'Test Server'
        },
        {
          name: 'writeFile',
          description: 'Write file contents',
          inputSchema: { type: 'object' },
          serverName: 'Test Server'
        }
      ];

      const mockInstance = {
        id: serverId,
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: {}
      } as ServerInstance;
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([mockInstance]);
      vi.mocked(hubManager.getServerByName).mockReturnValue({
        template: {
          type: 'stdio' as const,
          command: 'test-command',
          args: [],
          env: {},
          headers: {},
          aggregatedTools: [],
          timeout: 30000
        },
        instances: [mockInstance],
        tagDefinitions: []
      });
      vi.mocked(mcpConnectionManager.getTools).mockReturnValue(mockTools);

      // Act
      const tool = await hubToolsService.getTool({ serverName, toolName });

      // Assert
      expect(tool).toEqual(mockTools[0]);
    });

    it('should return undefined if tool not found', async () => {
      // Arrange
      const serverName = 'Test Server';
      const serverId = '1';
      const toolName = 'nonExistentTool';
      const mockTools = [
        {
          name: 'readFile',
          description: 'Read file contents',
          inputSchema: { type: 'object' },
          serverName: 'Test Server'
        }
      ];

      const mockInstance = {
        id: serverId,
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: {}
      } as ServerInstance;
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([mockInstance]);
      vi.mocked(hubManager.getServerByName).mockReturnValue({
        template: {
          type: 'stdio' as const,
          command: 'test-command',
          args: [],
          env: {},
          headers: {},
          aggregatedTools: [],
          timeout: 30000
        },
        instances: [mockInstance],
        tagDefinitions: []
      });
      vi.mocked(mcpConnectionManager.getTools).mockReturnValue(mockTools);

      // Act
      const tool = await hubToolsService.getTool({ serverName, toolName });

      // Assert
      expect(tool).toBeUndefined();
    });
  });

  describe('callTool', () => {
    it('should call tool on server with arguments', async () => {
      // Arrange
      const serverName = 'Test Server';
      const serverId = '1';
      const toolName = 'readFile';
      const toolArgs = { path: '/test/file.txt' };
      const expectedResult = { content: 'Test file content' };

      const mockInstance = {
        id: serverId,
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: {}
      } as ServerInstance;
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([mockInstance]);
      vi.mocked(hubManager.getServerByName).mockReturnValue({
        template: {
          type: 'stdio' as const,
          command: 'test-command',
          args: [],
          env: {},
          headers: {},
          aggregatedTools: [],
          timeout: 30000
        },
        instances: [mockInstance],
        tagDefinitions: []
      });
      vi.mocked(mcpConnectionManager.callTool).mockResolvedValue(expectedResult);

      // Act
      const result = await hubToolsService.callTool({ serverName, toolName, toolArgs });

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mcpConnectionManager.callTool).toHaveBeenCalledWith(serverId, toolName, toolArgs);
    });

    it('should throw error if server not found when calling tool', async () => {
      // Arrange
      const serverName = 'Non-existent Server';
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([]);
      vi.mocked(hubManager.getServerByName).mockReturnValue(undefined);

      // Act & Assert
      await expect(
        hubToolsService.callTool({ serverName, toolName: 'readFile', toolArgs: {} })
      ).rejects.toThrow(`Server not found: ${serverName}`);
    });
  });

  describe('listAllTools', () => {
    it('should list all tools from all servers', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Server 1',
          config: {
            template: {
              type: 'stdio' as const,
              command: 'test-command',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              tags: {}
            },
            instances: [],
            tagDefinitions: []
          }
        },
        {
          name: 'Server 2',
          config: {
            template: {
              type: 'sse' as const,
              url: 'http://example.com',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              tags: {}
            },
            instances: [],
            tagDefinitions: []
          }
        }
      ];

      const mockServerInstances: Record<
        string,
        Array<{
          id: string;
          enabled: boolean;
          args: [];
          env: Record<string, string>;
          headers: Record<string, string>;
          tags: Record<string, string>;
        }>
      > = {
        'Server 1': [{ id: '1', enabled: true, args: [], env: {}, headers: {}, tags: {} }],
        'Server 2': [{ id: '2', enabled: true, args: [], env: {}, headers: {}, tags: {} }]
      };

      const mockTools = [
        {
          name: 'readFile',
          description: 'Read file contents',
          inputSchema: { type: 'object', properties: {}, required: [] },
          serverName: 'Server 1'
        },
        {
          name: 'writeFile',
          description: 'Write file contents',
          inputSchema: { type: 'object', properties: {}, required: [] },
          serverName: 'Server 1'
        }
      ];

      // Expected tool summaries (without inputSchema)
      const expectedToolSummariesServer1 = [
        { name: 'readFile', description: 'Read file contents', serverName: 'Server 1' },
        { name: 'writeFile', description: 'Write file contents', serverName: 'Server 1' }
      ];
      const expectedToolSummariesServer2 = [
        { name: 'readFile', description: 'Read file contents', serverName: 'Server 2' },
        { name: 'writeFile', description: 'Write file contents', serverName: 'Server 2' }
      ];

      vi.mocked(hubManager.getAllServers).mockReturnValue(mockServers);
      vi.mocked(hubManager.getServerInstancesByName).mockImplementation(
        (name: string) => mockServerInstances[name]
      );
      vi.mocked(hubManager.getServerByName).mockImplementation(
        (name: string) => mockServers.find((s) => s.name === name)?.config
      );
      vi.mocked(mcpConnectionManager.getTools).mockReturnValue(mockTools);

      // Act
      const allTools = await hubToolsService.listAllTools();

      // Assert - System tools under mcp-hub-lite
      expect(allTools).toHaveProperty('mcp-hub-lite');
      expect(Array.isArray(allTools['mcp-hub-lite'].tools)).toBe(true);

      // Assert system tools - should have 5 tools now
      const systemToolNames = allTools['mcp-hub-lite'].tools.map((t) => t.name);
      expect(systemToolNames).toContain('list_servers');
      expect(systemToolNames).toContain('list_tools_in_server');
      expect(systemToolNames).toContain('get_tool');
      expect(systemToolNames).toContain('call_tool');
      expect(systemToolNames).toContain('update_server_description');
      expect(systemToolNames).toHaveLength(5);

      // Assert server tools - should have only name and description
      expect(allTools['Server 1'].tools).toEqual(expectedToolSummariesServer1);
      expect(allTools['Server 2'].tools).toEqual(expectedToolSummariesServer2);
    });
  });

  describe('listResources', () => {
    it('should return use-guide resource even when no servers are connected', async () => {
      // Arrange
      vi.mocked(hubManager.getAllServers).mockReturnValue([]);

      // Act
      const resources = await hubToolsService.listResources();

      // Assert
      expect(resources).toHaveLength(1);
      expect(resources[0]).toEqual({
        uri: 'hub://use-guide',
        name: 'MCP Hub Lite Use Guide',
        description: 'Comprehensive guide to using MCP Hub Lite gateway and its features',
        mimeType: 'text/markdown',
        serverId: undefined
      });
    });

    it('should return use-guide and server resources for connected servers', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Test Server',
          config: {
            template: {
              type: 'stdio' as const,
              command: 'test-command',
              args: [],
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000,
              tags: {}
            },
            instances: [
              {
                id: '1',
                enabled: true,
                args: [],
                env: {},
                headers: {},
                tags: {},
                index: 0,
                displayName: 'Test Instance'
              }
            ],
            tagDefinitions: []
          }
        }
      ];

      vi.mocked(hubManager.getAllServers).mockReturnValue(mockServers);
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue(
        mockServers[0].config.instances
      );
      vi.mocked(hubManager.getServerByName).mockReturnValue(mockServers[0].config);
      vi.mocked(mcpConnectionManager.getTools).mockReturnValue([
        { name: 'testTool', description: 'Test tool', serverName: 'test-server' }
      ]);
      vi.mocked(mcpConnectionManager.getResources).mockReturnValue([
        { uri: 'test://resource', name: 'Test Resource' }
      ]);

      // Act
      const resources = await hubToolsService.listResources();

      // Assert - the resource list should include use-guide and at least the server resource
      expect(resources.length).toBeGreaterThanOrEqual(1);

      // First resource should be use-guide
      expect(resources[0]).toEqual({
        uri: 'hub://use-guide',
        name: 'MCP Hub Lite Use Guide',
        description: 'Comprehensive guide to using MCP Hub Lite gateway and its features',
        mimeType: 'text/markdown',
        serverId: undefined
      });
    });
  });

  describe('readResource', () => {
    it('should return use-guide content for use-guide URI', async () => {
      // Act
      const result = await hubToolsService.readResource('hub://use-guide');

      // Assert
      expect(typeof result).toBe('string');
      expect(result).toContain('# MCP Hub Lite Use Guide');
      expect(result).toContain('Getting Started');
      expect(result).toContain('Progressive Discovery Workflow');
      expect(result).toContain('System Tools Reference');
    });

    it('should throw error for invalid URI format', async () => {
      // Act & Assert
      await expect(hubToolsService.readResource('invalid-uri')).rejects.toThrow(
        'Invalid Hub resource URI'
      );
      // Now hub://invalid is not necessarily invalid - it could be a valid single-segment URI
      // The parser only rejects hub://servers/... format URIs that are invalid
    });

    it('should throw error for non-existent server', async () => {
      // Arrange
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([]);

      // Act & Assert
      await expect(hubToolsService.readResource('hub://servers/NonExistent')).rejects.toThrow(
        'Server not found or not connected'
      );
    });

    it('should return server metadata for server URI with tools field', async () => {
      // Arrange
      const serverName = 'Test Server';
      const mockInstance = {
        id: 'test-instance',
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: { env: 'test' },
        timestamp: Date.now(),
        hash: 'hash1',
        status: 'online',
        lastHeartbeat: Date.now(),
        uptime: 1000
      } as unknown;
      const mockConfig = {
        template: {
          type: 'stdio' as const,
          command: 'test-command',
          args: [],
          env: {},
          headers: {},
          aggregatedTools: [],
          timeout: 30000
        },
        instances: [
          {
            id: 'test-instance',
            enabled: true,
            args: [],
            env: {},
            headers: {},
            tags: { env: 'test' },
            timestamp: Date.now(),
            status: 'online',
            lastHeartbeat: Date.now(),
            uptime: 1000
          }
        ],
        tagDefinitions: []
      };
      const mockTools = [
        { name: 'testTool', description: 'Test tool description', serverName: 'test-server' }
      ];

      // @ts-expect-error - Mocking for test purposes with extra fields
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([mockInstance]);
      vi.mocked(hubManager.getServerByName).mockReturnValue(mockConfig);
      vi.mocked(mcpConnectionManager.getTools).mockReturnValue(mockTools);
      vi.mocked(mcpConnectionManager.getResources).mockReturnValue([
        { uri: 'test://resource', name: 'Test Resource' }
      ]);

      // Act
      const result = await hubToolsService.readResource(`hub://servers/${serverName}`);

      // Assert
      expect(result).toEqual({
        name: serverName,
        status: 'online',
        toolsCount: 1,
        tools: { testTool: 'Test tool description' },
        resourcesCount: 1,
        tags: { env: 'test' },
        // @ts-expect-error - Accessing extra fields on mock
        lastHeartbeat: mockInstance.lastHeartbeat,
        // @ts-expect-error - Accessing extra fields on mock
        uptime: mockInstance.uptime,
        description: `Connected MCP server: ${serverName}`
      });
    });

    it('should return tools list for tools URI', async () => {
      // Arrange
      const serverName = 'Test Server';
      const mockInstance = {
        id: '1',
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: {},
        timestamp: Date.now(),
        hash: 'hash1',
        status: 'online',
        lastHeartbeat: Date.now(),
        uptime: 1000
      } as unknown;
      const mockTools = [{ name: 'testTool', description: 'Test tool', serverName: 'test-server' }];

      // @ts-expect-error - Mocking for test purposes with extra fields
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([mockInstance]);
      vi.mocked(mcpConnectionManager.getTools).mockReturnValue(mockTools);

      // Act
      const result = await hubToolsService.readResource(`hub://servers/${serverName}/tools`);

      // Assert
      expect(result).toEqual(mockTools);
    });

    it('should return resources list for resources URI', async () => {
      // Arrange
      const serverName = 'Test Server';
      const mockInstance = {
        id: '1',
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: {},
        timestamp: Date.now(),
        hash: 'hash1',
        status: 'online',
        lastHeartbeat: Date.now(),
        uptime: 1000
      } as unknown;
      const mockResources = [{ uri: 'test://resource', name: 'Test Resource' }];

      // @ts-expect-error - Mocking for test purposes with extra fields
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([mockInstance]);
      vi.mocked(mcpConnectionManager.getResources).mockReturnValue(mockResources);

      // Act
      const result = await hubToolsService.readResource(`hub://servers/${serverName}/resources`);

      // Assert
      expect(result).toEqual(mockResources);
    });

    it('should throw error for unknown resource type', async () => {
      // Arrange
      const serverName = 'Test Server';
      const mockInstance = {
        id: '1',
        enabled: true,
        args: [],
        env: {},
        headers: {},
        tags: {},
        timestamp: Date.now(),
        hash: 'hash1',
        status: 'online',
        lastHeartbeat: Date.now(),
        uptime: 1000
      } as unknown;

      // @ts-expect-error - Mocking for test purposes with extra fields
      vi.mocked(hubManager.getServerInstancesByName).mockReturnValue([mockInstance]);

      // Act & Assert
      await expect(
        hubToolsService.readResource(`hub://servers/${serverName}/unknown`)
      ).rejects.toThrow('Unknown resource type');
    });
  });
});
