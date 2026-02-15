import type { Tool } from '@shared-models/tool.model.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';

export interface SearchResult {
  tool: Tool;
  score: number;
}

export class SimpleSearchService {
  public search(query: string): SearchResult[] {
    const allTools = mcpConnectionManager.getAllTools();
    if (!query.trim()) {
      return allTools.map((t) => ({ tool: t, score: 1 }));
    }

    const lowerQuery = query.toLowerCase();

    return allTools
      .map((tool) => {
        let score = 0;
        const name = tool.name.toLowerCase();
        const desc = (tool.description || '').toLowerCase();

        if (name === lowerQuery) score += 10;
        else if (name.startsWith(lowerQuery)) score += 5;
        else if (name.includes(lowerQuery)) score += 3;

        if (desc.includes(lowerQuery)) score += 1;

        return { tool, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }
}

export const simpleSearchService = new SimpleSearchService();
