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
    updateServer: vi.fn(),
    removeServer: vi.fn(),
  }
}));

vi.mock('../../../src/services/mcp-connection-manager.js', () => ({
  mcpConnectionManager: {
    connect: vi.fn(),
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

  it('should auto-connect when adding an enabled server', async () => {
    const newServer = { 
      id: 'test-server', 
      name: 'Test Server', 
      command: 'node', 
      args: [], 
      enabled: true 
    };
    
    vi.mocked(configManager.addServer).mockResolvedValue(newServer as any);
    
    await service.addServer(newServer as any);
    
    expect(configManager.addServer).toHaveBeenCalledWith(newServer);
    expect(mcpConnectionManager.connect).toHaveBeenCalledWith(newServer);
  });

  it('should NOT auto-connect when adding a disabled server', async () => {
    const newServer = { 
      id: 'test-server-disabled', 
      name: 'Disabled Server', 
      command: 'node', 
      args: [], 
      enabled: false 
    };
    
    vi.mocked(configManager.addServer).mockResolvedValue(newServer as any);
    
    await service.addServer(newServer as any);
    
    expect(configManager.addServer).toHaveBeenCalledWith(newServer);
    expect(mcpConnectionManager.connect).not.toHaveBeenCalled();
  });
});
