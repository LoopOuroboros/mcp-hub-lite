import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubToolsService } from '@services/hub-tools.service.js';
import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';

// Mock dependencies
vi.mock('@services/hub-manager.service.js');
vi.mock('@services/mcp-connection-manager.js');

describe('HubToolsService', () => {
  let hubToolsService: HubToolsService;

  beforeEach(() => {
    hubToolsService = new HubToolsService();
    // Clear mock calls between tests to avoid state pollution
    vi.clearAllMocks();
  });

  describe('listServers', () => {
    it('should return array of server names only', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Test Server 1',
          config: {
            type: 'stdio',
            command: 'test-command',
            args: [],
            enabled: true,
            allowedTools: []
          }
        },
        {
          name: 'Test Server 2',
          config: {
            type: 'sse',
            url: 'http://example.com',
            enabled: true,
            allowedTools: []
          }
        }
      ];

      (hubManager.getAllServers as any).mockReturnValue(mockServers);

      // Act
      const servers = await hubToolsService.listServers();

      // Assert
      expect(servers).toEqual(['Test Server 1', 'Test Server 2']);
      expect(hubManager.getAllServers).toHaveBeenCalledTimes(1);
    });
  });

  describe('findServers', () => {
    it('should find servers matching name pattern (case-insensitive)', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Test Server 1',
          config: {
            type: 'stdio',
            command: 'test-command',
            args: [],
            enabled: true,
            allowedTools: []
          }
        },
        {
          name: 'Production Server',
          config: {
            type: 'sse',
            url: 'http://example.com',
            enabled: true,
            allowedTools: []
          }
        },
        {
          name: 'Development Server',
          config: {
            type: 'http',
            url: 'http://dev.example.com',
            enabled: true,
            allowedTools: []
          }
        }
      ];

      (hubManager.getAllServers as any).mockReturnValue(mockServers);

      // Act
      const results = await hubToolsService.findServers('server', 'name', false);

      // Assert
      expect(results).toEqual(['Test Server 1', 'Production Server', 'Development Server']);
      expect(hubManager.getAllServers).toHaveBeenCalledTimes(1);
    });

    it('should find servers matching name pattern (case-sensitive)', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Test Server 1',
          config: {
            type: 'stdio',
            command: 'test-command',
            args: [],
            enabled: true,
            allowedTools: []
          }
        },
        {
          name: 'production server',
          config: {
            type: 'sse',
            url: 'http://example.com',
            enabled: true,
            allowedTools: []
          }
        }
      ];

      (hubManager.getAllServers as any).mockReturnValue(mockServers);

      // Act
      const results = await hubToolsService.findServers('Server', 'name', true);

      // Assert
      expect(results).toEqual(['Test Server 1']);
      expect(hubManager.getAllServers).toHaveBeenCalledTimes(1);
    });
  });

  describe('listAllToolsInServer', () => {
    it('should return tools from a specific server', async () => {
      // Arrange
      const serverName = 'Test Server';
      const serverId = '1';
      const mockTools = [
        {
          name: 'readFile',
          description: 'Read file contents',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
        },
        {
          name: 'writeFile',
          description: 'Write file contents',
          inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }
        }
      ];

      // getServerInstanceByName should return ServerInstanceConfig objects (with id, timestamp, hash)
      const mockInstance = { id: serverId, timestamp: Date.now(), hash: 'hash1' };
      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (hubManager.getServerByName as any).mockReturnValue({
        type: 'stdio',
        command: 'test-command',
        args: [],
        enabled: true,
        allowedTools: []
      });
      (mcpConnectionManager.getTools as any).mockReturnValue(mockTools);

      // Act
      const result = await hubToolsService.listAllToolsInServer(serverName);

      // Assert
      expect(result).toEqual({
        serverName,
        tools: mockTools
      });
      expect(hubManager.getServerInstanceByName).toHaveBeenCalledTimes(1);
      expect(hubManager.getServerInstanceByName).toHaveBeenCalledWith(serverName);
      expect(mcpConnectionManager.getTools).toHaveBeenCalledWith(serverId);
    });

    it('should throw error if server not found', async () => {
      // Arrange
      const serverName = 'Non-existent Server';
      (hubManager.getServerInstanceByName as any).mockReturnValue([]);
      (hubManager.getServerByName as any).mockReturnValue(undefined);

      // Act & Assert
      await expect(hubToolsService.listAllToolsInServer(serverName)).rejects.toThrow(
        `Server not found: ${serverName}`
      );
    });
  });

  describe('findToolsInServer', () => {
    it('should find tools matching pattern in server', async () => {
      // Arrange
      const serverName = 'Test Server';
      const serverId = '1';
      const mockTools = [
        {
          name: 'readFile',
          description: 'Read file contents',
          inputSchema: { type: 'object' }
        },
        {
          name: 'writeFile',
          description: 'Write file contents',
          inputSchema: { type: 'object' }
        },
        {
          name: 'listFiles',
          description: 'List files in directory',
          inputSchema: { type: 'object' }
        }
      ];

      const mockInstance = { id: serverId, timestamp: Date.now(), hash: 'hash1' };
      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (hubManager.getServerByName as any).mockReturnValue({
        type: 'stdio',
        command: 'test-command',
        args: [],
        enabled: true,
        allowedTools: []
      });
      (mcpConnectionManager.getTools as any).mockReturnValue(mockTools);

      // Act
      const result = await hubToolsService.findToolsInServer(serverName, 'File', 'both', false);

      // Assert
      expect(result).toEqual({
        serverName,
        tools: [
          {
            name: 'readFile',
            description: 'Read file contents',
            inputSchema: { type: 'object' }
          },
          {
            name: 'writeFile',
            description: 'Write file contents',
            inputSchema: { type: 'object' }
          },
          {
            name: 'listFiles',
            description: 'List files in directory',
            inputSchema: { type: 'object' }
          }
        ]
      });
    });

    it('should return empty array if no tools match', async () => {
      // Arrange
      const serverName = 'Test Server';
      const serverId = '1';
      const mockTools = [
        {
          name: 'unmatchedTool',
          description: 'This should not match',
          inputSchema: { type: 'object' }
        },
        {
          name: 'anotherUnmatchedTool',
          description: 'This should also not match',
          inputSchema: { type: 'object' }
        }
      ];

      const mockInstance = { id: serverId, timestamp: Date.now(), hash: 'hash1' };
      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (hubManager.getServerByName as any).mockReturnValue({
        type: 'stdio',
        command: 'test-command',
        args: [],
        enabled: true,
        allowedTools: []
      });
      (mcpConnectionManager.getTools as any).mockReturnValue(mockTools);

      // Act
      const result = await hubToolsService.findToolsInServer(serverName, 'File', 'both', false);

      // Assert
      expect(result).toEqual({
        serverName,
        tools: []
      });
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
          inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
        },
        {
          name: 'writeFile',
          description: 'Write file contents',
          inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }
        }
      ];

      const mockInstance = { id: serverId, timestamp: Date.now(), hash: 'hash1' };
      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (hubManager.getServerByName as any).mockReturnValue({
        type: 'stdio',
        command: 'test-command',
        args: [],
        enabled: true,
        allowedTools: []
      });
      (mcpConnectionManager.getTools as any).mockReturnValue(mockTools);

      // Act
      const tool = await hubToolsService.getTool(serverName, toolName);

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
          inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
        }
      ];

      const mockInstance = { id: serverId, timestamp: Date.now(), hash: 'hash1' };
      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (hubManager.getServerByName as any).mockReturnValue({
        type: 'stdio',
        command: 'test-command',
        args: [],
        enabled: true,
        allowedTools: []
      });
      (mcpConnectionManager.getTools as any).mockReturnValue(mockTools);

      // Act
      const tool = await hubToolsService.getTool(serverName, toolName);

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

      const mockInstance = { id: serverId, timestamp: Date.now(), hash: 'hash1' };
      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (hubManager.getServerByName as any).mockReturnValue({
        type: 'stdio',
        command: 'test-command',
        args: [],
        enabled: true,
        allowedTools: []
      });
      (mcpConnectionManager.callTool as any).mockResolvedValue(expectedResult);

      // Act
      const result = await hubToolsService.callTool(serverName, toolName, toolArgs);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mcpConnectionManager.callTool).toHaveBeenCalledWith(serverId, toolName, toolArgs);
    });

    it('should throw error if server not found when calling tool', async () => {
      // Arrange
      const serverName = 'Non-existent Server';
      (hubManager.getServerInstanceByName as any).mockReturnValue([]);
      (hubManager.getServerByName as any).mockReturnValue(undefined);

      // Act & Assert
      await expect(hubToolsService.callTool(serverName, 'readFile', {})).rejects.toThrow(
        `Server not found: ${serverName}`
      );
    });
  });

  describe('listAllTools', () => {
    it('should list all tools from all servers', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Server 1',
          config: {
            type: 'stdio',
            command: 'test-command',
            args: [],
            enabled: true,
            allowedTools: []
          }
        },
        {
          name: 'Server 2',
          config: {
            type: 'sse',
            url: 'http://example.com',
            enabled: true,
            allowedTools: []
          }
        }
      ];

      const mockServerInstances: Record<string, Array<{ id: string; timestamp: number; hash: string }>> = {
        'Server 1': [{ id: '1', timestamp: Date.now(), hash: 'hash1' }],
        'Server 2': [{ id: '2', timestamp: Date.now(), hash: 'hash2' }]
      };

      const mockTools = [
        {
          name: 'readFile',
          description: 'Read file contents'
        },
        {
          name: 'writeFile',
          description: 'Write file contents'
        }
      ];

      (hubManager.getAllServers as any).mockReturnValue(mockServers);
      (hubManager.getServerInstanceByName as any)
        .mockImplementation((name: string) => mockServerInstances[name]);
      (hubManager.getServerByName as any)
        .mockImplementation((name: string) => mockServers.find(s => s.name === name)?.config);
      (mcpConnectionManager.getTools as any).mockReturnValue(mockTools);

      // Act
      const allTools = await hubToolsService.listAllTools();

      // Assert - System tools under mcp-hub-lite
      expect(allTools).toHaveProperty('mcp-hub-lite');
      expect(Array.isArray(allTools['mcp-hub-lite'].tools)).toBe(true);

      // Verify system tools exist
      const systemToolNames = allTools['mcp-hub-lite'].tools.map((t: any) => t.name);
      expect(systemToolNames).toContain('list-servers');
      expect(systemToolNames).toContain('find-servers');
      expect(systemToolNames).toContain('list-all-tools-in-server');
      expect(systemToolNames).toContain('find-tools-in-server');
      expect(systemToolNames).toContain('get-tool');
      expect(systemToolNames).toContain('call-tool');
      expect(systemToolNames).toContain('find-tools');

      // Assert server tools - should have only name and description
      expect(allTools['Server 1'].tools).toEqual(mockTools);
      expect(allTools['Server 2'].tools).toEqual(mockTools);
    });
  });

  describe('findTools', () => {
    it('should find tools matching pattern across all servers', async () => {
      // Arrange
      const mockTools = {
        'Server 1': {
          tools: [
            { name: 'readFile', description: 'Read file contents', serverName: 'Server 1' },
            { name: 'writeFile', description: 'Write file contents', serverName: 'Server 1' }
          ]
        },
        'Server 2': {
          tools: [
            { name: 'listFiles', description: 'List files in directory', serverName: 'Server 2' }
          ]
        }
      };

      vi.spyOn(hubToolsService, 'listAllTools').mockResolvedValue(mockTools);

      // Act
      const results = await hubToolsService.findTools('File', 'both', false);

      // Assert
      expect(results).toEqual(mockTools);
    });
  });

  describe('listResources', () => {
    it('should return empty array when no servers are connected', async () => {
      // Arrange
      (hubManager.getAllServers as any).mockReturnValue([]);

      // Act
      const resources = await hubToolsService.listResources();

      // Assert
      expect(resources).toEqual([]);
      expect(hubManager.getAllServers).toHaveBeenCalledTimes(1);
    });

    it('should return dynamic resources for connected servers', async () => {
      // Arrange
      const mockServers = [
        {
          name: 'Test Server',
          config: {
            type: 'stdio',
            command: 'test-command',
            args: [],
            enabled: true,
            allowedTools: []
          }
        }
      ];

      const mockInstance = { id: '1', timestamp: Date.now(), hash: 'hash1', status: 'online', lastHeartbeat: Date.now(), uptime: 1000 };
      (hubManager.getAllServers as any).mockReturnValue(mockServers);
      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (hubManager.getServerByName as any).mockReturnValue(mockServers[0].config);
      (mcpConnectionManager.getTools as any).mockReturnValue([{ name: 'testTool', description: 'Test tool' }]);
      (mcpConnectionManager.getResources as any).mockReturnValue([{ uri: 'test://resource', name: 'Test Resource' }]);

      // Act
      const resources = await hubToolsService.listResources();

      // Assert
      expect(resources).toHaveLength(3);
      expect(resources[0]).toEqual({
        uri: 'hub://servers/Test Server',
        name: 'Server: Test Server',
        description: 'Connected MCP server: Test Server',
        mimeType: 'application/json',
        serverId: '1'
      });
      expect(resources[1]).toEqual({
        uri: 'hub://servers/Test Server/tools',
        name: 'Tools: Test Server',
        description: '1 tools available from Test Server',
        mimeType: 'application/json',
        serverId: '1'
      });
      expect(resources[2]).toEqual({
        uri: 'hub://servers/Test Server/resources',
        name: 'Resources: Test Server',
        description: '1 resources available from Test Server',
        mimeType: 'application/json',
        serverId: '1'
      });
    });
  });

  describe('readResource', () => {
    it('should throw error for invalid URI format', async () => {
      // Act & Assert
      await expect(hubToolsService.readResource('invalid-uri')).rejects.toThrow('Invalid Hub resource URI');
      await expect(hubToolsService.readResource('hub://invalid')).rejects.toThrow('Invalid Hub resource URI format');
    });

    it('should throw error for non-existent server', async () => {
      // Arrange
      (hubManager.getServerInstanceByName as any).mockReturnValue([]);

      // Act & Assert
      await expect(hubToolsService.readResource('hub://servers/NonExistent')).rejects.toThrow('Server not found or not connected');
    });

    it('should return server metadata for server URI', async () => {
      // Arrange
      const serverName = 'Test Server';
      const mockInstance = { id: '1', timestamp: Date.now(), hash: 'hash1', status: 'online', lastHeartbeat: Date.now(), uptime: 1000 };
      const mockConfig = {
        type: 'stdio',
        command: 'test-command',
        args: [],
        enabled: true,
        allowedTools: [],
        tags: { env: 'test' }
      };

      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (hubManager.getServerByName as any).mockReturnValue(mockConfig);
      (mcpConnectionManager.getTools as any).mockReturnValue([{ name: 'testTool' }]);
      (mcpConnectionManager.getResources as any).mockReturnValue([{ uri: 'test://resource' }]);

      // Act
      const result = await hubToolsService.readResource(`hub://servers/${serverName}`);

      // Assert
      expect(result).toEqual({
        name: serverName,
        status: 'online',
        toolsCount: 1,
        resourcesCount: 1,
        tags: { env: 'test' },
        lastHeartbeat: mockInstance.lastHeartbeat,
        uptime: mockInstance.uptime,
        type: 'stdio',
        enabled: true
      });
    });

    it('should return tools list for tools URI', async () => {
      // Arrange
      const serverName = 'Test Server';
      const mockInstance = { id: '1', timestamp: Date.now(), hash: 'hash1', status: 'online', lastHeartbeat: Date.now(), uptime: 1000 };
      const mockTools = [{ name: 'testTool', description: 'Test tool' }];

      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (mcpConnectionManager.getTools as any).mockReturnValue(mockTools);

      // Act
      const result = await hubToolsService.readResource(`hub://servers/${serverName}/tools`);

      // Assert
      expect(result).toEqual(mockTools);
    });

    it('should return resources list for resources URI', async () => {
      // Arrange
      const serverName = 'Test Server';
      const mockInstance = { id: '1', timestamp: Date.now(), hash: 'hash1', status: 'online', lastHeartbeat: Date.now(), uptime: 1000 };
      const mockResources = [{ uri: 'test://resource', name: 'Test Resource' }];

      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);
      (mcpConnectionManager.getResources as any).mockReturnValue(mockResources);

      // Act
      const result = await hubToolsService.readResource(`hub://servers/${serverName}/resources`);

      // Assert
      expect(result).toEqual(mockResources);
    });

    it('should throw error for unknown resource type', async () => {
      // Arrange
      const serverName = 'Test Server';
      const mockInstance = { id: '1', timestamp: Date.now(), hash: 'hash1', status: 'online', lastHeartbeat: Date.now(), uptime: 1000 };

      (hubManager.getServerInstanceByName as any).mockReturnValue([mockInstance]);

      // Act & Assert
      await expect(hubToolsService.readResource(`hub://servers/${serverName}/unknown`)).rejects.toThrow('Unknown resource type');
    });
  });
});