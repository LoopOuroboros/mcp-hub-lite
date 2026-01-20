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
        { id: '1', name: 'Tool 1', description: 'Description', serverId: 'server1' }
      ];

      cacheService.set(mockTools);

      const data = cacheService.get();
      expect(data).toEqual(mockTools);
      expect(cacheService.isValid()).toBe(true);
    });

    it('should invalidate cache', () => {
      const mockTools: McpTool[] = [
        { id: '1', name: 'Tool 1', description: 'Description', serverId: 'server1' }
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
        { id: '1', name: 'Tool 1', description: 'Description', serverId: 'server1' }
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
        { id: '1', name: 'Tool 1', description: 'Description', serverId: 'server1' }
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

  describe('update tool', () => {
    it('should update existing tool in cache', () => {
      const mockTools: McpTool[] = [
        { id: '1', name: 'Tool 1', description: 'Description', serverId: 'server1' }
      ];

      cacheService.set(mockTools);

      const updatedTool = { id: '1', name: 'Updated Tool', description: 'New Description', serverId: 'server1' };
      cacheService.updateTool('server1', 'Tool 1', updatedTool);

      const data = cacheService.get();
      expect(data).toEqual([updatedTool]);
    });

    it('should handle update for non-existent tool', () => {
      const mockTools: McpTool[] = [
        { id: '1', name: 'Tool 1', description: 'Description', serverId: 'server1' }
      ];

      cacheService.set(mockTools);

      cacheService.updateTool('server1', 'Non-existent', { id: '2', name: 'New Tool' });

      const data = cacheService.get();
      expect(data).toEqual(mockTools);
    });

    it('should handle update on invalid cache', () => {
      // 缓存失效
      cacheService.invalidate();

      // 尝试更新工具
      expect(() => cacheService.updateTool('server1', 'Tool', {})).not.toThrow();
      expect(cacheService.get()).toBeNull();
    });
  });
});