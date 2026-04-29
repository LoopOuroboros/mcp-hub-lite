import type { ServerConfig, ServerInstance } from '@shared-models/server.model.js';
import { InstanceSelectionStrategy } from '@models/server.model.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';

/**
 * Error thrown when tag-match-unique instance selection fails.
 * Passes raw data so the error class itself can format the message.
 */
export class TagMatchUniqueError extends Error {
  constructor(
    public readonly instanceCount: number,
    public readonly requestTags?: Record<string, string>,
    public readonly availableInstances?: Record<number, Record<string, string>>
  ) {
    let message: string;
    if (!requestTags) {
      // Format available instances as index:tags for easy selection
      const instancesStr = availableInstances
        ? Object.entries(availableInstances)
            .map(([index, tags]) => `${index}:${JSON.stringify(tags)}`)
            .join(', ')
        : '';
      message = `No tags provided for tag-match-unique strategy with ${instanceCount} instances. Available: [${instancesStr}]. Pass matching tags to select.`;
    } else if (instanceCount === 0) {
      message = `No instance found matching tags: ${JSON.stringify(requestTags)}`;
    } else {
      message = `Multiple instances match tags: ${JSON.stringify(requestTags)}. Expected unique match.`;
    }
    super(message);
    this.name = 'TagMatchUniqueError';
  }
}

/**
 * Instance selector for multi-instance servers
 * Implements three selection strategies: random, round-robin, and tag-match-unique
 */
export class InstanceSelector {
  private static roundRobinCounters = new Map<string, number>();

  /**
   * Select best instance based on configured strategy
   *
   * @param serverName - Name of the server
   * @param serverConfig - Server configuration
   * @param requestOptions - Optional request options for instance selection
   * @param statusChecker - Optional function to check instance connection status (for testing)
   */
  static selectInstance(
    serverName: string,
    serverConfig: ServerConfig,
    requestOptions?: { sessionId?: string; tags?: Record<string, string> },
    statusChecker?: (serverName: string, index: number) => { connected?: boolean } | undefined
  ): ServerInstance | undefined {
    const { instances } = serverConfig;
    const instanceSelectionStrategy =
      serverConfig.template.instanceSelectionStrategy || InstanceSelectionStrategy.RANDOM;

    // Use provided statusChecker or default to mcpConnectionManager.getStatus
    const checkStatus =
      statusChecker || ((name: string, idx: number) => mcpConnectionManager.getStatus(name, idx));

    // Filter instances - use runtime connected status, NOT config enabled flag
    // enabled=false means "do not auto-start" but user can manually start it
    const connectedInstances = instances.filter((instance) => {
      if (instance.index === undefined) return false;
      const status = checkStatus(serverName, instance.index);
      return status?.connected;
    });
    if (connectedInstances.length === 0) {
      return undefined;
    }

    // Single instance case - return directly
    if (connectedInstances.length === 1) {
      return connectedInstances[0];
    }

    switch (instanceSelectionStrategy) {
      case InstanceSelectionStrategy.RANDOM:
        return this.selectRandomInstance(connectedInstances);

      case InstanceSelectionStrategy.ROUND_ROBIN:
        return this.selectRoundRobinInstance(serverName, connectedInstances);

      case InstanceSelectionStrategy.TAG_MATCH_UNIQUE:
        return this.selectTagMatchUniqueInstance(connectedInstances, requestOptions?.tags);

      default:
        return connectedInstances[0]; // Fallback to first instance
    }
  }

  private static selectRandomInstance(instances: ServerInstance[]): ServerInstance {
    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
  }

  private static selectRoundRobinInstance(
    serverName: string,
    instances: ServerInstance[]
  ): ServerInstance {
    const counter = this.roundRobinCounters.get(serverName) || 0;
    const selectedInstance = instances[counter % instances.length];
    this.roundRobinCounters.set(serverName, (counter + 1) % instances.length);
    return selectedInstance;
  }

  private static selectTagMatchUniqueInstance(
    instances: ServerInstance[],
    requestTags?: Record<string, string>
  ): ServerInstance | undefined {
    // Build available instances map with index:tags format
    const availableInstances: Record<number, Record<string, string>> = {};
    instances.forEach((instance, index) => {
      availableInstances[index] = instance.tags || {};
    });

    if (!requestTags || Object.keys(requestTags).length === 0) {
      // If no request tags provided, must have exactly one instance to avoid ambiguity
      if (instances.length === 1) {
        return instances[0];
      } else {
        throw new TagMatchUniqueError(instances.length, undefined, availableInstances);
      }
    }

    const matchingInstances = instances.filter((instance) => {
      if (!instance.tags) return false;

      // Check if all request tags match instance tags
      return Object.entries(requestTags).every(([key, value]) => instance.tags![key] === value);
    });

    // Must have exactly one matching instance
    if (matchingInstances.length !== 1) {
      throw new TagMatchUniqueError(matchingInstances.length, requestTags, availableInstances);
    }

    return matchingInstances[0];
  }
}
