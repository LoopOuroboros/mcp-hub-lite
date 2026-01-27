import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HubManagerService } from '../../../src/services/hub-manager.service.js';
import { mcpConnectionManager } from '../../../src/services/mcp-connection-manager.js';
import { configManager } from '../../../src/config/config-manager.js';

// Mock dependencies
vi.mock('../../../src/config/config-manager.js', () => ({
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
    removeServerInstance: vi.fn(),
  }
}));

vi.mock('../../../src/services/mcp-connection-manager.js', () => ({
  mcpConnectionManager: {
    connect: vi.fn(),
    disconnect: vi.fn(() => Promise.resolve()),
  }
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }
}));

describe('HubManagerService', () => {
  let service: HubManagerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new HubManagerService(configManager as any);
  });

  it('should auto-connect when adding an enabled server instance', async () => {
    const serverName = 'Test Server';
    const serverBaseConfig = {
      type: 'stdio',
      command: 'node',
      args: [],
      enabled: true,
      allowedTools: [],
      longRunning: true
    };

    const serverInstanceConfig = {
      id: 'test-server',
      name: serverName,
      timestamp: Date.now(),
      hash: 'test-hash'
    };

    vi.mocked(configManager.addServer).mockResolvedValue(serverBaseConfig as any);
    vi.mocked(configManager.addServerInstance).mockResolvedValue(serverInstanceConfig as any);
    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig as any);

    await service.addServer(serverName, serverBaseConfig as any);
    await service.addServerInstance(serverName, serverInstanceConfig as any);

    expect(configManager.addServer).toHaveBeenCalledWith(serverName, serverBaseConfig);
    expect(configManager.addServerInstance).toHaveBeenCalledWith(serverName, serverInstanceConfig);
    expect(mcpConnectionManager.connect).toHaveBeenCalled();
  });

  it('should NOT auto-connect when adding a disabled server instance', async () => {
    const serverName = 'Disabled Server';
    const serverBaseConfig = {
      type: 'stdio',
      command: 'node',
      args: [],
      enabled: false,
      allowedTools: [],
      longRunning: true
    };

    const serverInstanceConfig = {
      id: 'test-server-disabled',
      name: serverName,
      timestamp: Date.now(),
      hash: 'test-hash'
    };

    vi.mocked(configManager.addServer).mockResolvedValue(serverBaseConfig as any);
    vi.mocked(configManager.addServerInstance).mockResolvedValue(serverInstanceConfig as any);
    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig as any);

    await service.addServer(serverName, serverBaseConfig as any);
    await service.addServerInstance(serverName, serverInstanceConfig as any);

    expect(configManager.addServer).toHaveBeenCalledWith(serverName, serverBaseConfig);
    expect(configManager.addServerInstance).toHaveBeenCalledWith(serverName, serverInstanceConfig);
    expect(mcpConnectionManager.connect).not.toHaveBeenCalled();
  });

  it('should call disconnect when removing a server', async () => {
    const serverName = 'Test Server';
    const serverConfig = {
      type: 'stdio',
      command: 'node',
      args: [],
      enabled: true,
      allowedTools: [],
      longRunning: true
    };

    vi.mocked(configManager.getServerByName).mockReturnValue(serverConfig as any);
    vi.mocked(configManager.removeServer).mockResolvedValue();
    vi.mocked(configManager.getServerInstanceByName).mockReturnValue([
      {
        id: 'test-server-instance',
        timestamp: Date.now(),
        hash: 'test-hash'
      }
    ] as any);

    await service.removeServer(serverName);

    expect(configManager.removeServer).toHaveBeenCalledWith(serverName);
    expect(mcpConnectionManager.disconnect).toHaveBeenCalledWith('test-server-instance');
  });

  it('should get server by name', async () => {
    const serverName = 'Test Server';
    const serverBaseConfig = {
      id: 'test-server',
      name: serverName,
      timestamp: Date.now(),
      hash: 'test-hash'
    };

    vi.mocked(configManager.getServerByName).mockReturnValue(serverBaseConfig as any);

    const server = service.getServerByName(serverName);

    expect(server).toEqual(serverBaseConfig);
    expect(configManager.getServerByName).toHaveBeenCalledWith(serverName);
  });

  it('should get server instances', async () => {
    const serverName = 'Test Server';
    const serverInstanceConfig = {
      type: 'stdio',
      command: 'node',
      args: [],
      enabled: true,
      allowedTools: [],
      longRunning: true
    };

    vi.mocked(configManager.getServerInstanceByName).mockReturnValue([serverInstanceConfig] as any);

    const instances = service.getServerInstanceByName(serverName);

    expect(instances).toEqual([serverInstanceConfig]);
    expect(configManager.getServerInstanceByName).toHaveBeenCalledWith(serverName);
  });
});
