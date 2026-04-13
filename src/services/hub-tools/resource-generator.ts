import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import type { Resource } from '@shared-models/resource.model.js';
import type { ServerStatus } from '@shared-types/common.types.js';
import { hasValidId, selectBestInstance, getServerDescription } from './server-selector.js';

/**
 * Maps Hub URI to original MCP URI for resource forwarding.
 * Key: Hub URI (e.g., "hub://servers/exa-ai/0/tools/list")
 * Value: Original MCP URI (e.g., "exa://tools/list")
 */
const hubToMcpUriMap = new Map<string, string>();

/**
 * Clears the Hub to MCP URI mapping.
 * Should be called before regenerating resources.
 */
export function clearHubToMcpUriMap(): void {
  hubToMcpUriMap.clear();
}

/**
 * Maps an MCP native URI to hub format.
 * Example: "exa://tools/list" -> "hub://servers/exa-ai/0/tools/list"
 * Also registers the mapping in hubToMcpUriMap for reverse lookup.
 *
 * @param serverName - The server name
 * @param instanceIndex - The instance index
 * @param mcpUri - The native MCP URI (e.g., "exa://tools/list")
 * @returns The hub-formatted URI
 */
function getMcpPathFromUri(mcpUri: string): string {
  return mcpUri.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:(\/\/)?/, '');
}

function mapMcpUriToHub(serverName: string, instanceIndex: number, mcpUri: string): string {
  // Remove the scheme prefix (e.g., "exa://" or "exa:")
  const mcpPath = getMcpPathFromUri(mcpUri);
  const hubUri = `hub://servers/${serverName}/${instanceIndex}/${mcpPath}`;
  // Register mapping for reverse lookup in readResource
  hubToMcpUriMap.set(hubUri, mcpUri);
  return hubUri;
}

/**
 * Restores a missing Hub -> MCP URI mapping by scanning the current instance resources.
 */
function restoreMcpUriMapping(
  serverName: string,
  instanceIndex: number,
  instanceId: string,
  mcpPath: string
): string | null {
  const instanceResources = mcpConnectionManager.getResources(instanceId);

  for (const resource of instanceResources) {
    const originalUri = resource.uri;
    if (typeof originalUri !== 'string') {
      continue;
    }

    if (getMcpPathFromUri(originalUri) !== mcpPath) {
      continue;
    }

    const hubUri = `hub://servers/${serverName}/${instanceIndex}/${mcpPath}`;
    hubToMcpUriMap.set(hubUri, originalUri);
    return originalUri;
  }

  return null;
}

/**
 * Parses a hub URI and extracts components.
 * Supports:
 * - hub://servers/{name} - Server metadata
 * - hub://servers/{name}/tools - Tools list
 * - hub://servers/{name}/resources - Resources list
 * - hub://servers/{name}/{instanceIndex}/{mcpPath} - MCP native resource forwarding
 *
 * @param uri - The hub URI to parse
 * @returns Parsed components, 'unknown' if format is valid but resource type is unknown, or null if format is invalid
 */
function parseHubUri(uri: string):
  | {
      serverName: string;
      instanceIndex?: number;
      mcpPath?: string;
      listType?: 'tools' | 'resources';
    }
  | 'unknown'
  | null {
  if (!uri.startsWith('hub://')) {
    return null;
  }

  const parts = uri.replace('hub://', '').split('/');
  if (parts.length < 2 || parts[0] !== 'servers') {
    return null;
  }

  const serverName = parts[1];

  // hub://servers/{name} - no instance index
  if (parts.length === 2) {
    return { serverName };
  }

  // hub://servers/{name}/tools or hub://servers/{name}/resources
  // These are list requests, not MCP forwarding
  if (parts.length === 3) {
    const resourceType = parts[2];
    if (resourceType === 'tools' || resourceType === 'resources') {
      return { serverName, listType: resourceType };
    }
    // Unknown resource type but valid URI format
    return 'unknown';
  }

  // hub://servers/{name}/{instanceIndex}/{mcpPath}
  const instanceIndex = parseInt(parts[2], 10);
  if (isNaN(instanceIndex) || parts.length < 4) {
    return null;
  }

  const mcpPath = parts.slice(3).join('/');
  return { serverName, instanceIndex, mcpPath };
}

/**
 * Path to the use guide Markdown file.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const USE_GUIDE_PATH = join(__dirname, 'use-guide.md');

/**
 * Loads the use guide content from the Markdown file.
 *
 * @returns {string} Markdown formatted use guide content
 */
function loadUseGuideContent(): string {
  try {
    return fs.readFileSync(USE_GUIDE_PATH, 'utf-8');
  } catch {
    // Fallback in case the file can't be read
    return `# MCP Hub Lite Use Guide

## Overview

MCP Hub Lite is a lightweight MCP (Model Context Protocol) gateway that acts as a unified interface between AI assistants and multiple backend MCP servers.

## Note

The complete use guide is currently unavailable. Please check the MCP Hub Lite documentation at https://github.com/your-org/mcp-hub-lite for more information.
`;
  }
}

/**
 * URI for the use guide resource.
 */
export const USE_GUIDE_URI = 'hub://use-guide';

/**
 * Name of the use guide resource.
 */
export const USE_GUIDE_NAME = 'MCP Hub Lite Use Guide';

/**
 * Description of the use guide resource.
 */
export const USE_GUIDE_DESCRIPTION =
  'Comprehensive guide to using MCP Hub Lite gateway and its features';

/**
 * MIME type for the use guide resource.
 */
export const USE_GUIDE_MIME_TYPE = 'text/markdown';

/**
 * Server metadata resource content.
 */
export interface ServerMetadata {
  name: string;
  status: ServerStatus;
  toolsCount: number;
  tools: Record<string, string>;
  resourcesCount: number;
  tags: Record<string, string>;
  lastHeartbeat: number;
  uptime: number;
  description: string;
}

/**
 * Generates dynamic Hub resources based on currently connected MCP servers.
 *
 * This method creates virtual resources that represent the current state of connected
 * servers. Each resource has a unique URI following the hub://servers/{serverName} pattern.
 *
 * The generated resources include:
 * - Server metadata: hub://servers/{serverName}
 *
 * @returns {Resource[]} Array of dynamically generated MCP resource objects
 *
 * @example
 * ```typescript
 * const resources = generateDynamicResources();
 * console.log(`Generated ${resources.length} dynamic resources`);
 * ```
 */
export function generateDynamicResources(): Resource[] {
  const resources: Resource[] = [];
  clearHubToMcpUriMap();

  // Add use-guide resource first - it's always available
  resources.push({
    uri: USE_GUIDE_URI,
    name: USE_GUIDE_NAME,
    description: USE_GUIDE_DESCRIPTION,
    mimeType: USE_GUIDE_MIME_TYPE,
    // System resources don't have a serverId
    serverId: undefined
  });

  // Use the same access pattern as tools - directly access manager cache
  const servers = hubManager.getAllServers();

  for (const server of servers) {
    if (!hasValidId(server)) {
      continue;
    }
    // Check if any instance is enabled
    const hasEnabledInstance = server.config.instances.some((i) => i.enabled !== false);
    if (!hasEnabledInstance) {
      continue;
    }

    // Iterate over all instances to expose each instance's resources
    for (const instance of server.config.instances) {
      if (instance.enabled === false) {
        continue;
      }

      const instanceId = instance.id as string;
      const instanceIndex = instance.index;

      // Server metadata resource (one per server, not per instance)
      if (instanceIndex === 0) {
        resources.push({
          uri: `hub://servers/${server.name}`,
          name: `Server: ${server.name}`,
          description: getServerDescription(server.config, server.name),
          mimeType: 'application/json',
          serverId: instanceId
        });
      }

      // Get MCP native resources and map to hub format
      const instanceIdx = instanceIndex ?? 0;
      const mcpResources = mcpConnectionManager.getResources(instanceId);
      for (const res of mcpResources) {
        // Format: Resource: {ServerName} - {Index}: {Native Name}
        const displayName = `Resource：${server.name} - ${instanceIdx}：${res.name}`;
        resources.push({
          uri: mapMcpUriToHub(server.name, instanceIdx, res.uri),
          name: displayName,
          description: res.description,
          mimeType: res.mimeType
          // No serverId - instanceIndex is embedded in the URI
        });
      }
    }
  }

  return resources;
}

/**
 * Reads content from a specific Hub resource URI.
 *
 * This method provides access to dynamically generated Hub resources by parsing the URI
 * and returning the appropriate content based on the resource type. It supports three
 * types of resources:
 * - Server metadata: hub://servers/{serverName}
 * - Tools list: hub://servers/{serverName}/tools
 * - Resources list: hub://servers/{serverName}/resources
 *
 * The method includes comprehensive validation of URI format and server existence,
 * throwing descriptive errors for invalid requests.
 *
 * @param {string} uri - Resource URI to read (e.g., hub://servers/server-name)
 * @returns {Promise<ServerMetadata | Tool[] | Resource[]>} Resource content based on URI type
 * @throws {Error} If URI format is invalid, server not found, or resource type unknown
 *
 * @example
 * ```typescript
 * // Read server metadata
 * const serverInfo = await readResource('hub://servers/my-mcp-server');
 *
 * // Read tools list
 * const tools = await readResource('hub://servers/my-mcp-server/tools');
 * ```
 */
export async function readResource(
  uri: string
): Promise<ServerMetadata | Resource[] | string | unknown> {
  // Validate URI format
  if (!uri.startsWith('hub://')) {
    throw new Error(`Invalid Hub resource URI: ${uri}. Must start with 'hub://'`);
  }

  // Check for use-guide resource first
  if (uri === USE_GUIDE_URI) {
    return loadUseGuideContent();
  }

  // Parse URI
  const parsed = parseHubUri(uri);
  if (!parsed) {
    throw new Error(`Invalid Hub resource URI format: ${uri}`);
  }

  // Handle unknown resource type
  if (parsed === 'unknown') {
    const parts = uri.replace('hub://', '').split('/');
    const resourceType = parts[2];
    throw new Error(`Unknown resource type: ${resourceType}`);
  }

  const { serverName, instanceIndex, mcpPath, listType } = parsed;

  // Find server config
  const serverConfig = hubManager.getServerByName(serverName);
  if (!serverConfig) {
    throw new Error(`Server not found: ${serverName}`);
  }

  // If no instanceIndex, check if this is a list request or metadata request
  if (instanceIndex === undefined) {
    // Handle list requests first
    if (listType) {
      // Use selectBestInstance to get an instance for the list
      const serverInfo = selectBestInstance(serverName);
      if (!serverInfo) {
        throw new Error(`Server not found or not connected: ${serverName}`);
      }
      const instanceId = serverInfo.instance.id as string;

      if (listType === 'tools') {
        return mcpConnectionManager.getTools(instanceId) as unknown as Resource[];
      } else {
        return mcpConnectionManager.getResources(instanceId);
      }
    }

    // Server metadata request - use selectBestInstance to get runtime properties
    const serverInfo = selectBestInstance(serverName);
    if (!serverInfo) {
      throw new Error(`Server not found or not connected: ${serverName}`);
    }

    const instanceId = serverInfo.instance.id as string;
    const tools = mcpConnectionManager.getTools(instanceId);
    const resources = mcpConnectionManager.getResources(instanceId);

    // Build tool name to description map
    const toolsMap: Record<string, string> = {};
    for (const tool of tools) {
      toolsMap[tool.name as string] = (tool.description as string) || '';
    }

    return {
      name: serverName,
      status: serverInfo.instance.status as ServerStatus,
      toolsCount: tools.length,
      tools: toolsMap,
      resourcesCount: resources.length,
      tags: serverInfo.instance.tags || {},
      lastHeartbeat: serverInfo.instance.lastHeartbeat as number,
      uptime: serverInfo.instance.uptime as number,
      description: getServerDescription(serverConfig, serverName)
    };
  }

  // MCP native resource forwarding: hub://servers/{name}/{instanceIndex}/{mcpPath}
  // Find the specific instance by index
  const targetInstance = serverConfig.instances.find(
    (i) => i.index === instanceIndex && i.enabled !== false
  );
  if (!targetInstance) {
    throw new Error(`Instance ${instanceIndex} not found or not enabled for server: ${serverName}`);
  }

  const instanceId = targetInstance.id as string;

  // If mcpPath is empty, return instance-level info
  if (!mcpPath) {
    return mcpConnectionManager.getResources(instanceId);
  }

  // Forward to MCP server for actual resource read
  // Use the mapping to get the original MCP URI (hub://servers/exa-ai/0/tools/list -> exa://tools/list)
  let originalMcpUri: string | null | undefined = hubToMcpUriMap.get(uri);
  if (!originalMcpUri) {
    originalMcpUri = restoreMcpUriMapping(serverName, instanceIndex, instanceId, mcpPath);
  }
  if (!originalMcpUri) {
    throw new Error(`MCP URI not found in mapping for: ${uri}`);
  }
  return mcpConnectionManager.readResource(instanceId, originalMcpUri);
}
