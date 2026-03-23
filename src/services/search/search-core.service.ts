import type { Tool } from '@shared-models/tool.model.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { SearchResult, SearchOptions } from './types.js';
import { SearchScorer } from './search-scorer.js';
import { SearchCacheService } from './search-cache.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';
import { logger, LOG_MODULES } from '@utils/logger.js';

/**
 * Core search service that provides fuzzy search functionality across all available MCP tools.
 *
 * This service handles searching through tools from multiple MCP servers with intelligent
 * scoring, caching, and pagination support. It automatically refreshes its cache when
 * server configurations change to ensure search results remain up-to-date.
 *
 * The search algorithm uses a weighted scoring system that prioritizes:
 * 1. Exact name matches (highest priority)
 * 2. Name prefix matches
 * 3. Name substring matches
 * 4. Description matches (lower weight)
 *
 * Usage scenarios include:
 * - Tool discovery in the web UI
 * - Command-line tool search
 * - API-based tool lookup
 * - Integration with other services requiring tool search capabilities
 */
export class SearchCoreService {
  private cacheService = new SearchCacheService();
  private scorer = new SearchScorer();

  /**
   * Initializes the search core service and sets up event listeners for cache invalidation.
   *
   * Subscribes to server lifecycle events (SERVER_UPDATED, SERVER_ADDED, SERVER_DELETED)
   * to automatically clear the search cache when server configurations change, ensuring
   * that search results always reflect the current state of available tools.
   */
  constructor() {
    // Listen for server update events and clear search cache to ensure results are up-to-date
    eventBus.subscribe(EventTypes.SERVER_UPDATED, () => {
      logger.debug('Server updated event received, clearing search cache', LOG_MODULES.SEARCH);
      this.cacheService.invalidate();
    });

    // Listen for server add/delete events and also clear cache
    eventBus.subscribe(EventTypes.SERVER_ADDED, () => {
      logger.debug('Server added event received, clearing search cache', LOG_MODULES.SEARCH);
      this.cacheService.invalidate();
    });

    eventBus.subscribe(EventTypes.SERVER_DELETED, () => {
      logger.debug('Server deleted event received, clearing search cache', LOG_MODULES.SEARCH);
      this.cacheService.invalidate();
    });
  }

  /**
   * Performs a fuzzy search across all available tools from connected MCP servers.
   *
   * This method supports both empty queries (returns all tools) and search queries
   * with fuzzy matching. Results are scored based on relevance and returned in
   * descending order of score.
   *
   * @param query - The search query string. Empty or whitespace-only queries return all tools.
   * @param options - Optional search configuration including filters, pagination, and search mode.
   * @returns A promise that resolves to an array of SearchResult objects containing tools and their relevance scores.
   *
   * @example
   * // Search for tools containing "list"
   * const results = await searchCoreService.search("list");
   *
   * // Get all tools with pagination
   * const allTools = await searchCoreService.search("", { limit: 20, offset: 0 });
   *
   * @remarks
   * - Results are automatically cached to improve performance on subsequent identical searches
   * - Cache is invalidated when server configurations change
   * - Empty queries return all tools with a score of 1
   * - Non-empty queries perform fuzzy matching with weighted scoring
   * - Results are automatically sorted by score (highest first) and paginated
   */
  async search(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]> {
    const startTime = Date.now();

    const tools = await this.getToolsWithCache();

    const filteredTools = this.applyFilters(tools, options?.filters);

    let results: SearchResult[] = [];

    if (!query.trim()) {
      results = filteredTools.map((tool) => ({
        tool,
        score: 1
      }));
    } else {
      results = this.performFuzzySearch(filteredTools, query.trim().toLowerCase());
    }

    const sortedResults = results.sort((a, b) => b.score - a.score);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const paginatedResults = sortedResults.slice(offset, offset + limit);

    const processingTime = Date.now() - startTime;
    logger.debug(`Search completed in ${processingTime}ms`, LOG_MODULES.SEARCH);

    return paginatedResults;
  }

  /**
   * Retrieves all available tools with caching support.
   *
   * This method first checks if tools are available in the cache. If cached data exists,
   * it returns the cached tools immediately. Otherwise, it fetches tools from all connected
   * MCP servers, applies server-level filtering based on allowedTools configuration,
   * caches the result, and returns the filtered tools.
   *
   * @returns A promise that resolves to an array of Tool objects from all connected servers.
   *
   * @remarks
   * - Tools are filtered based on each server's allowedTools configuration
   * - If allowedTools is null or undefined, all tools from that server are included
   * - If allowedTools is an empty array, no tools from that server are included
   * - Tools are filtered using strict name matching against the allowedTools list
   */
  private async getToolsWithCache(): Promise<Tool[]> {
    const cached = this.cacheService.get();
    if (cached) {
      return cached;
    }

    // Use new server name-level cache to get all tools
    const tools = mcpConnectionManager.getAllToolsByServerName();

    // Get configuration based on server name and apply allowedTools filtering
    const filteredTools = tools.filter((tool) => {
      const serverConfig = hubManager.getServerByName(tool.serverName);
      if (!serverConfig) return true;

      const allowed = serverConfig.template.allowedTools;
      if (allowed == null) return true; // No allowedTools configured, show all tools
      if (allowed.length === 0) return false; // Empty array, don't show any tools
      return allowed.includes(tool.name); // Strict filtering
    });

    this.cacheService.set(filteredTools);
    return filteredTools;
  }

  /**
   * Applies search filters to the provided tools array.
   *
   * Currently, this method serves as a placeholder for future filter implementation.
   * The comment indicates that serverId and status fields have been removed from the
   * Tool interface, so alternative filtering methods will be needed in the future.
   *
   * @param tools - The array of tools to filter
   * @param filters - Optional filter criteria from SearchOptions
   * @returns The filtered array of tools (currently returns input unchanged)
   *
   * @todo Implement actual filtering logic once the Tool interface is updated
   */
  private applyFilters(tools: Tool[], filters?: SearchOptions['filters']): Tool[] {
    if (!filters) return tools;

    const filtered = tools;

    // serverId and status fields have been removed from Tool interface, use other methods for server or status filtering

    return filtered;
  }

  /**
   * Performs fuzzy search on the provided tools array using the configured scorer.
   *
   * This method iterates through all tools and calculates a relevance score for each
   * tool against the search query using the SearchScorer. Only tools with a score
   * greater than 0 are included in the results.
   *
   * @param tools - The array of tools to search through
   * @param query - The normalized search query string (lowercase, trimmed)
   * @returns An array of SearchResult objects containing tools with positive scores
   *
   * @remarks
   * - The query parameter should already be normalized (lowercase and trimmed)
   * - Tools with a score of 0 or less are excluded from results
   * - Scoring is handled by the SearchScorer instance with weighted field matching
   */
  private performFuzzySearch(tools: Tool[], query: string): SearchResult[] {
    const results: SearchResult[] = [];

    for (const tool of tools) {
      const score = this.scorer.scoreTool(tool, query);

      if (score > 0) {
        results.push({
          tool,
          score
        });
      }
    }

    return results;
  }
}

export const searchCoreService = new SearchCoreService();
