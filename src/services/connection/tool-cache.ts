import { logger, LOG_MODULES } from '@utils/logger.js';
import type { Tool } from '@shared-models/tool.model.js';
import { getCompositeKey } from '@utils/composite-key.js';

/**
 * Manages tool caching for MCP connections at both composite key and server name levels.
 *
 * This class encapsulates all tool cache operations, providing both composite key-level
 * and server name-level caching for efficient tool lookup while maintaining data
 * consistency across multiple instances of the same server.
 */
export class ToolCache {
  private toolCache: Map<string, Tool[]> = new Map();
  private serverNameToolCache: Map<string, Tool[]> = new Map();
  private nameToCompositeKeyMap: Map<string, string> = new Map();

  /**
   * Sets the name-to-composite-key mapping for server name resolution.
   *
   * @param serverName - The server name
   * @param compositeKey - The corresponding composite key
   */
  setNameMapping(serverName: string, compositeKey: string): void {
    this.nameToCompositeKeyMap.set(serverName, compositeKey);
  }

  /**
   * Removes the name-to-composite-key mapping for a server.
   *
   * @param serverName - The server name to remove
   */
  removeNameMapping(serverName: string): void {
    this.nameToCompositeKeyMap.delete(serverName);
  }

  /**
   * Removes name mapping by composite key.
   *
   * @param compositeKey - The composite key to remove
   */
  removeNameMappingById(compositeKey: string): void {
    for (const [name, key] of this.nameToCompositeKeyMap.entries()) {
      if (key === compositeKey) {
        this.nameToCompositeKeyMap.delete(name);
        break;
      }
    }
  }

  /**
   * Gets the composite key for a given server name.
   *
   * @param name - The server name
   * @returns The composite key or undefined if not found
   */
  getCompositeKeyByName(name: string): string | undefined {
    return this.nameToCompositeKeyMap.get(name);
  }

  /**
   * Gets the server name for a given composite key.
   *
   * @param compositeKey - The composite key
   * @returns The server name or 'unknown' if not found
   */
  getServerNameById(compositeKey: string): string {
    for (const [name, key] of this.nameToCompositeKeyMap.entries()) {
      if (key === compositeKey) {
        return name;
      }
    }
    return 'unknown';
  }

  /**
   * Sets tools for a specific server instance and updates both caches.
   *
   * @param serverName - The server name
   * @param serverIndex - The instance index
   * @param tools - The tools to cache
   */
  setTools(serverName: string, serverIndex: number, tools: Tool[]): void {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    this.toolCache.set(compositeKey, tools);
    this.updateServerNameCache(serverName);

    logger.debug(
      `ToolCache: Set ${tools.length} tools for server [${compositeKey}]`,
      LOG_MODULES.CONNECTION_MANAGER
    );
  }

  /**
   * Gets tools for a specific server instance.
   *
   * @param serverName - The server name
   * @param serverIndex - The instance index
   * @returns Array of tools, empty if none
   */
  getTools(serverName: string, serverIndex: number): Tool[] {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    const tools = this.toolCache.get(compositeKey) || [];
    const fromCache = this.toolCache.has(compositeKey);
    logger.debug(
      `ToolCache: getTools for [${compositeKey}]: returned ${tools.length} tools (${fromCache ? 'from cache' : 'no cache'})`,
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
   * @returns Array of [compositeKey, tools] tuples
   */
  getToolCacheEntries(): [string, Tool[]][] {
    return Array.from(this.toolCache.entries());
  }

  /**
   * Returns an iterator over the tool cache entries for backward compatibility.
   * This mimics the Map.entries() method signature.
   *
   * @returns Iterator of [compositeKey, tools] tuples
   * @deprecated Use getToolCacheEntries() instead
   */
  entries(): IterableIterator<[string, Tool[]]> {
    return this.toolCache.entries();
  }

  /**
   * Clears tools for a specific server and updates both caches.
   *
   * @param serverName - The server name
   * @param serverIndex - The instance index
   */
  clearTools(serverName: string, serverIndex: number): void {
    const compositeKey = getCompositeKey(serverName, serverIndex);
    this.toolCache.delete(compositeKey);
    this.updateServerNameCache(serverName);

    logger.debug(
      `ToolCache: Cleared tools for server [${compositeKey}]`,
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

    for (const [compositeKey, cachedTools] of this.toolCache.entries()) {
      const instanceServerName = this.getServerNameById(compositeKey);
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
