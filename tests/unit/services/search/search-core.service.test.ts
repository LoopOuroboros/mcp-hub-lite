import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchCoreService } from '../../../../src/services/search/search-core.service.js';
import { McpTool } from '../../../../src/models/tool.model.js';

// 创建模拟工具数据
const mockTools: McpTool[] = [
  {
    id: 'tool1',
    name: 'MySQL Query',
    description: 'Execute MySQL queries',
    serverId: 'server1',
    tags: ['database', 'mysql'],
    status: 'online'
  },
  {
    id: 'tool2',
    name: 'PostgreSQL Query',
    description: 'Execute PostgreSQL queries',
    serverId: 'server2',
    tags: ['database', 'postgresql'],
    status: 'online'
  },
  {
    id: 'tool3',
    name: 'Redis Command',
    description: 'Execute Redis commands',
    serverId: 'server3',
    tags: ['database', 'redis'],
    status: 'offline'
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

    it('should filter tools by serverId', async () => {
      const results = await searchService.search('', {
        filters: { serverId: 'server1' }
      });

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(1);
      expect(results[0].tool.serverId).toBe('server1');
    });

    it('should filter tools by tags', async () => {
      const results = await searchService.search('', {
        filters: { tags: { database: 'mysql' } }
      });

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBe(1);
      expect(results[0].tool.tags).toEqual(['database', 'mysql']);
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
          id: `tool${i}`,
          name: `Tool ${i}`,
          description: `Description for tool ${i}`,
          serverId: `server${(i % 5) + 1}`,
          tags: ['tool', `category${(i % 3) + 1}`],
          status: 'online'
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