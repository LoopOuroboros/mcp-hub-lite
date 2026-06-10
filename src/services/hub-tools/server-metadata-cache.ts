import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/connection/index.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';
import { getServerDescription } from './server-selector.js';
import type { ServerMetadata } from './resource-generator.js';

/** Minimal payload shape shared by all subscribed events. */
interface EventPayload {
  serverName: string;
}

/**
 * Cached server-level metadata aggregated across all connected instances.
 * Updated reactively via EventBus subscriptions — no I/O, all synchronous cache lookups.
 */
class ServerMetadataCache {
  private cache = new Map<string, ServerMetadata>();
  private unsubscribers: Array<() => void> = [];
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.unsubscribers.push(
      eventBus.subscribe(EventTypes.SERVER_CONNECTED, (data: unknown) => {
        this.refresh((data as EventPayload).serverName);
      })
    );
    this.unsubscribers.push(
      eventBus.subscribe(EventTypes.SERVER_DISCONNECTED, (data: unknown) => {
        this.refresh((data as EventPayload).serverName);
      })
    );
    this.unsubscribers.push(
      eventBus.subscribe(EventTypes.TOOLS_UPDATED, (data: unknown) => {
        this.refresh((data as EventPayload).serverName);
      })
    );
    this.unsubscribers.push(
      eventBus.subscribe(EventTypes.RESOURCES_UPDATED, (data: unknown) => {
        this.refresh((data as EventPayload).serverName);
      })
    );

    // Cache populates lazily on first get() — avoids init-order issues in tests
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
    this.cache.clear();
    this.initialized = false;
  }

  get(serverName: string): ServerMetadata | undefined {
    // Lazy build on first access — no pre-population needed
    if (!this.cache.has(serverName)) {
      const metadata = this.buildMetadata(serverName);
      if (metadata) {
        this.cache.set(serverName, metadata);
      }
      return metadata;
    }
    return this.cache.get(serverName);
  }

  refresh(serverName: string): void {
    const metadata = this.buildMetadata(serverName);
    if (metadata) {
      this.cache.set(serverName, metadata);
    } else {
      this.cache.delete(serverName);
    }
  }

  refreshAll(): void {
    const servers = hubManager.getAllServers();
    for (const server of servers) {
      if (server.name) {
        this.refresh(server.name);
      }
    }
  }

  private buildMetadata(serverName: string): ServerMetadata | undefined {
    const serverConfig = hubManager.getServerByName(serverName);
    if (!serverConfig) return undefined;

    const connectedIndexes = mcpConnectionManager.getConnectedIndexes(serverName);
    if (connectedIndexes.length === 0) return undefined;

    // Aggregate tools across all instances (ToolCache already deduplicates by name)
    const tools = mcpConnectionManager.getToolsByServerName(serverName) || [];
    const toolsMap: Record<string, string> = {};
    for (const tool of tools) {
      toolsMap[tool.name as string] = (tool.description as string) || '';
    }

    // Aggregate resources across all instances
    const resources = mcpConnectionManager.getResourcesByName(serverName) || [];

    // Merge tags from all connected instances (later instance wins on conflict)
    const tags: Record<string, string> = {};
    const instances = hubManager.getServerInstancesByName(serverName);
    for (const instance of instances) {
      if (instance.index !== undefined && connectedIndexes.includes(instance.index)) {
        if (instance.tags && typeof instance.tags === 'object') {
          Object.assign(tags, instance.tags);
        }
      }
    }

    // Aggregate heartbeat (max) and uptime (min startTime) across instances
    let lastHeartbeat = 0;
    let uptime = Infinity;
    for (const idx of connectedIndexes) {
      const status = mcpConnectionManager.getStatus(serverName, idx);
      if (status) {
        if (status.lastCheck > lastHeartbeat) lastHeartbeat = status.lastCheck;
        if (status.startTime && status.startTime < uptime) uptime = status.startTime;
      }
    }
    if (uptime === Infinity) uptime = 0;

    return {
      name: serverName,
      status: 'online',
      toolsCount: tools.length,
      tools: toolsMap,
      resourcesCount: resources.length,
      tags,
      lastHeartbeat,
      uptime,
      description: getServerDescription(serverConfig, serverName)
    };
  }
}

export const serverMetadataCache = new ServerMetadataCache();
