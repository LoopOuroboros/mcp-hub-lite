/**
 * Gateway tool list generator with collision resolution.
 */

import { logger } from '@utils/index.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { hubToolsService } from '@services/hub-tools.service.js';
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
export function generateGatewayToolsList(
  toolMap: Map<string, ToolMapEntry>
): Array<GatewayTool> {
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
  // Iterate through toolCache to get all tools and their server IDs
  for (const [serverId, tools] of mcpConnectionManager.toolCache.entries()) {
    for (const tool of tools) {
      const serverConfig = hubManager.getServerById(serverId);
      if (serverConfig) {
        if (
          serverConfig.config.allowedTools &&
          !serverConfig.config.allowedTools.includes(tool.name)
        ) {
          continue;
        }
      }
      toolNameCounts.set(tool.name, (toolNameCounts.get(tool.name) || 0) + 1);
    }
  }

  // Second pass: Generate gateway tools with proper naming
  for (const [serverId, tools] of mcpConnectionManager.toolCache.entries()) {
    const serverConfig = hubManager.getServerById(serverId);

    // Skip if server configuration not found
    if (!serverConfig) {
      logger.warn(`Server configuration not found for serverId: ${serverId}, skipping tools`);
      continue;
    }

    for (const tool of tools) {
      if (
        serverConfig.config.allowedTools &&
        !serverConfig.config.allowedTools.includes(tool.name)
      ) {
        continue;
      }

      const serverName = serverConfig.name;

      let gatewayToolName = tool.name;
      const isUnique = toolNameCounts.get(tool.name) === 1;
      const isSystemConflict = usedNames.has(tool.name);

      // If tool name is not unique or conflicts with system tool, append server hash
      if (!isUnique || isSystemConflict) {
        // Get instance hash from serverConfig, use first 4 characters of serverId as default
        const hash = serverConfig.instance?.hash || serverId.substring(0, 4);
        gatewayToolName = `${tool.name}_${hash}`;
      }

      // Ensure name doesn't exceed 60 chars
      if (gatewayToolName.length > 60) {
        // Use first 4 characters of serverId as default hash
        const hash = serverConfig.instance?.hash || serverId.substring(0, 4);
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
        serverId: serverId,
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
