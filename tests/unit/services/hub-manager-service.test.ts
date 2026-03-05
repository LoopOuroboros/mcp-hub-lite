import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubManagerService } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import {
  ConfigManager,
  configManager,
  type ServerConfig,
  type ServerInstanceConfig
} from '@config/config-manager.js';

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
    getServerInstanceByName: vi.fn(),
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

describe('HubManagerService', () => {
  let service: HubManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HubManagerService(configManager as ConfigManager);
  });

  it('should auto-connect when adding an enabled server instance', async () => {
    const serverName = 'Test Server';
    const serverBaseConfig: ServerConfig = {
      type: 'stdio' as const,
      command: 'node',
      args: [],
      enabled: true,
      allowedTools: [],
      timeout: 30000
    };

    const serverInstanceConfig: ServerInstanceConfig = {
      id: 'test-server',
      timestamp: Date.now(),
      hash: 'test-hash'
    };

    vi.mocked(configManager.addServer).mockResolvedValue(serverBaseConfig);
    vi.mocked(configManager.addServerInstance).mockResolvedValue(serverInstanceConfig);
    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig);

    await service.addServer(serverName, serverBaseConfig);
    await service.addServerInstance(serverName, serverInstanceConfig);

    expect(configManager.addServer).toHaveBeenCalledWith(serverName, serverBaseConfig);
    expect(configManager.addServerInstance).toHaveBeenCalledWith(serverName, serverInstanceConfig);
    expect(mcpConnectionManager.connect).toHaveBeenCalled();
  });

  it('should NOT auto-connect when adding a disabled server instance', async () => {
    const serverName = 'Disabled Server';
    const serverBaseConfig: ServerConfig = {
      type: 'stdio' as const,
      command: 'node',
      args: [],
      enabled: false,
      allowedTools: [],
      timeout: 30000
    };

    const serverInstanceConfig = {
      id: 'test-server-disabled',
      name: serverName,
      timestamp: Date.now(),
      hash: 'test-hash'
    };

    vi.mocked(configManager.addServer).mockResolvedValue(serverBaseConfig);
    vi.mocked(configManager.addServerInstance).mockResolvedValue(serverInstanceConfig);
    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig);

    await service.addServer(serverName, serverBaseConfig);
    await service.addServerInstance(serverName, serverInstanceConfig);

    expect(configManager.addServer).toHaveBeenCalledWith(serverName, serverBaseConfig);
    expect(configManager.addServerInstance).toHaveBeenCalledWith(serverName, serverInstanceConfig);
    expect(mcpConnectionManager.connect).not.toHaveBeenCalled();
  });

  it('should call disconnect when removing a server', async () => {
    const serverName = 'Test Server';
    const serverConfig: ServerConfig = {
      type: 'stdio' as const,
      command: 'node',
      args: [],
      enabled: true,
      allowedTools: [],
      timeout: 30000
    };

    vi.mocked(configManager.getServerByName).mockReturnValue(serverConfig);
    vi.mocked(configManager.removeServer).mockResolvedValue();
    vi.mocked(configManager.getServerInstanceByName).mockReturnValue([
      {
        id: 'test-server-instance',
        timestamp: Date.now(),
        hash: 'test-hash'
      } as ServerInstanceConfig
    ]);

    await service.removeServer(serverName);

    expect(configManager.removeServer).toHaveBeenCalledWith(serverName);
    expect(mcpConnectionManager.disconnect).toHaveBeenCalledWith('test-server-instance');
  });

  it('should get server by name', async () => {
    const serverName = 'Test Server';
    const serverBaseConfig: ServerConfig = {
      type: 'stdio' as const,
      command: 'test',
      args: [],
      enabled: true,
      allowedTools: [],
      timeout: 30000
    };

    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig);

    const server = service.getServerByName(serverName);

    expect(server).toEqual(serverBaseConfig);
    expect(configManager.getServerByName).toHaveBeenCalledWith(serverName);
  });

  it('should get server instances', async () => {
    const serverName = 'Test Server';
    const serverInstanceConfig: ServerInstanceConfig = {
      id: 'test-instance',
      timestamp: Date.now(),
      hash: 'test-hash'
    };

    vi.mocked(configManager.getServerInstanceByName).mockReturnValue([serverInstanceConfig]);

    const instances = service.getServerInstanceByName(serverName);

    expect(instances).toEqual([serverInstanceConfig]);
    expect(configManager.getServerInstanceByName).toHaveBeenCalledWith(serverName);
  });
});
