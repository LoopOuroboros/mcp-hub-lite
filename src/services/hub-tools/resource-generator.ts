import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import type { Resource } from '@shared-models/resource.model.js';
import type { ServerStatus } from '@shared-types/common.types.js';
import { hasValidId, selectBestInstance, getServerDescription } from './server-selector.js';

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

    const bestInstance = selectBestInstance(server.name);
    if (!bestInstance || !bestInstance.instance.id) {
      continue;
    }

    const instanceId = bestInstance.instance.id as string;

    // Server metadata resource
    resources.push({
      uri: `hub://servers/${server.name}`,
      name: `Server: ${server.name}`,
      description: getServerDescription(server.config, server.name),
      mimeType: 'application/json',
      serverId: instanceId
    });
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
export async function readResource(uri: string): Promise<ServerMetadata | Resource[] | string> {
  // Validate URI format
  if (!uri.startsWith('hub://')) {
    throw new Error(`Invalid Hub resource URI: ${uri}. Must start with 'hub://'`);
  }

  // Check for use-guide resource first
  if (uri === USE_GUIDE_URI) {
    return loadUseGuideContent();
  }

  // Parse URI
  const uriParts = uri.replace('hub://', '').split('/');
  if (uriParts.length < 2 || uriParts[0] !== 'servers') {
    throw new Error(`Invalid Hub resource URI format: ${uri}`);
  }

  const serverName = uriParts[1];
  const resourceType = uriParts[2] as string | undefined; // 'tools', 'resources', or undefined for server metadata

  // Check if server exists and is connected
  const serverInfo = selectBestInstance(serverName);
  if (!serverInfo) {
    throw new Error(`Server not found or not connected: ${serverName}`);
  }

  const instanceId = serverInfo.instance.id as string;

  // Return appropriate content based on resource type
  if (!resourceType) {
    // Server metadata
    const serverConfig = hubManager.getServerByName(serverName);
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
      tags: serverConfig?.template?.tags || {},
      lastHeartbeat: serverInfo.instance.lastHeartbeat as number,
      uptime: serverInfo.instance.uptime as number,
      description: getServerDescription(serverConfig, serverName)
    };
  } else if (resourceType === 'tools') {
    // Tools list
    return mcpConnectionManager.getTools(instanceId) as unknown as Resource[];
  } else if (resourceType === 'resources') {
    // Resources list
    return mcpConnectionManager.getResources(instanceId);
  } else {
    throw new Error(`Unknown resource type: ${resourceType}`);
  }
}
