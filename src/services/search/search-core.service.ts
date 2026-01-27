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

    const allTools = mcpConnectionManager.getAllTools();

    // Filter tools based on server configuration (allowedTools)
    const allowedTools = allTools.filter(tool => {
      // 从服务器 ID 中解析原始服务器 ID 和实例索引
      const [originalId, indexStr] = tool.serverId.split('-');
      const index = parseInt(indexStr);

      // 获取服务器基本配置
      const server = hubManager.getServerById(originalId);
      if (!server) {
        return true; // 服务器不存在，允许所有工具（安全策略）
      }

      // 获取服务器实例配置
      const instances = hubManager.getServerInstanceByName(server.name);
      if (!instances || instances.length <= index) {
        return true; // 实例不存在，允许所有工具
      }

      const allowed = server.config.allowedTools;

      // If allowedTools is explicitly defined (not null/undefined), use it to filter
      // If it's an empty array, it will filter out all tools
      if (allowed != null) {
        return allowed.includes(tool.name);
      }

      // If allowedTools is undefined/null, allow all tools
      return true;
    });

    this.cacheService.set(allowedTools);
    return allowedTools;
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