import { McpTool } from '../../models/tool.model.js';
import { logger } from '../../utils/logger.js';

export class SearchCacheService {
  private cache: McpTool[] | null = null;
  private lastUpdate: number = 0;
  private readonly CACHE_TTL = 30 * 1000;

  isValid(): boolean {
    if (!this.cache) return false;

    return Date.now() - this.lastUpdate < this.CACHE_TTL;
  }

  get(): McpTool[] | null {
    if (!this.isValid()) {
      this.cache = null;
      return null;
    }

    return this.cache;
  }

  set(tools: McpTool[]): void {
    this.cache = tools;
    this.lastUpdate = Date.now();
  }

  invalidate(): void {
    this.cache = null;
    this.lastUpdate = 0;
  }

  updateTool(): void {
    // 由于 McpTool 接口已移除 serverId 字段，此方法需要重构
    // 目前暂时保留但不执行任何操作，或根据实际需求修改
    logger.warn('updateTool method is deprecated because serverId field is removed from McpTool', { subModule: 'Search' });
  }
}