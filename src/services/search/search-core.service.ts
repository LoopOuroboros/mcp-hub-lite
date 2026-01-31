import { McpTool } from '../../models/tool.model.js';
import { mcpConnectionManager } from '../mcp-connection-manager.js';
import { hubManager } from '../hub-manager.service.js';
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

    // 由于 McpTool 接口已移除 serverId 字段，需要修改过滤逻辑
    // 直接使用 mcpConnectionManager 的 toolCache 来获取工具及其服务器信息
    const allowedTools: McpTool[] = [];

    for (const [serverId, tools] of mcpConnectionManager['toolCache'].entries()) {
      // 从服务器 ID 中解析原始服务器 ID 和实例索引
      const [originalId, indexStr] = serverId.split('-');
      const index = parseInt(indexStr);

      // 获取服务器基本配置
      const server = hubManager.getServerById(originalId);
      if (!server) {
        allowedTools.push(...tools);
        continue;
      }

      // 获取服务器实例配置
      const instances = hubManager.getServerInstanceByName(server.name);
      if (!instances || instances.length <= index) {
        allowedTools.push(...tools);
        continue;
      }

      const allowed = server.config.allowedTools;

      // If allowedTools is explicitly defined (not null/undefined), use it to filter
      // If it's an empty array, it will filter out all tools
      if (allowed != null) {
        allowedTools.push(...tools.filter(tool => allowed.includes(tool.name)));
      } else {
        allowedTools.push(...tools);
      }
    }

    this.cacheService.set(allowedTools);
    return allowedTools;
  }

  private applyFilters(tools: McpTool[], filters?: SearchOptions['filters']): McpTool[] {
    if (!filters) return tools;

    let filtered = tools;

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