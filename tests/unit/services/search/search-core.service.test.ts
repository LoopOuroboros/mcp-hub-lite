import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchCoreService } from '../../../../src/services/search/search-core.service.js';
import { McpTool } from '../../../../src/models/tool.model.js';

// 创建模拟工具数据
const mockTools: McpTool[] = [
  {
    name: 'MySQL Query',
    description: 'Execute MySQL queries',
    serverName: 'mysql-server'
  },
  {
    name: 'PostgreSQL Query',
    description: 'Execute PostgreSQL queries',
    serverName: 'postgresql-server'
  },
  {
    name: 'Redis Command',
    description: 'Execute Redis commands',
    serverName: 'redis-server'
  }
];

describe('SearchCoreService', () => {
  let searchService: SearchCoreService;
  let mockGetAllTools: any;

  beforeEach(() => {
    searchService = new SearchCoreService();

    // 模拟 mcpConnectionManager.getAllTools()
    mockGetAllTools = vi.spyOn(
      searchService as any, 'getToolsWithCache'
    ).mockImplementation(async () => mockTools);
  });

  describe('search()', () => {
    it('should return all tools when query is empty', async () => {
      const results = await searchService.search('');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(3);
      expect(results.every(r => r.score === 1)).toBe(true);
    });

    it('should search tools by exact name match', async () => {
      const results = await searchService.search('MySQL Query');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].tool.name).toContain('MySQL');
    });

    it('should search tools by partial match', async () => {
      const results = await searchService.search('Query');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);
      expect(results.every(r => r.tool.name.includes('Query'))).toBe(true);
    });



    it('should respect limit and offset parameters', async () => {
      const results = await searchService.search('', {
        limit: 2,
        offset: 1
      });

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);
    });

    it('should return results sorted by score', async () => {
      const results = await searchService.search('Query');

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(2);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });
  });

  describe('search performance', () => {
    it('should handle large tool lists efficiently', async () => {
      // 创建包含200个工具的模拟数据
      const largeMockTools: McpTool[] = [];
      for (let i = 1; i <= 200; i++) {
        largeMockTools.push({
          name: `Tool ${i}`,
          description: `Description for tool ${i}`,
          serverName: 'test-server'
        });
      }

      mockGetAllTools.mockImplementation(async () => largeMockTools);

      const startTime = Date.now();
      const results = await searchService.search('Tool');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});