/**
 * System tools constants for MCP Hub Lite
 * Centralized definition of system tool names and gateway server names
 */

// Individual system tool name constants
export const LIST_SERVERS_TOOL = 'list-servers';
export const FIND_SERVERS_TOOL = 'find-servers';
export const LIST_ALL_TOOLS_IN_SERVER_TOOL = 'list-all-tools-in-server';
export const FIND_TOOLS_IN_SERVER_TOOL = 'find-tools-in-server';
export const GET_TOOL_TOOL = 'get-tool';
export const CALL_TOOL_TOOL = 'call-tool';
export const FIND_TOOLS_TOOL = 'find-tools';
export const LIST_RESOURCES_TOOL = 'list-resources';
export const READ_RESOURCE_TOOL = 'read-resource';

/**
 * List of all system tool names
 * This array is used to identify system tools across the application
 */
export const SYSTEM_TOOL_NAMES = [
  LIST_SERVERS_TOOL,
  FIND_SERVERS_TOOL,
  LIST_ALL_TOOLS_IN_SERVER_TOOL,
  FIND_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  FIND_TOOLS_TOOL,
  LIST_RESOURCES_TOOL,
  READ_RESOURCE_TOOL
] as const;

/**
 * Type definition for system tool names
 * Provides type safety when working with system tool names
 */
export type SystemToolName = typeof SYSTEM_TOOL_NAMES[number];

// Individual gateway server name constant
/**
 * MCP Hub Lite server name - represents both the system tools server and the gateway server
 * This single name is used for both system tool identification and gateway server naming
 */
export const MCP_HUB_LITE_SERVER = 'mcp-hub-lite';