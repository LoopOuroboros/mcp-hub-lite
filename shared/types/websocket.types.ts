// WebSocket 事件类型常量
export const WEB_SOCKET_EVENT_TYPES = {
  SERVER_STATUS: 'server-status',
  LOG: 'log',
  TOOLS: 'tools',
  RESOURCES: 'resources',
  SERVER_ADDED: 'server-added',
  SERVER_UPDATED: 'server-updated',
  SERVER_DELETED: 'server-deleted',
  SERVER_CONNECTED: 'server-connected',
  SERVER_DISCONNECTED: 'server-disconnected',
  TOOL_CALL_STARTED: 'tool-call-started',
  TOOL_CALL_COMPLETED: 'tool-call-completed',
  TOOL_CALL_ERROR: 'tool-call-error',
  CONFIGURATION_UPDATED: 'configuration-updated',
  CLIENT_CONNECTED: 'client-connected',
  CLIENT_DISCONNECTED: 'client-disconnected',
  PONG: 'pong'
} as const

// 有效事件类型数组
export const VALID_WS_EVENT_TYPES = Object.values(WEB_SOCKET_EVENT_TYPES)

// 导出类型定义
export type WebSocketEventType = typeof VALID_WS_EVENT_TYPES[number]