import { McpTool } from '../../models/tool.model.js';
import { mcpConnectionManager } from '../mcp-connection-manager.js';
import { hubManager } from '../hub-manager.service.js';
import { SearchResult, SearchOptions } from './types.js';
import { SearchScorer } from './search-scorer.js';
import { SearchCacheService } from './search-cache.js';
import { eventBus, EventTypes } from '../event-bus.service.js';
import { logger } from '../../utils/logger.js';

export class SearchCoreService {
  private cacheService = new SearchCacheService();
  private scorer = new SearchScorer();

  constructor() {
    // 监听服务器更新事件，清除搜索缓存以确保结果最新
    eventBus.subscribe(EventTypes.SERVER_UPDATED, () => {
      logger.debug('Server updated event received, clearing search cache', { subModule: 'Search' });
      this.cacheService.invalidate();
    });

    // 监听服务器添加和删除事件，同样清除缓存
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
    logger.debug(`Search completed in ${processingTime}ms`, { subModule: 'Search' });

    return paginatedResults;
  }

  private async getToolsWithCache(): Promise<McpTool[]> {
    const cached = this.cacheService.get();
    if (cached) {
      return cached;
    }

    // 使用新的服务器名称级别缓存获取所有工具
    const tools = mcpConnectionManager.getAllToolsByServerName();

    // 基于服务器名称获取配置并应用 allowedTools 过滤
    const filteredTools = tools.filter(tool => {
      const serverConfig = hubManager.getServerByName(tool.serverName);
      if (!serverConfig) return true;

      const allowed = serverConfig.allowedTools;
      if (allowed == null) return true; // 未配置 allowedTools，显示所有工具
      if (allowed.length === 0) return false; // 空数组，不显示任何工具
      return allowed.includes(tool.name); // 严格过滤
    });

    this.cacheService.set(filteredTools);
    return filteredTools;
  }

  private applyFilters(tools: McpTool[], filters?: SearchOptions['filters']): McpTool[] {
    if (!filters) return tools;

    const filtered = tools;

    // serverId 和 status 字段已从 McpTool 接口中移除，如需按服务器或状态筛选，请使用其他方法

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