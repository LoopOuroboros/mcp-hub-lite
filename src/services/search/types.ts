import { McpTool } from '../../models/tool.model.js';

export interface SearchResult {
  tool: McpTool;
  score: number;
}

export interface SearchOptions {
  mode: 'fuzzy';
  filters?: {
    serverId?: string;
    tags?: Record<string, string>;
    status?: ('online' | 'offline' | 'error')[];
  };
  limit?: number;
  offset?: number;
}

export interface SearchQuery {
  original: string;
  tokens: string[];
  filters?: {
    serverId?: string;
    tags?: Record<string, string>;
  };
}