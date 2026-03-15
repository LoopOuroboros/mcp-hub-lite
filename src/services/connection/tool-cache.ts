import { logger, LOG_MODULES } from '@utils/logger.js';
import type { Tool } from '@shared-models/tool.model.js';

/**
 * Manages tool caching for MCP connections at both server ID and server name levels.
 *
 * This class encapsulates all tool cache operations, providing both server ID-level
 * and server name-level caching for efficient tool lookup while maintaining data
 * consistency across multiple instances of the same server.
 */
export class ToolCache {
  private toolCache: Map<string, Tool[]> = new Map();
  private serverNameToolCache: Map<string, Tool[]> = new Map();
  private nameToIdMap: Map<string, string> = new Map();

  /**
   * Sets the name-to-ID mapping for server name resolution.
   *
   * @param serverName - The server name
   * @param serverId - The corresponding server instance ID
   */
  setNameMapping(serverName: string, serverId: string): void {
    this.nameToIdMap.set(serverName, serverId);
  }

  /**
   * Removes the name-to-ID mapping for a server.
   *
   * @param serverName - The server name to remove
   */
  removeNameMapping(serverName: string): void {
    this.nameToIdMap.delete(serverName);
  }

  /**
   * Removes name mapping by server ID.
   *
   * @param serverId - The server ID to remove
   */
  removeNameMappingById(serverId: string): void {
    for (const [name, id] of this.nameToIdMap.entries()) {
      if (id === serverId) {
        this.nameToIdMap.delete(name);
        break;
      }
    }
  }

  /**
   * Gets the server ID for a given server name.
   *
   * @param name - The server name
   * @returns The server ID or undefined if not found
   */
  getServerIdByName(name: string): string | undefined {
    return this.nameToIdMap.get(name);
  }

  /**
   * Gets the server name for a given server ID.
   *
   * @param serverId - The server ID
   * @returns The server name or 'unknown' if not found
   */
  getServerNameById(serverId: string): string {
    for (const [name, id] of this.nameToIdMap.entries()) {
      if (id === serverId) {
        return name;
      }
    }
    return 'unknown';
  }

  /**
   * Sets tools for a specific server instance and updates both caches.
   *
   * @param serverId - The server instance ID
   * @param tools - The tools to cache
   * @param serverName - Optional server name for name-level cache update
   */
  setTools(serverId: string, tools: Tool[], serverName?: string): void {
    this.toolCache.set(serverId, tools);

    if (serverName) {
      this.updateServerNameCache(serverName);
    } else {
      const resolvedName = this.getServerNameById(serverId);
      if (resolvedName !== 'unknown') {
        this.updateServerNameCache(resolvedName);
      }
    }

    logger.debug(
      `ToolCache: Set ${tools.length} tools for server [${serverId}]`,
      LOG_MODULES.CONNECTION_MANAGER
    );
  }

  /**
   * Gets tools for a specific server instance.
   *
   * @param serverId - The server instance ID
   * @returns Array of tools, empty if none
   */
  getTools(serverId: string): Tool[] {
    const tools = this.toolCache.get(serverId) || [];
    const fromCache = this.toolCache.has(serverId);
    logger.debug(
      `ToolCache: getTools for [${serverId}]: returned ${tools.length} tools (${fromCache ? 'from cache' : 'no cache'})`,
      LOG_MODULES.CONNECTION_MANAGER
    );
    return tools;
  }

  /**
   * Gets tools by server name from the server name-level cache.
   *
   * @param serverName - The server name
   * @returns Array of tools, empty if none
   */
  getToolsByServerName(serverName: string): Tool[] {
    return this.serverNameToolCache.get(serverName) || [];
  }

  /**
   * Gets a specific tool by name from the server name-level cache.
   *
   * @param serverName - The server name
   * @param toolName - The tool name to find
   * @returns The tool object or undefined if not found
   */
  getTool(serverName: string, toolName: string): Tool | undefined {
    const tools = this.serverNameToolCache.get(serverName);
    return tools?.find((t) => t.name === toolName);
  }

  /**
   * Gets all tools from all connected server instances.
   *
   * @returns Array of all tools from all servers
   */
  getAllTools(): Tool[] {
    const allTools: Tool[] = [];
    for (const tools of this.toolCache.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  /**
   * Gets all tools from the server name-level cache.
   *
   * @returns Array of all tools aggregated by server name
   */
  getAllToolsByServerName(): Tool[] {
    const allTools: Tool[] = [];
    for (const tools of this.serverNameToolCache.values()) {
      allTools.push(...tools);
    }
    return allTools;
  }

  /**
   * Gets all tool cache entries.
   *
   * @returns Array of [serverId, tools] tuples
   */
  getToolCacheEntries(): [string, Tool[]][] {
    return Array.from(this.toolCache.entries());
  }

  /**
   * Returns an iterator over the tool cache entries for backward compatibility.
   * This mimics the Map.entries() method signature.
   *
   * @returns Iterator of [serverId, tools] tuples
   * @deprecated Use getToolCacheEntries() instead
   */
  entries(): IterableIterator<[string, Tool[]]> {
    return this.toolCache.entries();
  }

  /**
   * Clears tools for a specific server and updates both caches.
   *
   * @param serverId - The server instance ID
   */
  clearTools(serverId: string): void {
    const serverName = this.getServerNameById(serverId);
    this.toolCache.delete(serverId);

    if (serverName !== 'unknown') {
      this.updateServerNameCache(serverName);
    }

    logger.debug(
      `ToolCache: Cleared tools for server [${serverId}]`,
      LOG_MODULES.CONNECTION_MANAGER
    );
  }

  /**
   * Updates the server name-level cache for a specific server.
   * This aggregates tools from all instances of the same server name.
   *
   * @param serverName - The server name to update
   */
  private updateServerNameCache(serverName: string): void {
    const allToolsForServer: Tool[] = [];

    for (const [id, cachedTools] of this.toolCache.entries()) {
      const instanceServerName = this.getServerNameById(id);
      if (instanceServerName === serverName) {
        allToolsForServer.push(...cachedTools);
      }
    }

    if (allToolsForServer.length > 0) {
      this.serverNameToolCache.set(serverName, allToolsForServer);
    } else {
      this.serverNameToolCache.delete(serverName);
    }
  }

  /**
   * Backward compatibility: direct access to the underlying toolCache Map.
   * This is maintained for backward compatibility with code that accesses
   * mcpConnectionManager.toolCache directly.
   */
  get internalToolCache(): Map<string, Tool[]> {
    return this.toolCache;
  }
}
