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
    it('should return list of servers with basic information', async () => {
      // Arrange
      const mockServers = [
        {
          id: '1',
          name: 'Test Server 1',
          type: 'stdio',
          enabled: true,
          command: 'test-command',
          args: []
        },
        {
          id: '2',
          name: 'Test Server 2',
          type: 'sse',
          enabled: true,
          url: 'http://example.com'
        }
      ];

      const mockStatuses = [
        {
          connected: true,
          toolsCount: 5,
          version: '1.0.0'
        },
        {
          connected: false,
          toolsCount: 0
        }
      ];

      (hubManager.getAllServers as any).mockReturnValue(mockServers);
      (mcpConnectionManager.getStatus as any)
        .mockImplementation((id: string) => id === '1' ? mockStatuses[0] : mockStatuses[1]);

      // Act
      const servers = await hubToolsService.listServers();

      // Assert
      expect(servers).toEqual([
        {
          id: '1',
          name: 'Test Server 1',
          type: 'stdio',
          connected: true,
          toolsCount: 5,
          version: '1.0.0'
        },
        {
          id: '2',
          name: 'Test Server 2',
          type: 'sse',
          connected: false,
          toolsCount: 0,
          version: undefined
        }
      ]);

      expect(hubManager.getAllServers).toHaveBeenCalledTimes(1);
      expect(mcpConnectionManager.getStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('findServers', () => {
    it('should find servers matching name pattern (case-insensitive)', async () => {
      // Arrange
      const mockServers = [
        {
          id: '1',
          name: 'Test Server 1',
          type: 'stdio',
          connected: true,
          toolsCount: 5,
          version: '1.0.0'
        },
        {
          id: '2',
          name: 'Production Server',
          type: 'sse',
          connected: true,
          toolsCount: 10,
          version: '2.1.3'
        },
        {
          id: '3',
          name: 'Development Server',
          type: 'http',
          connected: false,
          toolsCount: 0
        }
      ];

      // Spy on and mock the instance method
      vi.spyOn(hubToolsService, 'listServers').mockResolvedValue(mockServers);

      // Act
      const results = await hubToolsService.findServers('server', 'name', false);

      // Assert
      expect(results).toEqual([
        {
          id: '1',
          name: 'Test Server 1',
          type: 'stdio',
          connected: true,
          toolsCount: 5,
          version: '1.0.0'
        },
        {
          id: '2',
          name: 'Production Server',
          type: 'sse',
          connected: true,
          toolsCount: 10,
          version: '2.1.3'
        },
        {
          id: '3',
          name: 'Development Server',
          type: 'http',
          connected: false,
          toolsCount: 0
        }
      ]);
    });

    it('should find servers matching name pattern (case-sensitive)', async () => {
      // Arrange
      const mockServers = [
        {
          id: '1',
          name: 'Test Server 1',
          type: 'stdio',
          connected: true,
          toolsCount: 5,
          version: '1.0.0'
        },
        {
          id: '2',
          name: 'production server',
          type: 'sse',
          connected: true,
          toolsCount: 10,
          version: '2.1.3'
        }
      ];

      vi.spyOn(hubToolsService, 'listServers').mockResolvedValue(mockServers);

      // Act
      const results = await hubToolsService.findServers('Server', 'name', true);

      // Assert
      expect(results).toEqual([
        {
          id: '1',
          name: 'Test Server 1',
          type: 'stdio',
          connected: true,
          toolsCount: 5,
          version: '1.0.0'
        }
      ]);
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

      (hubManager.getServerById as any).mockReturnValue({ id: serverId, name: serverName });
      (mcpConnectionManager.getTools as any).mockReturnValue(mockTools);

      // Act
      const result = await hubToolsService.listAllToolsInServer(serverId);

      // Assert
      expect(result).toEqual({
        serverName,
        serverId,
        tools: mockTools
      });

      expect(hubManager.getServerById).toHaveBeenCalledTimes(1);
      expect(hubManager.getServerById).toHaveBeenCalledWith(serverId);
      expect(mcpConnectionManager.getTools).toHaveBeenCalledWith(serverId);
    });

    it('should throw error if server not found', async () => {
      // Arrange
      const serverId = '999';
      (hubManager.getServerById as any).mockReturnValue(undefined);

      // Act & Assert
      await expect(hubToolsService.listAllToolsInServer(serverId)).rejects.toThrow(
        `Server with ID "${serverId}" not found`
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
        serverId,
        tools: mockTools
      });

      // Act
      const result = await hubToolsService.findToolsInServer(serverId, 'File', 'both', false);

      // Assert
      expect(result).toEqual({
        serverName,
        serverId,
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
        serverId,
        tools: mockTools
      });

      // Act
      const tool = await hubToolsService.getTool(serverId, toolName);

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
        serverId,
        tools: mockTools
      });

      // Act
      const tool = await hubToolsService.getTool(serverId, toolName);

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

      (hubManager.getServerById as any).mockReturnValue({ id: serverId, name: serverName });
      (mcpConnectionManager.callTool as any).mockResolvedValue(expectedResult);

      // Act
      const result = await hubToolsService.callTool(serverId, toolName, toolArgs);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mcpConnectionManager.callTool).toHaveBeenCalledWith(serverId, toolName, toolArgs);
    });

    it('should throw error if server not found when calling tool', async () => {
      // Arrange
      const serverId = '999';
      (hubManager.getServerById as any).mockReturnValue(undefined);

      // Act & Assert
      await expect(hubToolsService.callTool(serverId, 'readFile', {})).rejects.toThrow(
        `Server with ID "${serverId}" not found`
      );
    });
  });

  describe('listAllTools', () => {
    it('should list all tools from all servers', async () => {
      // Arrange
      const mockServers = [
        { id: '1', name: 'Server 1' },
        { id: '2', name: 'Server 2' }
      ];

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
      (mcpConnectionManager.getTools as any)
        .mockImplementation((id: string) => id === '1' ? mockTools[0] : mockTools[1]);

      // Act
      const allTools = await hubToolsService.listAllTools();

      // Assert
      expect(allTools).toEqual({
        'Server 1': {
          serverId: '1',
          tools: mockTools[0]
        },
        'Server 2': {
          serverId: '2',
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
          serverId: '1',
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
          serverId: '2',
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
          serverId: '1',
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
          serverId: '2',
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
