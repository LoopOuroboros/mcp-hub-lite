/**
 * Gateway tool list generator with collision resolution.
 */

import { logger } from '@utils/index.js';
import { LOG_MODULES } from '@utils/logger/log-modules.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { hubToolsService } from '@services/hub-tools.service.js';
import { parseCompositeKey } from '@utils/composite-key.js';
import type { ToolMapEntry, GatewayTool } from './types.js';

/**
 * Generates a unified list of gateway tools with proper naming and collision resolution.
 *
 * This method creates a comprehensive tool list that includes both system tools and
 * aggregated tools from all connected MCP servers. It implements sophisticated
 * naming collision resolution by:
 * - Adding server hash suffixes to non-unique tool names
 * - Handling conflicts with system tool names
 * - Ensuring names don't exceed 60 characters
 * - Providing final uniqueness guarantees through counter suffixes
 *
 * The method also populates the provided toolMap with mappings from gateway tool names
 * to actual server IDs and real tool names for efficient routing during tool execution.
 *
 * @param {Map<string, ToolMapEntry>} toolMap - Map to populate with gateway tool name to actual tool mappings
 * @returns {Array<GatewayTool>} Array of gateway tools with resolved names and descriptions
 */
export function generateGatewayToolsList(toolMap: Map<string, ToolMapEntry>): Array<GatewayTool> {
  const gatewayTools: Array<GatewayTool> = [];
  toolMap.clear();

  // Add system tools
  const systemTools = hubToolsService.getSystemTools();
  const usedNames = new Set<string>();

  for (const tool of systemTools) {
    gatewayTools.push({
      name: tool.name,
      description: `[System] ${tool.description}`,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations
    });
    usedNames.add(tool.name);
  }

  // First pass: Count tool name frequencies to determine uniqueness
  const toolNameCounts = new Map<string, number>();
  // Iterate through toolCache to get all tools - entries are keyed by compositeKey (serverName-serverIndex)
  for (const [compositeKey, tools] of mcpConnectionManager.getToolCacheEntries()) {
    for (const tool of tools) {
      // Parse composite key to get serverName
      const parsed = parseCompositeKey(compositeKey);
      const serverName = parsed ? parsed.serverName : compositeKey;
      const serverConfig = hubManager.getServerByName(serverName);
      if (serverConfig) {
        // Only include tools if server has aggregatedTools configured AND tool is in aggregatedTools
        const aggregatedTools = serverConfig.template?.aggregatedTools;
        const hasAggregatedTools = aggregatedTools && aggregatedTools.length > 0;

        if (!hasAggregatedTools) {
          continue;
        }

        if (!Array.isArray(aggregatedTools) || !aggregatedTools.includes(tool.name)) {
          continue;
        }
      }
      toolNameCounts.set(tool.name, (toolNameCounts.get(tool.name) || 0) + 1);
    }
  }

  // Second pass: Generate gateway tools with proper naming
  for (const [compositeKey, tools] of mcpConnectionManager.getToolCacheEntries()) {
    // Parse composite key to get serverName
    const parsed = parseCompositeKey(compositeKey);
    const serverName = parsed ? parsed.serverName : compositeKey;
    const serverIndex = parsed ? parsed.serverIndex : 0;
    const serverConfig = hubManager.getServerByName(serverName);

    // Skip if server configuration not found
    if (!serverConfig) {
      logger.warn(
        `Server configuration not found for serverName: ${serverName}, skipping tools`,
        LOG_MODULES.TOOL_LIST_GENERATOR
      );
      continue;
    }

    // Only include tools if server has aggregatedTools configured
    const aggregatedTools = serverConfig.template?.aggregatedTools;
    const hasAggregatedTools = aggregatedTools && aggregatedTools.length > 0;

    if (!hasAggregatedTools) {
      continue;
    }

    // Get the instance ID for hash suffix (use compositeKey which contains serverName-serverIndex format)
    const hashSuffix = compositeKey;

    for (const tool of tools) {
      if (!aggregatedTools.includes(tool.name)) {
        continue;
      }

      let gatewayToolName = tool.name;
      const isUnique = toolNameCounts.get(tool.name) === 1;
      const isSystemConflict = usedNames.has(tool.name);

      // If tool name is not unique or conflicts with system tool, append server hash
      if (!isUnique || isSystemConflict) {
        // Use hash suffix from compositeKey for uniqueness
        const hash = hashSuffix.substring(0, 4);
        gatewayToolName = `${tool.name}_${hash}`;
      }

      // Ensure name doesn't exceed 60 chars
      if (gatewayToolName.length > 60) {
        // Use hash suffix from compositeKey
        const hash = hashSuffix.substring(0, 4);
        // Reserve space for hash and separator
        const maxToolNameLen = 60 - hash.length - 1;
        const truncatedToolName = tool.name.substring(0, maxToolNameLen);
        gatewayToolName = `${truncatedToolName}_${hash}`;
      }

      // Final uniqueness check (in case of hash collision or previous renaming conflict)
      let finalName = gatewayToolName;
      let counter = 1;
      while (usedNames.has(finalName)) {
        const suffix = `_${counter}`;
        if (gatewayToolName.length + suffix.length > 60) {
          const availableLen = 60 - suffix.length;
          finalName = gatewayToolName.substring(0, availableLen) + suffix;
        } else {
          finalName = gatewayToolName + suffix;
        }
        counter++;
      }
      gatewayToolName = finalName;

      usedNames.add(gatewayToolName);

      toolMap.set(gatewayToolName, {
        serverName,
        serverIndex,
        realToolName: tool.name
      });

      gatewayTools.push({
        name: gatewayToolName,
        description: `[From ${serverName}] ${tool.description || ''}`,
        inputSchema: tool.inputSchema
      });
    }
  }

  return gatewayTools;
}
