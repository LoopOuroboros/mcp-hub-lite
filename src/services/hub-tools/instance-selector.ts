import type { ServerConfig, ServerInstance } from '@shared-models/server.model.js';
import { InstanceSelectionStrategy } from '@models/server.model.js';

/**
 * Error thrown when tag-match-unique instance selection fails.
 * Passes raw data so the error class itself can format the message.
 */
export class TagMatchUniqueError extends Error {
  constructor(
    public readonly instanceCount: number,
    public readonly requestTags?: Record<string, string>
  ) {
    let message: string;
    if (!requestTags) {
      message = `No tags provided for tag-match-unique strategy with ${instanceCount} instances. Expected exactly one instance or specific tags for unique selection.`;
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
   */
  static selectInstance(
    serverName: string,
    serverConfig: ServerConfig,
    requestOptions?: { sessionId?: string; tags?: Record<string, string> }
  ): ServerInstance | undefined {
    const { instances } = serverConfig;
    const instanceSelectionStrategy =
      serverConfig.template.instanceSelectionStrategy || InstanceSelectionStrategy.RANDOM;

    // Filter enabled instances
    const enabledInstances = instances.filter((instance) => instance.enabled !== false);
    if (enabledInstances.length === 0) {
      return undefined;
    }

    // Single instance case - return directly
    if (enabledInstances.length === 1) {
      return enabledInstances[0];
    }

    switch (instanceSelectionStrategy) {
      case InstanceSelectionStrategy.RANDOM:
        return this.selectRandomInstance(enabledInstances);

      case InstanceSelectionStrategy.ROUND_ROBIN:
        return this.selectRoundRobinInstance(serverName, enabledInstances);

      case InstanceSelectionStrategy.TAG_MATCH_UNIQUE:
        return this.selectTagMatchUniqueInstance(enabledInstances, requestOptions?.tags);

      default:
        return enabledInstances[0]; // Fallback to first instance
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
    if (!requestTags || Object.keys(requestTags).length === 0) {
      // If no request tags provided, must have exactly one instance to avoid ambiguity
      if (instances.length === 1) {
        return instances[0];
      } else {
        throw new TagMatchUniqueError(instances.length);
      }
    }

    const matchingInstances = instances.filter((instance) => {
      if (!instance.tags) return false;

      // Check if all request tags match instance tags
      return Object.entries(requestTags).every(([key, value]) => instance.tags![key] === value);
    });

    // Must have exactly one matching instance
    if (matchingInstances.length !== 1) {
      throw new TagMatchUniqueError(matchingInstances.length, requestTags);
    }

    return matchingInstances[0];
  }
}
