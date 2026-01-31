import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HubToolsService } from '../../../src/services/hub-tools.service.js';
import { hubManager } from '../../../src/services/hub-manager.service.js';
import { mcpConnectionManager } from '../../../src/services/mcp-connection-manager.js';

// Mock dependencies
vi.mock('../../../src/services/hub-manager.service.js');
vi.mock('../../../src/services/mcp-connection-manager.js');

describe('HubToolsService', () => {
  let hubToolsService: HubToolsService;

  beforeEach(() => {
    hubToolsService = new HubToolsService();

    // Reset all mocks before each test
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
            allowedTools: [],
            longRunning: true
          }
        },
        {
          name: 'Test Server 2',
          config: {
            type: 'sse',
            url: 'http://example.com',
            enabled: true,
            allowedTools: [],
            longRunning: true
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
            allowedTools: [],
            longRunning: true
          }
        },
        {
          name: 'Production Server',
          config: {
            type: 'sse',
            url: 'http://example.com',
            enabled: true,
            allowedTools: [],
            longRunning: true
          }
        },
        {
          name: 'Development Server',
          config: {
            type: 'http',
            url: 'http://dev.example.com',
            enabled: true,
            allowedTools: [],
            longRunning: true
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
            allowedTools: [],
            longRunning: true
          }
        },
        {
          name: 'production server',
          config: {
            type: 'sse',
            url: 'http://example.com',
            enabled: true,
            allowedTools: [],
            longRunning: true
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
          id: 'tool1',
          name: 'readFile',
          description: 'Read file contents',
          serverId: serverId,
          inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
        },
        {
          id: 'tool2',
          name: 'writeFile',
          description: 'Write file contents',
          serverId: serverId,
          inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] }
        }
      ];

      (hubManager.getServerInstanceByName as any).mockReturnValue([{ id: serverId }]);
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

      // Act & Assert
      await expect(hubToolsService.listAllToolsInServer(serverName)).rejects.toThrow(
        `Server with name "${serverName}" not found`
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
          id: 'tool1',
          name: 'readFile',
          description: 'Read file contents',
          serverId: serverId,
          inputSchema: { type: "object" }
        },
        {
          id: 'tool2',
          name: 'writeFile',
          description: 'Write file contents',
          serverId: serverId,
          inputSchema: { type: "object" }
        },
        {
          id: 'tool3',
          name: 'listFiles',
          description: 'List files in directory',
          serverId: serverId,
          inputSchema: { type: "object" }
        }
      ];

      vi.spyOn(hubToolsService, 'listAllToolsInServer').mockResolvedValue({
        serverName,
        tools: mockTools
      });

      // Act
      const result = await hubToolsService.findToolsInServer(serverName, 'File', 'both', false);

      // Assert
      expect(result).toEqual({
        serverName,
        tools: [
          {
            id: 'tool1',
            name: 'readFile',
            description: 'Read file contents',
            serverId: serverId,
            inputSchema: { type: "object" }
          },
          {
            id: 'tool2',
            name: 'writeFile',
            description: 'Write file contents',
            serverId: serverId,
            inputSchema: { type: "object" }
          },
          {
            id: 'tool3',
            name: 'listFiles',
            description: 'List files in directory',
            serverId: serverId,
            inputSchema: { type: "object" }
          }
        ]
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
          id: 'tool1',
          name: 'readFile',
          description: 'Read file contents',
          serverId: serverId,
          inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
        },
        {
          id: 'tool2',
          name: 'writeFile',
          description: 'Write file contents',
          serverId: serverId,
          inputSchema: { type: "object" }
        }
      ];

      vi.spyOn(hubToolsService, 'listAllToolsInServer').mockResolvedValue({
        serverName,
        tools: mockTools
      });

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
          id: 'tool1',
          name: 'readFile',
          description: 'Read file contents',
          serverId: serverId,
          inputSchema: { type: "object" }
        }
      ];

      vi.spyOn(hubToolsService, 'listAllToolsInServer').mockResolvedValue({
        serverName,
        tools: mockTools
      });

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

      (hubManager.getServerInstanceByName as any).mockReturnValue([{ id: serverId }]);
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

      // Act & Assert
      await expect(hubToolsService.callTool(serverName, 'readFile', {})).rejects.toThrow(
        `Server with name "${serverName}" not found`
      );
    });

    it('should handle call-tool system tool with undefined serverName', async () => {
      // Arrange
      const mockServers = ['Test Server 1', 'Test Server 2'];
      vi.spyOn(hubToolsService, 'listServers').mockResolvedValue(mockServers);

      // Act
      const result = await hubToolsService.callSystemTool('call-tool', {
        serverName: undefined,
        toolName: 'list-servers',
        toolArgs: {}
      });

      // Assert
      expect(result).toEqual(mockServers);
      expect(hubToolsService.listServers).toHaveBeenCalled();
    });

    it('should handle call-tool system tool with "undefined" string serverName', async () => {
      // Arrange
      const mockServers = ['Test Server 1', 'Test Server 2'];
      vi.spyOn(hubToolsService, 'listServers').mockResolvedValue(mockServers);

      // Act
      const result = await hubToolsService.callSystemTool('call-tool', {
        serverName: 'undefined',
        toolName: 'list-servers',
        toolArgs: {}
      });

      // Assert
      expect(result).toEqual(mockServers);
      expect(hubToolsService.listServers).toHaveBeenCalled();
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
            allowedTools: [],
            longRunning: true
          }
        },
        {
          name: 'Server 2',
          config: {
            type: 'sse',
            url: 'http://example.com',
            enabled: true,
            allowedTools: [],
            longRunning: true
          }
        }
      ];

      const mockServerInstances: Record<string, any[]> = {
        'Server 1': [
          {
            id: '1',
            timestamp: Date.now(),
            hash: 'hash1'
          }
        ],
        'Server 2': [
          {
            id: '2',
            timestamp: Date.now(),
            hash: 'hash2'
          }
        ]
      };

      const mockTools = [
        [
          {
            id: 'tool1',
            name: 'readFile',
            description: 'Read file contents',
            serverId: '1',
            inputSchema: { type: "object" }
          }
        ],
        [
          {
            id: 'tool2',
            name: 'writeFile',
            description: 'Write file contents',
            serverId: '2',
            inputSchema: { type: "object" }
          }
        ]
      ];

      (hubManager.getAllServers as any).mockReturnValue(mockServers);
      (hubManager.getServerInstanceByName as any)
        .mockImplementation((name: string) => mockServerInstances[name]);
      (mcpConnectionManager.getTools as any)
        .mockImplementation((id: string) => id === '1' ? mockTools[0] : mockTools[1]);

      // Act
      const allTools = await hubToolsService.listAllTools();

      // Assert
      expect(allTools).toEqual({
        'mcp-hub-lite': {
          tools: [
            {
              name: 'list-servers',
              description: '[System] List all connected servers',
              inputSchema: {
                type: 'object',
                properties: {}
              },
              serverId: 'mcp-hub-lite'
            },
            {
              name: 'find-servers',
              description: '[System] Find servers matching a pattern',
              inputSchema: {
                type: 'object',
                properties: {
                  pattern: { type: 'string', description: 'Regex pattern to search for' },
                  searchIn: { type: 'string', enum: ['name', 'description', 'both'], default: 'both' },
                  caseSensitive: { type: 'boolean', default: false }
                },
                required: ['pattern']
              },
              serverId: 'mcp-hub-lite'
            },
            {
              name: 'list-all-tools-in-server',
              description: '[System] List all tools from a specific server',
              inputSchema: {
                type: 'object',
                properties: {
                  serverName: { type: 'string', description: 'Name of the MCP server' }
                },
                required: ['serverName']
              },
              serverId: 'mcp-hub-lite'
            },
            {
              name: 'find-tools-in-server',
              description: '[System] Find tools matching a pattern in a specific server',
              inputSchema: {
                type: 'object',
                properties: {
                  serverName: { type: 'string', description: 'Name of the MCP server' },
                  pattern: { type: 'string', description: 'Regex pattern to search for' },
                  searchIn: { type: 'string', enum: ['name', 'description', 'both'], default: 'both' },
                  caseSensitive: { type: 'boolean', default: false }
                },
                required: ['serverName', 'pattern']
              },
              serverId: 'mcp-hub-lite'
            },
            {
              name: 'get-tool',
              description: '[System] Get complete schema for a specific tool from a specific server',
              inputSchema: {
                type: 'object',
                properties: {
                  serverName: { type: 'string', description: 'Name of the MCP server' },
                  toolName: { type: 'string', description: 'Exact name of the tool' }
                },
                required: ['serverName', 'toolName']
              },
              serverId: 'mcp-hub-lite'
            },
            {
              name: 'call-tool',
              description: '[System] Call a specific tool from a specific server',
              inputSchema: {
                type: 'object',
                properties: {
                  serverName: { type: 'string', description: 'Name of the MCP server' },
                  toolName: { type: 'string', description: 'Name of the tool to call' },
                  toolArgs: { type: 'object', description: 'Arguments to pass to the tool' }
                },
                required: ['serverName', 'toolName', 'toolArgs']
              },
              serverId: 'mcp-hub-lite'
            },
            {
              name: 'find-tools',
              description: '[System] Find tools matching a pattern across all connected servers',
              inputSchema: {
                type: 'object',
                properties: {
                  pattern: { type: 'string', description: 'Regex pattern to search for' },
                  searchIn: { type: 'string', enum: ['name', 'description', 'both'], default: 'both' },
                  caseSensitive: { type: 'boolean', default: false }
                },
                required: ['pattern']
              },
              serverId: 'mcp-hub-lite'
            }
          ]
        },
        'Server 1': {
          tools: mockTools[0]
        },
        'Server 2': {
          tools: mockTools[1]
        }
      });
    });
  });

  describe('findTools', () => {
    it('should find tools matching pattern across all servers', async () => {
      // Arrange
      const mockTools = {
        'Server 1': {
          tools: [
            {
              id: 'tool1',
              name: 'readFile',
              description: 'Read file contents',
              serverId: '1',
              inputSchema: { type: "object" }
            }
          ]
        },
        'Server 2': {
          tools: [
            {
              id: 'tool2',
              name: 'writeFile',
              description: 'Write file contents',
              serverId: '2',
              inputSchema: { type: "object" }
            },
            {
              id: 'tool3',
              name: 'listFiles',
              description: 'List files in directory',
              serverId: '2',
              inputSchema: { type: "object" }
            }
          ]
        }
      };

      vi.spyOn(hubToolsService, 'listAllTools').mockResolvedValue(mockTools);

      // Act
      const results = await hubToolsService.findTools('File', 'both', false);

      // Assert
      expect(results).toEqual({
        'Server 1': {
          tools: [
            {
              id: 'tool1',
              name: 'readFile',
              description: 'Read file contents',
              serverId: '1',
              inputSchema: { type: "object" }
            }
          ]
        },
        'Server 2': {
          tools: [
            {
              id: 'tool2',
              name: 'writeFile',
              description: 'Write file contents',
              serverId: '2',
              inputSchema: { type: "object" }
            },
            {
              id: 'tool3',
              name: 'listFiles',
              description: 'List files in directory',
              serverId: '2',
              inputSchema: { type: "object" }
            }
          ]
        }
      });
    });
  });
});
