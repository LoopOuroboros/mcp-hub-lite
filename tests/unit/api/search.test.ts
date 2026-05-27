import { describe, it, expect } from 'vitest';
import { filterByAggregatedTools } from '@api/web/search.js';
import type { ServerConfig } from '@config/config-manager.js';

function mockConfig(aggregatedTools: string[] = []): ServerConfig {
  return {
    template: {
      type: 'stdio' as const,
      command: 'test',
      args: [],
      env: {},
      headers: {},
      aggregatedTools,
      timeout: 30000
    },
    instances: [],
    tagDefinitions: []
  };
}

function mockTool(name: string, serverName = 'test-server') {
  return { name, description: `Tool ${name}`, serverName };
}

describe('filterByAggregatedTools', () => {
  it('should skip tools when aggregatedTools is empty', () => {
    const tools = [mockTool('tool1'), mockTool('tool2')];
    const getConfig = () => mockConfig([]);

    const result = filterByAggregatedTools(tools, getConfig);
    expect(result).toHaveLength(0);
  });

  it('should only include tools in aggregatedTools list', () => {
    const tools = [mockTool('tool1'), mockTool('tool2'), mockTool('tool3')];
    const getConfig = () => mockConfig(['tool1', 'tool3']);

    const result = filterByAggregatedTools(tools, getConfig);
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.name)).toEqual(['tool1', 'tool3']);
  });

  it('should skip tools when server config not found', () => {
    const tools = [mockTool('tool1')];
    const getConfig = () => undefined;

    const result = filterByAggregatedTools(tools, getConfig);
    expect(result).toHaveLength(0);
  });

  it('should filter tools from multiple servers independently', () => {
    const tools = [
      mockTool('a', 'server-a'),
      mockTool('b', 'server-a'),
      mockTool('x', 'server-b'),
      mockTool('y', 'server-b')
    ];

    const configs: Record<string, ServerConfig | undefined> = {
      'server-a': mockConfig(['a']),
      'server-b': mockConfig([])
    };
    const getConfig = (name: string) => configs[name];

    const result = filterByAggregatedTools(tools, getConfig);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('a');
  });

  it('should return empty array when no tools provided', () => {
    const result = filterByAggregatedTools([], () => mockConfig(['tool1']));
    expect(result).toHaveLength(0);
  });
});
