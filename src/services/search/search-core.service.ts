import { McpTool } from '../../models/tool.model.js';
import { mcpConnectionManager } from '../mcp-connection-manager.js';
import { SearchResult, SearchOptions } from './types.js';
import { SearchScorer } from './search-scorer.js';
import { SearchCacheService } from './search-cache.js';

export class SearchCoreService {
  private cacheService = new SearchCacheService();
  private scorer = new SearchScorer();

  async search(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]> {
    const startTime = Date.now();

    const tools = await this.getToolsWithCache();

    const filteredTools = this.applyFilters(tools, options?.filters);

    let results: SearchResult[] = [];

    if (!query.trim()) {
      results = filteredTools.map(tool => ({
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
    console.log(`Search completed in ${processingTime}ms`);

    return paginatedResults;
  }

  private async getToolsWithCache(): Promise<McpTool[]> {
    const cached = this.cacheService.get();
    if (cached) {
      return cached;
    }

    const tools = mcpConnectionManager.getAllTools();
    this.cacheService.set(tools);
    return tools;
  }

  private applyFilters(tools: McpTool[], filters?: SearchOptions['filters']): McpTool[] {
    if (!filters) return tools;

    let filtered = tools;

    if (filters.serverId) {
      filtered = filtered.filter(t => t.serverId === filters!.serverId);
    }

    if (filters.tags) {
      filtered = filtered.filter(tool => {
        const toolTags = tool.tags || [];
        return Object.entries(filters!.tags!).every(([key, value]) => {
          const tagKey = `${key}:${value}`;
          // 精确匹配标签格式：key:value 或简单字符串
          return toolTags.includes(tagKey) || toolTags.includes(value);
        });
      });
    }

    if (filters.status && filters.status.length > 0) {
      filtered = filtered.filter(tool =>
        tool.status && filters!.status!.includes(tool.status)
      );
    }

    return filtered;
  }

  private performFuzzySearch(tools: McpTool[], query: string): SearchResult[] {
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