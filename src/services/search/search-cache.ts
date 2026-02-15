import type { Tool } from '@shared-models/tool.model.js';
import { logger } from '@utils/logger.js';

export class SearchCacheService {
  private cache: Tool[] | null = null;
  private lastUpdate: number = 0;
  private readonly CACHE_TTL = 30 * 1000;

  isValid(): boolean {
    if (!this.cache) return false;

    return Date.now() - this.lastUpdate < this.CACHE_TTL;
  }

  get(): Tool[] | null {
    if (!this.isValid()) {
      this.cache = null;
      return null;
    }

    return this.cache;
  }

  set(tools: Tool[]): void {
    this.cache = tools;
    this.lastUpdate = Date.now();
  }

  invalidate(): void {
    this.cache = null;
    this.lastUpdate = 0;
  }

  updateTool(): void {
    // Since serverId field has been removed from Tool interface, this method needs refactoring
    // Currently kept but not performing any operations, or modify according to actual requirements
    logger.warn('updateTool method is deprecated because serverId field is removed from Tool', {
      subModule: 'Search'
    });
  }
}
