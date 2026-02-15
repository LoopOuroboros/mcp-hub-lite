import type { Tool } from '@shared-models/tool.model.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { SearchResult, SearchOptions } from './types.js';
import { SearchScorer } from './search-scorer.js';
import { SearchCacheService } from './search-cache.js';
import { eventBus, EventTypes } from '@services/event-bus.service.js';
import { logger } from '@utils/logger.js';

export class SearchCoreService {
  private cacheService = new SearchCacheService();
  private scorer = new SearchScorer();

  constructor() {
    // Listen for server update events and clear search cache to ensure results are up-to-date
    eventBus.subscribe(EventTypes.SERVER_UPDATED, () => {
      logger.debug('Server updated event received, clearing search cache', { subModule: 'Search' });
      this.cacheService.invalidate();
    });

    // Listen for server add/delete events and also clear cache
    eventBus.subscribe(EventTypes.SERVER_ADDED, () => {
      logger.debug('Server added event received, clearing search cache', { subModule: 'Search' });
      this.cacheService.invalidate();
    });

    eventBus.subscribe(EventTypes.SERVER_DELETED, () => {
      logger.debug('Server deleted event received, clearing search cache', { subModule: 'Search' });
      this.cacheService.invalidate();
    });
  }

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
    logger.debug(`Search completed in ${processingTime}ms`, { subModule: 'Search' });

    return paginatedResults;
  }

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

      const allowed = serverConfig.allowedTools;
      if (allowed == null) return true; // No allowedTools configured, show all tools
      if (allowed.length === 0) return false; // Empty array, don't show any tools
      return allowed.includes(tool.name); // Strict filtering
    });

    this.cacheService.set(filteredTools);
    return filteredTools;
  }

  private applyFilters(tools: Tool[], filters?: SearchOptions['filters']): Tool[] {
    if (!filters) return tools;

    const filtered = tools;

    // serverId and status fields have been removed from Tool interface, use other methods for server or status filtering

    return filtered;
  }

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
