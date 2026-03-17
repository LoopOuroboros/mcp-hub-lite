/**
 * System tools constants for MCP Hub Lite
 * Centralized definition of system tool names and gateway server names
 */

// System tool parameter type definitions
export type ListServersParams = Record<string, never>;

export interface ListToolsInServerParams {
  serverName: string;
  requestOptions?: {
    sessionId?: string;
    tags?: Record<string, string>;
  };
}

export interface GetToolParams {
  serverName: string;
  toolName: string;
  requestOptions?: {
    sessionId?: string;
    tags?: Record<string, string>;
  };
}

export interface CallToolParams {
  serverName: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  requestOptions?: {
    sessionId?: string;
    tags?: Record<string, string>;
  };
}

export interface UpdateServerDescriptionParams {
  serverName: string;
  description: string;
}

// Union type for system tool parameters
export type SystemToolArgs =
  | ListServersParams
  | ListToolsInServerParams
  | GetToolParams
  | CallToolParams
  | UpdateServerDescriptionParams;

// Individual system tool name constants
export const LIST_SERVERS_TOOL = 'list_servers';
export const LIST_TOOLS_IN_SERVER_TOOL = 'list_tools_in_server';
export const GET_TOOL_TOOL = 'get_tool';
export const CALL_TOOL_TOOL = 'call_tool';
export const UPDATE_SERVER_DESCRIPTION_TOOL = 'update_server_description';

/**
 * List of all system tool names
 * This array is used to identify system tools across the application
 */
export const SYSTEM_TOOL_NAMES = [
  LIST_SERVERS_TOOL,
  LIST_TOOLS_IN_SERVER_TOOL,
  GET_TOOL_TOOL,
  CALL_TOOL_TOOL,
  UPDATE_SERVER_DESCRIPTION_TOOL
] as const;

/**
 * Type definition for system tool names
 * Provides type safety when working with system tool names
 */
export type SystemToolName = (typeof SYSTEM_TOOL_NAMES)[number];

// Individual gateway server name constant
/**
 * MCP Hub Lite server name - represents both the system tools server and the gateway server
 * This single name is used for both system tool identification and gateway server naming
 */
export const MCP_HUB_LITE_SERVER = 'mcp-hub-lite';
