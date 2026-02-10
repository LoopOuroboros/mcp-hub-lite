/**
 * System tools constants for MCP Hub Lite
 * Centralized definition of system tool names and gateway server names
 */

// 系统工具参数类型定义
export interface ListServersParams {}

export interface FindServersParams {
  pattern: string;
  searchIn?: 'name' | 'description' | 'both';
  caseSensitive?: boolean;
}

export interface ListAllToolsInServerParams {
  serverName: string;
  requestOptions?: {
    sessionId?: string;
    tags?: Record<string, string>;
  };
}

export interface FindToolsInServerParams {
  serverName: string;
  pattern: string;
  searchIn?: 'name' | 'description' | 'both';
  caseSensitive?: boolean;
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

export interface FindToolsParams {
  pattern: string;
  searchIn?: 'name' | 'description' | 'both';
  caseSensitive?: boolean;
}

// Individual system tool name constants
export const LIST_SERVERS_TOOL = 'list_servers';
export const FIND_SERVERS_TOOL = 'find_servers';
export const LIST_ALL_TOOLS_IN_SERVER_TOOL = 'list_all_tools_in_server';
export const FIND_TOOLS_IN_SERVER_TOOL = 'find_tools_in_server';
export const GET_TOOL_TOOL = 'get_tool';
export const CALL_TOOL_TOOL = 'call_tool';
export const FIND_TOOLS_TOOL = 'find_tools';

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
  FIND_TOOLS_TOOL
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