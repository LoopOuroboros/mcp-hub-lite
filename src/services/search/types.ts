import type { Tool } from '@shared-models/tool.model.js';

export interface SearchResult {
  tool: Tool;
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
  filters?: Record<string, never>;
}
