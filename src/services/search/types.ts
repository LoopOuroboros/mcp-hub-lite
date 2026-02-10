import { McpTool } from '@models/tool.model.js';

export interface SearchResult {
  tool: McpTool;
  score: number;
}

export interface SearchOptions {
  mode: 'fuzzy';
  filters?: {
    serverId?: string;
    tags?: Record<string, string>;
  };
  limit?: number;
  offset?: number;
}

export interface SearchQuery {
  original: string;
  tokens: string[];
  filters?: {
    // serverId 字段已从 McpTool 接口中移除，如需按服务器筛选，请使用其他方法
  };
}