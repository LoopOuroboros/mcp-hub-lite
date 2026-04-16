/**
 * Server startup shared utilities
 *
 * This module provides shared connection task collection and execution logic
 * used by both production runner and development server.
 */

import { configManager } from '@config/config-manager.js';
import { resolveInstanceConfig } from '@config/config-migrator.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { logger } from '@utils/logger.js';
import type { LogModule } from '@utils/logger/log-modules.js';

/**
 * Shared connection task structure
 */
export interface ConnectTask {
  serverName: string;
  instanceId: string;
  instanceIndex: number;
  connectFn: () => Promise<boolean>;
}

/**
 * Collects all server connection tasks from config
 * - Collects existing instances that are enabled
 *
 * Note: Instance creation is handled by the caller via configManager.addServerInstance()
 * before calling this function.
 *
 * @returns Array of connection tasks ready for execution
 */
export function collectConnectTasks(): ConnectTask[] {
  const tasks: ConnectTask[] = [];
  const serverConfigs = configManager.getServers();

  for (const { name: serverName, config: serverConfig } of serverConfigs) {
    const existingInstances = configManager.getServerInstancesByName(serverName);

    if (existingInstances.length === 0) {
      // No instances - skip (caller should have created instances via addServerInstance)
      continue;
    }

    // Collect existing enabled instances
    for (const instance of existingInstances) {
      if (instance.enabled !== false) {
        const resolvedConfig = resolveInstanceConfig(serverConfig, instance.id);
        if (resolvedConfig) {
          tasks.push({
            serverName,
            instanceId: instance.id,
            instanceIndex: instance.index ?? 0,
            connectFn: () =>
              mcpConnectionManager.connect(serverName, instance.index ?? 0, {
                ...resolvedConfig,
                id: instance.id
              })
          });
        }
      }
    }
  }

  return tasks;
}

/**
 * Executes connection tasks with sequential delay (fire-and-forget)
 * - First task executes immediately
 * - Subsequent tasks wait baseDelay before execution
 */
export async function executeConnectTasks(
  tasks: ConnectTask[],
  baseDelay: number,
  logModule: LogModule
): Promise<void> {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    if (i > 0) {
      logger.info(
        `Delaying next server instance startup by ${baseDelay}ms (${i + 1}/${tasks.length})`,
        logModule
      );
      await new Promise((resolve) => setTimeout(resolve, baseDelay));
    }

    // Fire-and-forget: don't wait for connection completion
    task.connectFn().catch((err) => {
      logger.error(`Failed to auto-connect to ${task.serverName}:`, err, logModule);
    });
  }
}
