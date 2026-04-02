/**
 * Tools-related request handlers for Gateway service.
 */

import { z } from 'zod';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '@utils/index.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { searchCoreService } from '@services/search/search-core.service.js';
import { SearchOptions } from '@services/search/types.js';
import { hubManager } from '@services/hub-manager.service.js';

/**
 * Register tools-related handlers on the MCP server.
 *
 * @param server - MCP server instance to register handlers on
 */
export function registerToolsHandlers(server: McpServer): void {
  // Define search tool schema
  const SearchToolsRequestSchema = z.object({
    method: z.literal('tools/search'),
    params: z
      .object({
        search: z.string().optional(),
        filters: z
          .object({
            serverName: z.string().optional(),
            tags: z.record(z.string(), z.string()).optional()
          })
          .optional(),
        limit: z.number().int().positive().optional().default(50),
        offset: z.number().int().nonnegative().optional().default(0)
      })
      .optional(),
    id: z.union([z.string(), z.number()]),
    jsonrpc: z.literal('2.0')
  });

  // Search tools handler
  server.server.setRequestHandler(SearchToolsRequestSchema, async (request) => {
    const { search = '', filters = {}, limit = 50, offset = 0 } = request.params || {};

    try {
      const searchOptions = {
        mode: 'fuzzy' as const,
        limit,
        offset,
        filters: {} as SearchOptions['filters']
      };

      if (filters.serverName) {
        const serverInstances = hubManager.getServerInstancesByName(filters.serverName);
        if (serverInstances.length > 0) {
          // Use the first instance's ID as filter condition
          searchOptions.filters!.serverId = serverInstances[0].id;
        }
      }

      if (filters.tags) {
        searchOptions.filters!.tags = filters.tags;
      }

      const results = await searchCoreService.search(search, searchOptions);

      return {
        results: results.map((r) => ({
          tool: r.tool,
          score: r.score
        })),
        pagination: {
          total: results.length,
          limit,
          offset,
          hasMore: results.length >= limit
        }
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error(`Search tools error:`, error, LOG_MODULES.TOOLS_HANDLER);
        throw new McpError(-32802, `Search failed: ${error.message}`);
      } else {
        logger.error(`Search tools error:`, error, LOG_MODULES.TOOLS_HANDLER);
        throw new McpError(-32802, `Search failed: ${String(error)}`);
      }
    }
  });
}
