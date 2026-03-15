import type { JsonSchema } from '@shared-models/tool.model.js';
import {
  SYSTEM_TOOL_NAMES,
  LIST_SERVERS_TOOL,
  FIND_SERVERS_TOOL,
  LIST_ALL_TOOLS_IN_SERVER_TOOL,
  FIND_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  FIND_TOOLS_TOOL
} from '@models/system-tools.constants.js';

/**
 * Tool annotation configuration.
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * System tool definition structure.
 */
export interface SystemToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: ToolAnnotations;
}

/**
 * Retrieves the complete list of system tools provided by this service.
 *
 * This method generates system tool configurations based on the SYSTEM_TOOL_NAMES constant,
 * ensuring consistency with the defined system tool names. Each tool includes its name,
 * description, input schema, and annotations for proper client-side rendering and behavior.
 *
 * The method implements all standard system tools:
 * - list-servers: List all connected servers
 * - find-servers: Find servers matching a pattern
 * - list-all-tools-in-server: List tools from a specific server
 * - find-tools-in-server: Find tools in a specific server
 * - get-tool: Get complete tool schema
 * - call-tool: Call a specific tool from a specific server
 * - find-tools: Find tools across all servers
 *
 * @returns {Array<{ name: string; description: string; inputSchema: JsonSchema; annotations?: ToolAnnotations }>}
 * Array of system tool configurations
 *
 * @example
 * ```typescript
 * const systemTools = getSystemTools();
 * console.log(`Available system tools: ${systemTools.length}`);
 * ```
 */
export function getSystemTools(): SystemToolDefinition[] {
  const systemTools: SystemToolDefinition[] = [];

  // Build system tools based on the constant array to ensure consistency
  for (const toolName of SYSTEM_TOOL_NAMES) {
    switch (toolName) {
      case LIST_SERVERS_TOOL:
        systemTools.push({
          name: toolName,
          description: 'List all connected servers',
          inputSchema: {
            type: 'object',
            properties: {}
          },
          annotations: {
            title: 'List Servers',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        });
        break;
      case FIND_SERVERS_TOOL:
        systemTools.push({
          name: toolName,
          description: 'Find servers matching a pattern',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'Regex pattern to search for' },
              searchIn: {
                type: 'string',
                enum: ['name', 'description', 'both'],
                default: 'both'
              },
              caseSensitive: { type: 'boolean', default: false }
            },
            required: ['pattern']
          },
          annotations: {
            title: 'Find Servers',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        });
        break;
      case LIST_ALL_TOOLS_IN_SERVER_TOOL:
        systemTools.push({
          name: toolName,
          description: 'List all tools from a specific server',
          inputSchema: {
            type: 'object',
            properties: {
              serverName: { type: 'string', description: 'Name of the MCP server' },
              requestOptions: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string', description: 'Session ID for instance selection' },
                  tags: { type: 'object', description: 'Tags for instance selection' }
                }
              }
            },
            required: ['serverName']
          },
          annotations: {
            title: 'List Tools in Server',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        });
        break;
      case FIND_TOOLS_IN_SERVER_TOOL:
        systemTools.push({
          name: toolName,
          description: 'Find tools matching a pattern in a specific server',
          inputSchema: {
            type: 'object',
            properties: {
              serverName: { type: 'string', description: 'Name of the MCP server' },
              pattern: { type: 'string', description: 'Regex pattern to search for' },
              searchIn: {
                type: 'string',
                enum: ['name', 'description', 'both'],
                default: 'both'
              },
              caseSensitive: { type: 'boolean', default: false },
              requestOptions: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string', description: 'Session ID for instance selection' },
                  tags: { type: 'object', description: 'Tags for instance selection' }
                }
              }
            },
            required: ['serverName', 'pattern']
          },
          annotations: {
            title: 'Find Tools in Server',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        });
        break;
      case GET_TOOL_TOOL:
        systemTools.push({
          name: toolName,
          description: 'Get complete schema for a specific tool from a specific server',
          inputSchema: {
            type: 'object',
            properties: {
              serverName: { type: 'string', description: 'Name of the MCP server' },
              toolName: { type: 'string', description: 'Exact name of the tool' },
              requestOptions: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string', description: 'Session ID for instance selection' },
                  tags: { type: 'object', description: 'Tags for instance selection' }
                }
              }
            },
            required: ['serverName', 'toolName']
          },
          annotations: {
            title: 'Get Tool Details',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        });
        break;
      case CALL_TOOL_TOOL:
        systemTools.push({
          name: toolName,
          description: 'Call a specific tool from a specific server',
          inputSchema: {
            type: 'object',
            properties: {
              serverName: { type: 'string', description: 'Name of the MCP server' },
              toolName: { type: 'string', description: 'Name of the tool to call' },
              toolArgs: { type: 'object', description: 'Arguments to pass to the tool' },
              requestOptions: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string', description: 'Session ID for instance selection' },
                  tags: { type: 'object', description: 'Tags for instance selection' }
                }
              }
            },
            required: ['serverName', 'toolName', 'toolArgs']
          },
          annotations: {
            title: 'Call Tool',
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true
          }
        });
        break;
      case FIND_TOOLS_TOOL:
        systemTools.push({
          name: toolName,
          description: 'Find tools matching a pattern across all connected servers',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'Regex pattern to search for' },
              searchIn: {
                type: 'string',
                enum: ['name', 'description', 'both'],
                default: 'both'
              },
              caseSensitive: { type: 'boolean', default: false }
            },
            required: ['pattern']
          },
          annotations: {
            title: 'Find Tools',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        });
        break;
      default:
        // This should never happen due to TypeScript type checking
        throw new Error(`Unknown system tool: ${toolName}`);
    }
  }

  return systemTools;
}
