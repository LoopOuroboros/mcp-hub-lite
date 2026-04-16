import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runServer } from '@server/runner.js';
import { buildApp } from '@src/app.js';
import { configManager } from '@config/config-manager.js';
import { logger } from '@utils/logger.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { PidManager } from '@pid/manager.js';
import { checkPort, checkPortWithExit } from '@utils/port-checker.js';
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
    connect: vi.fn(() => Promise.resolve(true)),
    disconnectAll: vi.fn()
  }
}));

vi.mock('@pid/manager.js', () => ({
  PidManager: {
    writePid: vi.fn(),
    removePid: vi.fn()
  }
}));

vi.mock('@utils/port-checker.js', () => ({
  checkPort: vi.fn(),
  checkPortWithExit: vi.fn().mockResolvedValue(undefined)
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
    // Reset mock implementations that might persist between tests
    vi.mocked(checkPortWithExit).mockReset();
    vi.mocked(configManager.addServerInstance).mockReset();
    vi.mocked(configManager.getServerInstancesByName).mockReset();
  });

  describe('runServer function', () => {
    it('should start server successfully', async () => {
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
            apiDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);
      vi.mocked(checkPort).mockResolvedValue({ inUse: false });

      // Execute
      await runServer({ port: 3000, host: 'localhost' });

      // Verify
      expect(buildApp).toHaveBeenCalled();
      expect(mockApp.listen).toHaveBeenCalledWith({ port: 3000, host: 'localhost' });
      expect(PidManager.writePid).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'MCP Hub Lite Server running at http://localhost:3000',
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
            apiDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);

      // Spy on process.exit before setting up checkPortWithExit mock
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as (code?: number | string | null) => never);

      // Mock checkPortWithExit to call process.exit(1)
      vi.mocked(checkPortWithExit).mockImplementation(() => {
        // Call the real implementation's exit behavior
        logger.error(
          'MCP Hub Lite is already running on port 3000 (PID: 1234)',
          expect.any(Object)
        );
        logger.error(
          "Use 'npm run stop' or 'mcp-hub-lite stop' to stop the running instance.",
          expect.any(Object)
        );
        process.exit(1);
      });

      // Execute and expect error
      await expect(runServer({ port: 3000, host: 'localhost' })).rejects.toThrow(
        'process.exit called'
      );

      // Verify
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
            apiDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };
      vi.mocked(configManager.getConfig).mockReturnValue(mockConfig);
      vi.mocked(configManager.getServers).mockReturnValue([]);

      // Spy on process.exit before setting up checkPortWithExit mock
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as (code?: number | string | null) => never);

      // Mock checkPortWithExit to call process.exit(1)
      vi.mocked(checkPortWithExit).mockImplementation(() => {
        // Call the real implementation's exit behavior
        logger.error('Port 3000 is already in use by another application:', expect.any(Object));
        logger.error('  Process: other-app (PID: 5678)', expect.any(Object));
        logger.error('  Command: node other-app.js', expect.any(Object));
        logger.error(
          'Please stop the conflicting application or use a different port.',
          expect.any(Object)
        );
        process.exit(1);
      });

      // Execute and expect error
      await expect(runServer({ port: 3000, host: 'localhost' })).rejects.toThrow(
        'process.exit called'
      );

      // Verify
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
            apiDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
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
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000
            },
            instances: [
              { id: 'instance-1', enabled: true, args: [], env: {}, headers: {}, tags: {} }
            ],
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
              env: {},
              headers: {},
              aggregatedTools: [],
              timeout: 30000
            },
            instances: [
              { id: 'instance-2', enabled: false, args: [], env: {}, headers: {}, tags: {} }
            ],
            tagDefinitions: []
          }
        }
      ];
      vi.mocked(configManager.getServers).mockReturnValue(mockServers);

      // Track if addServerInstance was called for enabled-server
      let addServerInstanceCalled = false;
      vi.mocked(configManager.addServerInstance).mockImplementation(async (name: string) => {
        if (name === 'enabled-server') {
          addServerInstanceCalled = true;
          return {
            id: 'new-instance',
            enabled: true,
            args: [],
            env: {},
            headers: {},
            tags: {}
          };
        }
        return {
          id: 'instance-1',
          enabled: false,
          args: [],
          env: {},
          headers: {},
          tags: {}
        };
      });

      // Make getServerInstancesByName return the new instance after addServerInstance is called
      vi.mocked(configManager.getServerInstancesByName).mockImplementation((name: string) => {
        if (name === 'enabled-server') {
          return addServerInstanceCalled
            ? [{ id: 'new-instance', enabled: true, args: [], env: {}, headers: {}, tags: {} }]
            : [];
        }
        return [{ id: 'instance-1', enabled: false, args: [], env: {}, headers: {}, tags: {} }];
      });

      // Execute
      await runServer({ port: 3000, host: 'localhost' });

      // Verify
      // Only enabled server should be connected (1 call expected)
      expect(mcpConnectionManager.connect).toHaveBeenCalledTimes(1);
      // Call for enabled server with new instance
      expect(mcpConnectionManager.connect).toHaveBeenCalledWith(
        'enabled-server',
        0,
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
            apiDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
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
      await runServer({ port: 3000, host: 'localhost' });

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
            apiDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
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
      await runServer({ port: 3000, host: 'localhost' });

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
            apiDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
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
      await expect(runServer({ port: 3000, host: 'localhost' })).rejects.toThrow(
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
