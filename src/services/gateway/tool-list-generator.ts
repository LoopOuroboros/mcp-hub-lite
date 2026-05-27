/**
 * Gateway tool list generator with collision resolution and global caching.
 */

import { logger, LOG_MODULES } from '@utils/index.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import { hubManager } from '@services/hub-manager.service.js';
import { hubToolsService } from '@services/hub-tools.service.js';
import { parseCompositeKey } from '@utils/composite-key.js';
import type { Tool } from '@shared-models/tool.model.js';
import type { ToolMapEntry, GatewayTool } from './types.js';

// ── Raw data types ──────────────────────────────────────────────

interface RawServerData {
  tools: Tool[];
  aggregated: string[];
  /** tool name → serverIndex mapping, preserved from compositeKey parsing */
  toolIndexes: Map<string, number>;
}

// ── Double-layer cache ──────────────────────────────────────────

/** Raw data layer: per-server aggregated tool snapshots */
let rawToolData: Map<string, RawServerData> | null = null;

/** Resolved name layer */
let cachedToolMap: Map<string, ToolMapEntry> | null = null;
let cachedGatewayTools: GatewayTool[] | null = null;

// ── Phase 1: Data gathering ─────────────────────────────────────

/**
 * Collects aggregated tool data from all connected servers.
 * Iterates tool cache entries and applies the aggregatedTools filter.
 */
function gatherRawToolData(): Map<string, RawServerData> {
  const rawData = new Map<string, RawServerData>();

  for (const [compositeKey, tools] of mcpConnectionManager.getToolCacheEntries()) {
    const parsed = parseCompositeKey(compositeKey);
    const serverName = parsed ? parsed.serverName : compositeKey;
    const serverIndex = parsed ? parsed.serverIndex : 0;
    const serverConfig = hubManager.getServerByName(serverName);
    if (!serverConfig) continue;

    const aggregatedTools = serverConfig.template?.aggregatedTools;
    if (!aggregatedTools?.length) continue;

    const filteredTools = tools.filter((t) => aggregatedTools.includes(t.name));
    if (filteredTools.length === 0) continue;

    const existing = rawData.get(serverName);
    if (existing) {
      // Merge tools from multiple instances — later tools overwrite earlier by name
      const mergedTools = new Map<string, Tool>();
      for (const t of existing.tools) mergedTools.set(t.name, t);
      for (const t of filteredTools) mergedTools.set(t.name, t);
      // Update toolIndexes for tools from this instance
      const mergedIndexes = new Map(existing.toolIndexes);
      for (const t of filteredTools) {
        mergedIndexes.set(t.name, serverIndex);
      }
      rawData.set(serverName, {
        tools: Array.from(mergedTools.values()),
        aggregated: aggregatedTools,
        toolIndexes: mergedIndexes
      });
    } else {
      const toolIndexes = new Map<string, number>();
      for (const t of filteredTools) {
        toolIndexes.set(t.name, serverIndex);
      }
      rawData.set(serverName, {
        tools: filteredTools,
        aggregated: aggregatedTools,
        toolIndexes
      });
    }
  }

  let totalTools = 0;
  for (const [, data] of rawData) {
    totalTools += data.tools.length;
  }
  logger.debug(
    `Gateway tool cache: gathered ${totalTools} aggregated tools across ${rawData.size} servers`,
    LOG_MODULES.TOOL_LIST_GENERATOR
  );

  return rawData;
}

// ── Phase 2: Name resolution ────────────────────────────────────

/**
 * Resolves final gateway tool names from raw data.
 * Pure computation — no external calls.
 */
function resolveToolNames(
  rawData: Map<string, RawServerData>,
  toolMap: Map<string, ToolMapEntry>
): GatewayTool[] {
  toolMap.clear();
  const gatewayTools: GatewayTool[] = [];
  const usedNames = new Set<string>();

  // Add system tools
  const systemTools = hubToolsService.getSystemTools();
  for (const tool of systemTools) {
    gatewayTools.push({
      name: tool.name,
      description: `[System] ${tool.description}`,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations
    });
    usedNames.add(tool.name);
  }

  // First pass: count tool name frequencies
  const toolNameCounts = new Map<string, number>();
  for (const [, data] of rawData) {
    for (const tool of data.tools) {
      toolNameCounts.set(tool.name, (toolNameCounts.get(tool.name) || 0) + 1);
    }
  }

  // Second pass: generate gateway tools with collision resolution
  for (const [serverName, data] of rawData) {
    for (const tool of data.tools) {
      let gatewayToolName = tool.name;
      const isUnique = toolNameCounts.get(tool.name) === 1;
      const isSystemConflict = usedNames.has(tool.name);

      if (!isUnique || isSystemConflict) {
        const hash = serverName.substring(0, 4);
        gatewayToolName = `${tool.name}_${hash}`;
      }

      // Ensure name doesn't exceed 60 chars
      if (gatewayToolName.length > 60) {
        const hash = serverName.substring(0, 4);
        const maxToolNameLen = 60 - hash.length - 1;
        const truncatedToolName = tool.name.substring(0, maxToolNameLen);
        gatewayToolName = `${truncatedToolName}_${hash}`;
      }

      // Final uniqueness check
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

      usedNames.add(finalName);

      toolMap.set(finalName, {
        serverName,
        serverIndex: data.toolIndexes.get(tool.name) ?? 0,
        realToolName: tool.name
      });

      gatewayTools.push({
        name: finalName,
        description: `[From ${serverName}] ${tool.description || ''}`,
        inputSchema: {
          type: 'object',
          properties: {
            serverName: {
              type: 'string',
              description: `Must be "${serverName}"`
            },
            toolName: {
              type: 'string',
              description: `Must be "${tool.name}"`
            },
            toolArgs: tool.inputSchema || { type: 'object', properties: {} },
            requestOptions: {
              type: 'object',
              description: 'Optional: instance selection options',
              properties: {
                sessionId: {
                  type: 'string',
                  description: 'Session ID for instance stickiness'
                },
                tags: {
                  type: 'object',
                  description: 'Tags for instance matching (e.g. {"env":"prod"})'
                }
              }
            }
          },
          required: ['serverName', 'toolName', 'toolArgs']
        }
      });
    }
  }

  return gatewayTools;
}

// ── Composite: original function (backward compatible) ──────────

export function generateGatewayToolsList(toolMap: Map<string, ToolMapEntry>): GatewayTool[] {
  const rawData = gatherRawToolData();
  return resolveToolNames(rawData, toolMap);
}

// ── Cache API ────────────────────────────────────────────────────

/** Lazy get — first-request fallback when cache hasn't been built yet */
export function getOrBuildGatewayToolMap(): Map<string, ToolMapEntry> {
  if (!cachedToolMap) {
    rebuildFromScratch();
  }
  return cachedToolMap!;
}

/** Lazy get — first-request fallback when cache hasn't been built yet */
export function getOrBuildGatewayToolsList(): GatewayTool[] {
  if (!cachedGatewayTools) {
    rebuildFromScratch();
  }
  return cachedGatewayTools!;
}

/** Lazy get — returns only aggregated external tools (excludes system tools) */
export function getExternalGatewayTools(): GatewayTool[] {
  return getOrBuildGatewayToolsList().filter((t) => !t.description?.startsWith('[System]'));
}

/** Full rebuild from global state — used by TOOLS_UPDATED / SERVER_DISCONNECTED */
export function rebuildFromScratch(): void {
  const prevSize = cachedToolMap?.size ?? 0;
  rawToolData = gatherRawToolData();
  cachedToolMap = new Map<string, ToolMapEntry>();
  cachedGatewayTools = resolveToolNames(rawToolData, cachedToolMap);
  logger.info(
    `Gateway tool cache rebuilt: ${cachedToolMap.size} tools (was ${prevSize})`,
    LOG_MODULES.TOOL_LIST_GENERATOR
  );
}

/** Incremental add — update raw data layer, re-resolve names only */
export function addToCache(serverName: string, toolNames: string[]): void {
  if (!rawToolData) {
    logger.debug(
      `Gateway tool cache: raw data not initialized, falling back to full rebuild`,
      LOG_MODULES.TOOL_LIST_GENERATOR
    );
    rebuildFromScratch();
    return;
  }

  // Find tool definitions with instance info from tool cache entries
  const toolDefs = new Map<string, Tool>();
  const toolIndexes = new Map<string, number>();
  for (const [compositeKey, tools] of mcpConnectionManager.getToolCacheEntries()) {
    const parsed = parseCompositeKey(compositeKey);
    if (!parsed || parsed.serverName !== serverName) continue;
    for (const t of tools) {
      if (toolNames.includes(t.name)) {
        toolDefs.set(t.name, t);
        toolIndexes.set(t.name, parsed.serverIndex);
      }
    }
  }
  const newTools = Array.from(toolDefs.values());

  const existing = rawToolData.get(serverName);
  if (existing) {
    const mergedTools = new Map<string, Tool>();
    for (const t of existing.tools) mergedTools.set(t.name, t);
    for (const t of newTools) mergedTools.set(t.name, t);
    const mergedIndexes = new Map(existing.toolIndexes);
    for (const [name, idx] of toolIndexes) {
      mergedIndexes.set(name, idx);
    }
    existing.tools = Array.from(mergedTools.values());
    existing.aggregated = [...new Set([...existing.aggregated, ...toolNames])];
    existing.toolIndexes = mergedIndexes;
  } else {
    const serverConfig = hubManager.getServerByName(serverName);
    rawToolData.set(serverName, {
      tools: newTools,
      aggregated: serverConfig?.template?.aggregatedTools ?? toolNames,
      toolIndexes
    });
  }

  cachedToolMap = new Map<string, ToolMapEntry>();
  cachedGatewayTools = resolveToolNames(rawToolData, cachedToolMap);
  logger.info(
    `Gateway tool cache: added ${toolNames.length} tool(s) from [${serverName}], total=${cachedToolMap.size}`,
    LOG_MODULES.TOOL_LIST_GENERATOR
  );
}

/** Incremental remove — update raw data layer, re-resolve names only */
export function removeFromCache(serverName: string, toolNames: string[]): void {
  if (!rawToolData) {
    logger.debug(
      `Gateway tool cache: raw data not initialized, falling back to full rebuild`,
      LOG_MODULES.TOOL_LIST_GENERATOR
    );
    rebuildFromScratch();
    return;
  }

  const existing = rawToolData.get(serverName);
  if (!existing) {
    logger.debug(
      `Gateway tool cache: no cached data for [${serverName}], skip remove`,
      LOG_MODULES.TOOL_LIST_GENERATOR
    );
    return;
  }

  const removeSet = new Set(toolNames);
  existing.tools = existing.tools.filter((t) => !removeSet.has(t.name));
  existing.aggregated = existing.aggregated.filter((t) => !removeSet.has(t));

  if (existing.aggregated.length === 0) {
    rawToolData.delete(serverName);
    logger.info(
      `Gateway tool cache: all aggregated tools removed from [${serverName}], server removed from cache`,
      LOG_MODULES.TOOL_LIST_GENERATOR
    );
  }

  cachedToolMap = new Map<string, ToolMapEntry>();
  cachedGatewayTools = resolveToolNames(rawToolData, cachedToolMap);
  logger.info(
    `Gateway tool cache: removed ${toolNames.length} tool(s) from [${serverName}], total=${cachedToolMap.size}`,
    LOG_MODULES.TOOL_LIST_GENERATOR
  );
}
