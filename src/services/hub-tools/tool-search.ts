import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import type { Tool } from '@shared-models/tool.model.js';
import { hasValidId, selectBestInstance } from './server-selector.js';
import type { RequestOptions } from './types.js';

/**
 * Search options for server searches.
 */
export interface SearchOptions {
  searchIn?: 'name' | 'description' | 'both';
  caseSensitive?: boolean;
}

/**
 * Finds servers matching a specified regex pattern.
 *
 * This method searches through all configured servers using the provided regex pattern,
 * supporting flexible search options including case sensitivity and search scope
 * (name, description, or both). It returns an array of matching server names.
 *
 * @param {string} pattern - Regex pattern to search for in server names and descriptions
 * @param {'name' | 'description' | 'both'} [searchIn='both'] - Where to perform the search
 * @param {boolean} [caseSensitive=false] - Whether the search should be case-sensitive
 * @returns {Promise<string[]>} Array of matching server names
 *
 * @example
 * ```typescript
 * // Find servers with 'api' in their name (case-insensitive)
 * const apiServers = await findServers('api');
 *
 * // Find servers with exact case match
 * const exactMatch = await findServers('^MyServer$', 'name', true);
 * ```
 */
export async function findServers(
  pattern: string,
  searchIn: 'name' | 'description' | 'both' = 'both',
  caseSensitive: boolean = false
): Promise<string[]> {
  const allServers = hubManager.getAllServers();
  const validServers = allServers.filter(hasValidId);
  const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

  return validServers
    .filter((server) => {
      const matchName = searchIn !== 'description' && regex.test(server.name);
      const matchDescription = searchIn !== 'name' && server.name && regex.test(server.name); // Using name as fallback if no description
      return matchName || matchDescription;
    })
    .map((server) => server.name);
}

/**
 * Finds tools matching a pattern within a specific MCP server.
 *
 * This method searches through all tools available from the specified server using
 * the provided regex pattern, supporting flexible search options including case
 * sensitivity and search scope (name, description, or both). It returns matching
 * tools grouped by server name.
 *
 * @param {string} serverName - Name of the MCP server to search tools in
 * @param {string} pattern - Regex pattern to search for in tool names and descriptions
 * @param {'name' | 'description' | 'both'} [searchIn='both'] - Where to perform the search
 * @param {boolean} [caseSensitive=false] - Whether the search should be case-sensitive
 * @param {RequestOptions} [requestOptions] - Optional request options for instance selection
 * @returns {Promise<{ serverName: string; tools: Tool[] }>} Object containing server name and matching tools
 * @throws {Error} If the specified server is not found or not connected
 *
 * @example
 * ```typescript
 * const result = await findToolsInServer('my-mcp-server', 'list');
 * console.log(`Found ${result.tools.length} tools matching 'list'`);
 * ```
 */
export async function findToolsInServer(
  serverName: string,
  pattern: string,
  searchIn: 'name' | 'description' | 'both' = 'both',
  caseSensitive: boolean = false,
  requestOptions?: RequestOptions
): Promise<{
  serverName: string;
  tools: Tool[];
}> {
  const serverInfo = selectBestInstance(serverName, requestOptions);

  if (!serverInfo) {
    throw new Error(`Server not found: ${serverName}`);
  }

  const tools = mcpConnectionManager.getTools(serverInfo.instance.id);
  const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

  const matchingTools = tools.filter((tool) => {
    const matchName = searchIn !== 'description' && regex.test(tool.name);
    const matchDescription =
      searchIn !== 'name' && tool.description && regex.test(tool.description);
    return matchName || matchDescription;
  });

  return {
    serverName: serverName,
    tools: matchingTools
  };
}

/**
 * Finds tools matching a pattern across all connected MCP servers.
 *
 * This method searches through all available tools from all connected servers using the
 * provided regex pattern, supporting flexible search options including case sensitivity
 * and search scope (name, description, or both). It returns matching tools grouped by
 * their originating server names.
 *
 * @param {string} pattern - Regex pattern to search for in tool names and descriptions
 * @param {'name' | 'description' | 'both'} [searchIn='both'] - Where to perform the search
 * @param {boolean} [caseSensitive=false] - Whether the search should be case-sensitive
 * @param {() => Promise<Record<string, { tools: Tool[] }>>} listAllToolsFn - Function to list all tools
 * @returns {Promise<Record<string, { tools: Tool[] }>>} Object mapping server names to matching tools
 *
 * @example
 * ```typescript
 * const matchingTools = await findTools('list');
 * Object.entries(matchingTools).forEach(([serverName, { tools }]) => {
 *   console.log(`${serverName}: ${tools.length} matching tools`);
 * });
 * ```
 */
export async function findTools(
  pattern: string,
  searchIn: 'name' | 'description' | 'both' = 'both',
  caseSensitive: boolean = false,
  listAllToolsFn: () => Promise<Record<string, { tools: Tool[] }>>
): Promise<Record<string, { tools: Tool[] }>> {
  const allTools = await listAllToolsFn();
  const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

  const matchingTools: Record<string, { tools: Tool[] }> = {};

  for (const [serverName, serverData] of Object.entries(allTools)) {
    const filteredTools = serverData.tools.filter((tool) => {
      const matchName = searchIn !== 'description' && regex.test(tool.name);
      const matchDescription =
        searchIn !== 'name' && tool.description && regex.test(tool.description);
      return matchName || matchDescription;
    });

    if (filteredTools.length > 0) {
      matchingTools[serverName] = {
        tools: filteredTools
      };
    }
  }

  return matchingTools;
}
