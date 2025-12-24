/**
 * 生成模拟MCP工具数据
 * 用于性能测试
 */
import type { MCPTool } from './types.js';

export class MCPToolGenerator {
  private static categories = [
    'database',
    'filesystem',
    'api',
    'ai-ml',
    'network',
    'security',
    'devops',
    'data-processing',
    'text-processing',
    'image-processing',
    'workflow',
    'automation',
    'analytics',
    'monitoring',
    'testing'
  ];

  private static adjectives = [
    'smart', 'fast', 'secure', 'reliable', 'flexible', 'scalable',
    'intelligent', 'advanced', 'efficient', 'powerful', 'modern',
    'optimized', 'enhanced', 'improved', 'enhanced', 'pro'
  ];

  private static nouns = [
    'query', 'analyzer', 'processor', 'builder', 'generator', 'validator',
    'checker', 'scanner', 'monitor', 'tracker', 'parser', ' manipulator',
    'converter', 'transformer', 'aggregator', 'clusterer', ' classifier'
  ];

  static generateRandomTools(count: number): MCPTool[] {
    const tools: MCPTool[] = [];

    for (let i = 0; i < count; i++) {
      const category = this.categories[i % this.categories.length]!;
      const adjective = this.adjectives[i % this.adjectives.length]!;
      const noun = this.nouns[i % this.nouns.length]!;

      const id = `tool-${i + 1}`;
      const name = `${category}-${adjective}-${noun}`;
      const description = `Advanced ${category} ${noun} with ${adjective} capabilities for handling complex tasks`;
      const serverId = `server-${Math.floor(i / 50) + 1}`;
      const tags = [
        category,
        adjective,
        noun,
        `type:${category.split('-')[0]}`,
        `server:${serverId}`
      ];

      tools.push({
        id,
        name,
        description,
        category,
        tags,
        serverId
      });
    }

    return tools;
  }

  static generateSpecificTools(): MCPTool[] {
    return [
      {
        id: 'tool-1',
        name: 'database-query-mysql',
        description: 'Execute MySQL database queries with advanced filtering',
        category: 'database',
        tags: ['database', 'mysql', 'query', 'sql', 'rdms'],
        serverId: 'server-db-1'
      },
      {
        id: 'tool-2',
        name: 'filesystem-read-json',
        description: 'Read and parse JSON files from the filesystem',
        category: 'filesystem',
        tags: ['filesystem', 'read', 'json', 'parse', 'file'],
        serverId: 'server-fs-1'
      },
      {
        id: 'tool-3',
        name: 'api-rest-client',
        description: 'Make HTTP requests to REST APIs with authentication',
        category: 'api',
        tags: ['api', 'rest', 'http', 'client', 'request'],
        serverId: 'server-api-1'
      },
      {
        id: 'tool-4',
        name: 'ai-ml-predictor',
        description: 'Machine learning model for prediction tasks',
        category: 'ai-ml',
        tags: ['ai', 'ml', 'prediction', 'model', 'accuracy'],
        serverId: 'server-ai-1'
      },
      {
        id: 'tool-5',
        name: 'network-scanner',
        description: 'Scan network resources and check connectivity',
        category: 'network',
        tags: ['network', 'scan', 'connectivity', 'discovery'],
        serverId: 'server-net-1'
      }
    ];
  }
}