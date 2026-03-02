/**
 * Log module constants.
 * This file contains predefined log module constants for consistent usage across the codebase.
 */

import type { LogOptions } from './log-context.js';

/**
 * Log module constants for use with the logger.
 * These constants provide type-safe module identifiers for consistent logging.
 *
 * @example
 * ```typescript
 * import { LOG_MODULES } from './logger/log-modules.js';
 *
 * logger.info('Server started', LOG_MODULES.SERVER);
 * logger.debug('Processing request', LOG_MODULES.GATEWAY, requestData);
 *
 * // For dynamic module names
 * logger.info('Dynamic module', LOG_MODULES.dynamic('MyCustomModule'));
 * ```
 */
export const LOG_MODULES = {
  // Core system modules
  SERVER: { module: 'Server' } satisfies LogOptions,
  DEV_SERVER: { module: 'DevServer' } satisfies LogOptions,

  // Config management
  CONFIG_MANAGER: { module: 'ConfigManager' } satisfies LogOptions,
  CONFIG_LOADER: { module: 'ConfigLoader' } satisfies LogOptions,
  CONFIG_CHANGES: { module: 'System Config Changes' } satisfies LogOptions,

  // Session management
  SESSION_MANAGER: { module: 'SessionManager' } satisfies LogOptions,
  SESSION: { module: 'Session' } satisfies LogOptions,
  SESSION_API: { module: 'Session API' } satisfies LogOptions,

  // Connection management
  CONNECTION_MANAGER: { module: 'ConnectionManager' } satisfies LogOptions,
  HUB_MANAGER: { module: 'HubManager' } satisfies LogOptions,

  // Gateway related
  GATEWAY: { module: 'Gateway' } satisfies LogOptions,
  GATEWAY_SERVICE: { module: 'GatewayService' } satisfies LogOptions,

  // Tool handling
  HUB_TOOLS: { module: 'HubTools' } satisfies LogOptions,
  SYSTEM_TOOL: { module: 'SystemTool' } satisfies LogOptions,
  TOOL_LIST: { module: 'ToolList' } satisfies LogOptions,

  // Gateway request handlers
  INITIALIZE_HANDLER: { module: 'Initialize' } satisfies LogOptions,
  SYSTEM_TOOLS_HANDLER: { module: 'SystemTools' } satisfies LogOptions,
  RESOURCES_HANDLER: { module: 'Resources' } satisfies LogOptions,
  TOOLS_HANDLER: { module: 'Tools' } satisfies LogOptions,

  // Search service
  SEARCH: { module: 'Search' } satisfies LogOptions,

  // Communication
  COMMUNICATION: { module: 'Communication' } satisfies LogOptions,
  CONTEXT: { module: 'Context' } satisfies LogOptions,

  // WebSocket
  WEBSOCKET: { module: 'WebSocket' } satisfies LogOptions,

  // Transports
  HTTP_TRANSPORT: { module: 'HTTPTransport' } satisfies LogOptions,
  STDIO_TRANSPORT: { module: 'StdioTransport' } satisfies LogOptions,
  SSE_TRANSPORT: { module: 'SSETransport' } satisfies LogOptions,

  // PID management
  PID_MANAGER: { module: 'PIDManager' } satisfies LogOptions,

  // Client tracking
  CLIENT_TRACKER: { module: 'ClientTracker' } satisfies LogOptions,
  CLIENT_API: { module: 'ClientAPI' } satisfies LogOptions,

  // Server API
  SERVER_API: { module: 'ServerAPI' } satisfies LogOptions,
  MCP_STATUS: { module: 'MCPStatus' } satisfies LogOptions,

  /**
   * Creates a dynamic log module for custom or runtime-generated module names.
   * Use this for server-specific logging or other dynamic contexts.
   *
   * @param moduleName - The dynamic module name
   * @returns A LogOptions object with the module name
   *
   * @example
   * ```typescript
   * logger.info('Server connected', LOG_MODULES.dynamic(serverId));
   * ```
   */
  dynamic: (moduleName: string) => ({ module: moduleName }) satisfies LogOptions
} as const;

/**
 * Type representing the keys of LOG_MODULES.
 */
export type LogModuleKey = keyof Omit<typeof LOG_MODULES, 'dynamic'>;

/**
 * Type representing a log module object.
 */
export type LogModule = typeof LOG_MODULES[LogModuleKey];
