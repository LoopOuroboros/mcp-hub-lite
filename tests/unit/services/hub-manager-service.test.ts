import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubManagerService } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { ConfigManager, configManager } from '@config/config-manager.js';
import type { ServerConfig, ServerInstance } from '@config/config.schema.js';

// Mock resolveInstanceConfig to return a valid resolved config
vi.mock('@config/config-migrator.js', () => ({
  resolveInstanceConfig: vi.fn(),
  getEnabledInstances: vi.fn()
}));

// Mock dependencies
vi.mock('@config/config-manager.js', () => ({
  ConfigManager: vi.fn(),
  configManager: {
    addServer: vi.fn(),
    getServers: vi.fn(),
    getServerById: vi.fn(),
    getServerByName: vi.fn(),
    updateServer: vi.fn(),
    removeServer: vi.fn(),
    addServerInstance: vi.fn(),
    getServerInstancesByName: vi.fn(),
    updateServerInstance: vi.fn(),
    removeServerInstance: vi.fn()
  }
}));

vi.mock('@services/mcp-connection-manager.js', () => ({
  mcpConnectionManager: {
    connect: vi.fn(),
    disconnect: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('@utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  },
  LOG_MODULES: {}
}));

vi.mock('@services/event-bus.service.js', () => ({
  eventBus: {
    publish: vi.fn()
  },
  EventTypes: {}
}));

describe('HubManagerService', () => {
  let service: HubManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HubManagerService(configManager as ConfigManager);
  });

  it('should auto-connect when adding an enabled server instance', async () => {
    // Import the mocked module
    const { resolveInstanceConfig } = await import('@config/config-migrator.js');

    const serverName = 'Test Server';
    const serverBaseConfig: ServerConfig = {
      template: {
        type: 'stdio' as const,
        command: 'node',
        args: [],
        aggregatedTools: [],
        timeout: 30000
      },
      instances: [],
      tagDefinitions: []
    };

    const serverInstanceConfig: ServerInstance = {
      id: 'test-server',
      enabled: true,
      args: [],
      tags: {}
    };

    vi.mocked(configManager.addServer).mockResolvedValue(serverBaseConfig);
    vi.mocked(configManager.addServerInstance).mockResolvedValue(serverInstanceConfig);
    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig);

    // Mock resolveInstanceConfig to return enabled = true
    vi.mocked(resolveInstanceConfig).mockReturnValue({
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 30000,
      aggregatedTools: [],
      tags: {},
      enabled: true
    });

    await service.addServer(serverName, serverBaseConfig.template);
    await service.addServerInstance(serverName, serverInstanceConfig);

    expect(configManager.addServer).toHaveBeenCalled();
    expect(configManager.addServerInstance).toHaveBeenCalled();
    expect(mcpConnectionManager.connect).toHaveBeenCalled();
  });

  it('should NOT auto-connect when adding a disabled server instance', async () => {
    // Import the mocked module
    const { resolveInstanceConfig } = await import('@config/config-migrator.js');

    const serverName = 'Disabled Server';
    const serverBaseConfig: ServerConfig = {
      template: {
        type: 'stdio' as const,
        command: 'node',
        args: [],
        aggregatedTools: [],
        timeout: 30000
      },
      instances: [],
      tagDefinitions: []
    };

    const serverInstanceConfig: ServerInstance = {
      id: 'test-server-disabled',
      enabled: false,
      args: [],
      tags: {}
    };

    vi.mocked(configManager.addServer).mockResolvedValue(serverBaseConfig);
    vi.mocked(configManager.addServerInstance).mockResolvedValue(serverInstanceConfig);
    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig);

    // Mock resolveInstanceConfig to return enabled = false
    vi.mocked(resolveInstanceConfig).mockReturnValue({
      command: 'node',
      args: [],
      type: 'stdio' as const,
      timeout: 30000,
      aggregatedTools: [],
      tags: {},
      enabled: false
    });

    await service.addServer(serverName, serverBaseConfig.template);
    await service.addServerInstance(serverName, serverInstanceConfig);

    expect(configManager.addServer).toHaveBeenCalled();
    expect(configManager.addServerInstance).toHaveBeenCalled();
    expect(mcpConnectionManager.connect).not.toHaveBeenCalled();
  });

  it('should call disconnect when removing a server', async () => {
    const serverName = 'Test Server';
    const serverConfig: ServerConfig = {
      template: {
        type: 'stdio' as const,
        command: 'node',
        args: [],
        aggregatedTools: [],
        timeout: 30000
      },
      instances: [],
      tagDefinitions: []
    };

    vi.mocked(configManager.getServerByName).mockReturnValue(serverConfig);
    vi.mocked(configManager.removeServer).mockResolvedValue(true);
    vi.mocked(configManager.getServerInstancesByName).mockReturnValue([
      {
        id: 'test-server-instance',
        enabled: true,
        args: [],
        tags: {}
      } as ServerInstance
    ]);

    await service.removeServer(serverName);

    expect(configManager.removeServer).toHaveBeenCalledWith(serverName);
    expect(mcpConnectionManager.disconnect).toHaveBeenCalledWith('test-server-instance');
  });

  it('should get server by name', async () => {
    const serverName = 'Test Server';
    const serverBaseConfig: ServerConfig = {
      template: {
        type: 'stdio' as const,
        command: 'test',
        args: [],
        aggregatedTools: [],
        timeout: 30000
      },
      instances: [],
      tagDefinitions: []
    };

    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig);

    const server = service.getServerByName(serverName);

    expect(server).toEqual(serverBaseConfig);
    expect(configManager.getServerByName).toHaveBeenCalledWith(serverName);
  });

  it('should get server instances', async () => {
    const serverName = 'Test Server';
    const serverInstanceConfig: ServerInstance = {
      id: 'test-instance',
      enabled: true,
      args: [],
      tags: {}
    };

    vi.mocked(configManager.getServerInstancesByName).mockReturnValue([serverInstanceConfig]);

    const instances = service.getServerInstancesByName(serverName);

    expect(instances).toEqual([serverInstanceConfig]);
    expect(configManager.getServerInstancesByName).toHaveBeenCalledWith(serverName);
  });
});
