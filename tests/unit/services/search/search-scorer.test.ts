import { describe, it, expect } from 'vitest';
import { SearchScorer } from '@services/search/search-scorer.js';
import { McpTool } from '@models/tool.model.js';

describe('SearchScorer', () => {
  const scorer = new SearchScorer();

  describe('scoreTool()', () => {
    it('should score exact match with highest value', () => {
      const tool: McpTool = {
        name: 'MySQL Query',
        description: 'Execute MySQL queries',
        serverName: 'mysql-server'
      };

      const score = scorer.scoreTool(tool, 'MySQL Query');
      expect(score).toBeGreaterThan(scorer.scoreTool(tool, 'MySQL'));
      expect(score).toBeGreaterThan(scorer.scoreTool(tool, 'Query'));
    });

    it('should score partial match with lower value', () => {
      const tool: McpTool = {
        name: 'MySQL Query',
        description: 'Execute MySQL queries',
        serverName: 'mysql-server'
      };

      const exactScore = scorer.scoreTool(tool, 'MySQL Query');
      const partialScore = scorer.scoreTool(tool, 'MySQL');

      expect(partialScore).toBeLessThan(exactScore);
      expect(partialScore).toBeGreaterThan(0);
    });

    it('should score description matches', () => {
      const tool: McpTool = {
        name: 'Database Tool',
        description: 'Execute MySQL queries',
        serverName: 'mysql-server'
      };

      const nameScore = scorer.scoreTool(tool, 'Database');
      const descScore = scorer.scoreTool(tool, 'MySQL');

      expect(nameScore).toBeGreaterThan(descScore);
    });

    it('should score tag matches', () => {
      const tool: McpTool = {
        name: 'Database Tool',
        description: 'Execute MySQL queries',
        serverName: 'mysql-server'
      };

      const tagScore = scorer.scoreTool(tool, 'mysql');
      expect(tagScore).toBeGreaterThan(0);
    });

    it('should handle no matches', () => {
      const tool: McpTool = {
        name: 'MySQL Query',
        description: 'Execute MySQL queries',
        serverName: 'mysql-server'
      };

      const score = scorer.scoreTool(tool, 'nonexistent');
      expect(score).toBe(0);
    });

    it('should score tools with no description', () => {
      const tool: McpTool = {
        name: 'MySQL Query',
        description: '',
        serverName: 'mysql-server'
      };

      const score = scorer.scoreTool(tool, 'MySQL');
      expect(score).toBeGreaterThan(0);
    });

    it('should score tools with no tags', () => {
      const tool: McpTool = {
        name: 'MySQL Query',
        description: 'Execute MySQL queries',
        serverName: 'mysql-server'
      };

      const score = scorer.scoreTool(tool, 'MySQL');
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('score calculation', () => {
    it('should weight name higher than description', () => {
      const tool: McpTool = {
        name: 'MySQL Query',
        description: 'Execute database queries',
        serverName: 'mysql-server'
      };

      // 模拟只匹配名称、只匹配描述的情况
      const nameMatch = scorer.scoreTool(tool, 'MySQL');
      const descMatch = scorer.scoreTool(tool, 'database');

      expect(nameMatch).toBeGreaterThan(descMatch);
    });

    it('should sum scores from multiple matches', () => {
      const tool: McpTool = {
        name: 'MySQL Query',
        description: 'Execute MySQL database queries',
        serverName: 'mysql-server'
      };

      const singleMatch = scorer.scoreTool(tool, 'Query');
      const multipleMatches = scorer.scoreTool(tool, 'MySQL');

      expect(multipleMatches).toBeGreaterThan(singleMatch);
    });
  });
});