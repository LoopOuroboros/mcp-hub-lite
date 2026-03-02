import { hubManager } from '@services/hub-manager.service.js';
import { mcpConnectionManager } from '@services/mcp-connection-manager.js';
import type { Resource } from '@shared-models/resource.model.js';
import type { ServerStatus } from '@shared-types/common.types.js';
import { hasValidId, selectBestInstance } from './server-selector.js';

/**
 * Server metadata resource content.
 */
export interface ServerMetadata {
  name: string;
  status: ServerStatus;
  toolsCount: number;
  resourcesCount: number;
  tags: Record<string, string>;
  lastHeartbeat: number;
  uptime: number;
}

/**
 * Generates dynamic Hub resources based on currently connected MCP servers.
 *
 * This method creates virtual resources that represent the current state of connected
 * servers, including server metadata, available tools, and server resources. Each
 * resource has a unique URI following the hub://servers/{serverName}[/type] pattern.
 *
 * The generated resources include:
 * - Server metadata: hub://servers/{serverName}
 * - Tools list: hub://servers/{serverName}/tools
 * - Resources list: hub://servers/{serverName}/resources (only if server has resources)
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

  // Use the same access pattern as tools - directly access manager cache
  const servers = hubManager.getAllServers();

  for (const server of servers) {
    if (!hasValidId(server) || !server.config.enabled) {
      continue;
    }

    const bestInstance = selectBestInstance(server.name);
    if (!bestInstance || !bestInstance.instance.id) {
      continue;
    }

    const instanceId = bestInstance.instance.id;

    // Server metadata resource
    resources.push({
      uri: `hub://servers/${server.name}`,
      name: `Server: ${server.name}`,
      description: server.config.description || `Connected MCP server: ${server.name}`,
      mimeType: 'application/json',
      serverId: instanceId
    });

    // Tools resource - only add if server has tools
    const tools = mcpConnectionManager.getTools(instanceId);
    if (tools.length > 0) {
      resources.push({
        uri: `hub://servers/${server.name}/tools`,
        name: `Tools: ${server.name}`,
        description: `${tools.length} tools available from ${server.name}`,
        mimeType: 'application/json',
        serverId: instanceId
      });
    }

    // Resources resource - only add if server has resources
    const serverResources = mcpConnectionManager.getResources(instanceId);
    if (serverResources.length > 0) {
      resources.push({
        uri: `hub://servers/${server.name}/resources`,
        name: `Resources: ${server.name}`,
        description: `${serverResources.length} resources available from ${server.name}`,
        mimeType: 'application/json',
        serverId: instanceId
      });
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
export async function readResource(uri: string): Promise<ServerMetadata | Resource[]> {
  // Validate URI format
  if (!uri.startsWith('hub://')) {
    throw new Error(`Invalid Hub resource URI: ${uri}. Must start with 'hub://'`);
  }

  // Parse URI
  const uriParts = uri.replace('hub://', '').split('/');
  if (uriParts.length < 2 || uriParts[0] !== 'servers') {
    throw new Error(`Invalid Hub resource URI format: ${uri}`);
  }

  const serverName = uriParts[1];
  const resourceType = uriParts[2]; // 'tools', 'resources', or undefined for server metadata

  // Check if server exists and is connected
  const serverInfo = selectBestInstance(serverName);
  if (!serverInfo) {
    throw new Error(`Server not found or not connected: ${serverName}`);
  }

  const instanceId = serverInfo.instance.id;

  // Return appropriate content based on resource type
  if (!resourceType) {
    // Server metadata
    const serverConfig = hubManager.getServerByName(serverName);
    const tools = mcpConnectionManager.getTools(instanceId);
    const resources = mcpConnectionManager.getResources(instanceId);

    return {
      name: serverName,
      status: serverInfo.instance.status as ServerStatus,
      toolsCount: tools.length,
      resourcesCount: resources.length,
      tags: serverConfig?.tags || {},
      lastHeartbeat: serverInfo.instance.lastHeartbeat as number,
      uptime: serverInfo.instance.uptime as number
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
