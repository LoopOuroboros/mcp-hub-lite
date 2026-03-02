/**
 * @deprecated This file is now a thin wrapper. Please import from './connection/index.js' instead.
 * MCP Connection Manager - Connection management for MCP servers.
 */

// Re-export everything from the new modular implementation
export { McpConnectionManager, mcpConnectionManager } from './connection/index.js';
export type { ServerStatus } from './connection/index.js';
