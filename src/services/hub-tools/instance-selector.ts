import type { ServerConfig, ServerInstance } from '@shared-models/server.model.js';
import { InstanceSelectionStrategy } from '@models/server.model.js';

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
    const { instances, instanceSelectionStrategy = InstanceSelectionStrategy.RANDOM } =
      serverConfig;

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
      // If no request tags provided, return first instance
      return instances[0];
    }

    const matchingInstances = instances.filter((instance) => {
      if (!instance.tags) return false;

      // Check if all request tags match instance tags
      return Object.entries(requestTags).every(([key, value]) => instance.tags![key] === value);
    });

    if (matchingInstances.length === 0) {
      throw new Error(`No instance found matching tags: ${JSON.stringify(requestTags)}`);
    }

    if (matchingInstances.length > 1) {
      throw new Error(
        `Multiple instances match tags: ${JSON.stringify(requestTags)}. Expected unique match.`
      );
    }

    return matchingInstances[0];
  }
}
