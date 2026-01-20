import { McpTool } from '../../models/tool.model.js';

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

  updateTool(serverId: string, toolName: string, updates: Partial<McpTool>): void {
    if (!this.cache) return;

    const index = this.cache.findIndex(
      t => t.serverId === serverId && t.name === toolName
    );

    if (index !== -1) {
      this.cache[index] = { ...this.cache[index], ...updates };
    }
  }
}