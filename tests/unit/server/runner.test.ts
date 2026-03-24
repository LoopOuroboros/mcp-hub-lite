import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runServer } from '@server/runner.js';
import { buildApp } from '@src/app.js';
import { configManager } from '@config/config-manager.js';
import { logger } from '@utils/logger.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { gateway } from '@services/gateway.service.js';
import { PidManager } from '@pid/manager.js';
import { checkPort } from '@utils/port-checker.js';
import type { FastifyInstance } from 'fastify';
import type { SystemConfig, ServerConfig } from '@config/config.schema.js';

// Mock resolveInstanceConfig to return a valid resolved config
vi.mock('@config/config-migrator.js', () => ({
  resolveInstanceConfig: vi.fn(() => ({
    command: 'test-command',
    args: [],
    type: 'stdio' as const,
    timeout: 30000,
    aggregatedTools: [],
    tags: {},
    enabled: true
  })),
  getEnabledInstances: vi.fn()
}));

// Mock all dependencies
vi.mock('@src/app.js', () => ({
  buildApp: vi.fn()
}));

vi.mock('@config/config-manager.js', () => ({
  configManager: {
    getConfig: vi.fn(),
    getServers: vi.fn(),
    getServerInstancesByName: vi.fn(),
    addServerInstance: vi.fn()
  }
}));

vi.mock('@utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    setUseStderr: vi.fn(),
    enableDevLog: vi.fn(),
    setLevel: vi.fn()
  },
  LOG_MODULES: {
    SERVER: { module: 'Server' }
  }
}));

vi.mock('@services/mcp-connection-manager.js', () => ({
  mcpConnectionManager: {
    connect: vi.fn(),
    disconnectAll: vi.fn()
  }
}));

vi.mock('@services/gateway.service.js', () => ({
  gateway: {
    start: vi.fn()
  }
}));

vi.mock('@pid/manager.js', () => ({
  PidManager: {
    writePid: vi.fn(),
    removePid: vi.fn()
  }
}));

vi.mock('@utils/port-checker.js', () => ({
  checkPort: vi.fn()
}));

describe('Server Runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset process event listeners
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  afterEach(() => {
    // Clean up any remaining listeners
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  describe('runServer function', () => {
    it('should start server in HTTP mode successfully', async () => {
      // Setup mocks
      const mockApp = {
        listen: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined)
      } as unknown as FastifyInstance;
      vi.mocked(buildApp).mockResolvedValue(mockApp);

      const mockConfig: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 3000,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);
      vi.mocked(checkPort).mockResolvedValue({ inUse: false });

      // Execute
      await runServer({ stdio: false, port: 3000, host: 'localhost' });

      // Verify
      expect(buildApp).toHaveBeenCalled();
      expect(mockApp.listen).toHaveBeenCalledWith({ port: 3000, host: 'localhost' });
      expect(PidManager.writePid).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'MCP Hub Lite Server running at http://localhost:3000',
        expect.any(Object)
      );
    });

    it('should start server in stdio mode successfully', async () => {
      // Setup mocks
      const mockConfig: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 3000,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);

      // Execute
      await runServer({ stdio: true });

      // Verify
      expect(buildApp).not.toHaveBeenCalled();
      expect(gateway.start).toHaveBeenCalled();
      expect(PidManager.writePid).toHaveBeenCalled();
      expect(logger.setUseStderr).toHaveBeenCalledWith(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Starting in MCP Gateway mode (stdio)...',
        expect.any(Object)
      );
    });

    it('should handle port already in use by self project', async () => {
      // Setup mocks
      const mockApp = { listen: vi.fn(), close: vi.fn() } as unknown as FastifyInstance;
      vi.mocked(buildApp).mockResolvedValue(mockApp);

      const mockConfig: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 3000,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);
      vi.mocked(checkPort).mockResolvedValue({
        inUse: true,
        isSelfProject: true,
        pid: 1234
      });

      // Spy on process.exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as (code?: number | string | null) => never);

      // Execute and expect error
      await expect(runServer({ stdio: false, port: 3000, host: 'localhost' })).rejects.toThrow(
        'process.exit called'
      );

      // Verify
      expect(logger.error).toHaveBeenCalledWith(
        'MCP Hub Lite is already running on port 3000 (PID: 1234)'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      // Restore
      exitSpy.mockRestore();
    });

    it('should handle port already in use by other application', async () => {
      // Setup mocks
      const mockApp = { listen: vi.fn(), close: vi.fn() } as unknown as FastifyInstance;
      vi.mocked(buildApp).mockResolvedValue(mockApp);

      const mockConfig: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 3000,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);
      vi.mocked(checkPort).mockResolvedValue({
        inUse: true,
        isSelfProject: false,
        pid: 5678,
        processName: 'other-app',
        commandLine: 'node other-app.js'
      });

      // Spy on process.exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as (code?: number | string | null) => never);

      // Execute and expect error
      await expect(runServer({ stdio: false, port: 3000, host: 'localhost' })).rejects.toThrow(
        'process.exit called'
      );

      // Verify
      expect(logger.error).toHaveBeenCalledWith(
        'Port 3000 is already in use by another application:'
      );
      expect(logger.error).toHaveBeenCalledWith('  Process: other-app (PID: 5678)');
      expect(logger.error).toHaveBeenCalledWith('  Command: node other-app.js');
      expect(exitSpy).toHaveBeenCalledWith(1);

      // Restore
      exitSpy.mockRestore();
    });

    it('should auto-connect to enabled servers', async () => {
      // Setup mocks
      const mockApp = {
        listen: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined)
      } as unknown as FastifyInstance;
      vi.mocked(buildApp).mockResolvedValue(mockApp);

      const mockConfig: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 3000,
          language: 'zh' as const,
          theme: 'system' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(checkPort).mockResolvedValue({ inUse: false });

      const mockServers: Array<{ name: string; config: ServerConfig }> = [
        {
          name: 'enabled-server',
          config: {
            template: {
              command: 'test-command',
              type: 'stdio' as const,
              args: [],
              aggregatedTools: [],
              timeout: 30000
            },
            instances: [{ id: 'instance-1', enabled: true, args: [], tags: {} }],
            tagDefinitions: []
          }
        },
        {
          name: 'disabled-server',
          config: {
            template: {
              command: 'test-command',
              type: 'stdio' as const,
              args: [],
              aggregatedTools: [],
              timeout: 30000
            },
            instances: [{ id: 'instance-2', enabled: false, args: [], tags: {} }],
            tagDefinitions: []
          }
        }
      ];
      vi.mocked(configManager.getServers).mockReturnValue(mockServers);
      vi.mocked(configManager.getServerInstancesByName).mockImplementation((name: string) => {
        if (name === 'enabled-server') return [];
        return [{ id: 'instance-1', enabled: false, args: [], tags: {} }];
      });
      vi.mocked(configManager.addServerInstance).mockResolvedValue({
        id: 'new-instance',
        enabled: true,
        args: [],
        tags: {}
      });

      // Execute
      await runServer({ stdio: false, port: 3000, host: 'localhost' });

      // Verify
      // Only enabled server should be connected (1 call expected)
      expect(mcpConnectionManager.connect).toHaveBeenCalledTimes(1);
      // Call for enabled server with new instance
      expect(mcpConnectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          command: 'test-command',
          id: 'new-instance'
        })
      );
    });

    it('should handle graceful shutdown on SIGTERM', async () => {
      // Setup mocks
      const mockApp = {
        listen: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined)
      } as unknown as FastifyInstance;
      vi.mocked(buildApp).mockResolvedValue(mockApp);

      const mockConfig: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 3000,
          language: 'zh' as const,
          theme: 'light' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);
      vi.mocked(checkPort).mockResolvedValue({ inUse: false });

      // Spy on process.exit
      const exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as (code?: number | string | null) => never);

      // Start server
      await runServer({ stdio: false, port: 3000, host: 'localhost' });

      // Trigger SIGTERM
      process.emit('SIGTERM');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify
      expect(mcpConnectionManager.disconnectAll).toHaveBeenCalled();
      expect(mockApp.close).toHaveBeenCalled();
      expect(PidManager.removePid).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Server stopped gracefully', expect.any(Object));
      expect(exitSpy).toHaveBeenCalledWith(0);

      // Restore
      exitSpy.mockRestore();
    });

    it('should handle graceful shutdown on SIGINT', async () => {
      // Setup mocks
      const mockApp = {
        listen: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined)
      } as unknown as FastifyInstance;
      vi.mocked(buildApp).mockResolvedValue(mockApp);

      const mockConfig: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 3000,
          language: 'zh' as const,
          theme: 'light' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);
      vi.mocked(checkPort).mockResolvedValue({ inUse: false });

      // Spy on process.exit
      const exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as (code?: number | string | null) => never);

      // Start server
      await runServer({ stdio: false, port: 3000, host: 'localhost' });

      // Trigger SIGINT
      process.emit('SIGINT');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify
      expect(mcpConnectionManager.disconnectAll).toHaveBeenCalled();
      expect(mockApp.close).toHaveBeenCalled();
      expect(PidManager.removePid).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Server stopped gracefully', expect.any(Object));
      expect(exitSpy).toHaveBeenCalledWith(0);

      // Restore
      exitSpy.mockRestore();
    });

    it('should handle startup errors gracefully', async () => {
      // Setup mocks to throw error
      vi.mocked(buildApp).mockRejectedValue(new Error('Startup failed'));

      const mockConfig: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 3000,
          language: 'zh' as const,
          theme: 'light' as const,
          logging: {
            level: 'info' as const,
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 30 * 60 * 1000,
          sessionFlushInterval: 15 * 60 * 1000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);

      // Spy on process.exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as (code?: number | string | null) => never);

      // Execute and expect error
      await expect(runServer({ stdio: false, port: 3000, host: 'localhost' })).rejects.toThrow(
        'process.exit called'
      );

      // Verify
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to start server:',
        expect.any(Error),
        expect.any(Object)
      );
      expect(PidManager.removePid).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);

      // Restore
      exitSpy.mockRestore();
    });
  });
});
