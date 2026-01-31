import { describe, it, expect, vi } from 'vitest';
import { SearchCacheService } from '../../../../src/services/search/search-cache.js';
import { McpTool } from '../../../../src/models/tool.model.js';

describe('SearchCacheService', () => {
  const cacheService = new SearchCacheService();

  describe('basic functionality', () => {
    it('should initially have no cached data', () => {
      const data = cacheService.get();
      expect(data).toBeNull();
      expect(cacheService.isValid()).toBe(false);
    });

    it('should set and retrieve cache data', () => {
      const mockTools: McpTool[] = [
        { name: 'Tool 1', description: 'Description' }
      ];

      cacheService.set(mockTools);

      const data = cacheService.get();
      expect(data).toEqual(mockTools);
      expect(cacheService.isValid()).toBe(true);
    });

    it('should invalidate cache', () => {
      const mockTools: McpTool[] = [
        { name: 'Tool 1', description: 'Description' }
      ];

      cacheService.set(mockTools);
      expect(cacheService.isValid()).toBe(true);

      cacheService.invalidate();
      expect(cacheService.get()).toBeNull();
      expect(cacheService.isValid()).toBe(false);
    });
  });

  describe('cache expiration', () => {
    it('should invalidate cache after TTL', () => {
      const mockTools: McpTool[] = [
        { name: 'Tool 1', description: 'Description' }
      ];

      cacheService.set(mockTools);
      expect(cacheService.isValid()).toBe(true);

      // 模拟 TTL 到期
      vi.useFakeTimers();
      vi.advanceTimersByTime(31000);

      expect(cacheService.isValid()).toBe(false);
      expect(cacheService.get()).toBeNull();

      vi.useRealTimers();
    });

    it('should return valid data before TTL expires', () => {
      const mockTools: McpTool[] = [
        { name: 'Tool 1', description: 'Description' }
      ];

      cacheService.set(mockTools);
      expect(cacheService.isValid()).toBe(true);

      vi.useFakeTimers();
      vi.advanceTimersByTime(25000);

      expect(cacheService.isValid()).toBe(true);
      expect(cacheService.get()).toEqual(mockTools);

      vi.useRealTimers();
    });
  });

});