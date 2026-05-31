/** MCP Hub Lite gateway server name — used for system tool identification and gateway naming */
export const MCP_HUB_LITE_SERVER = 'mcp-hub-lite';

/** Session mode constants for gateway transport selection */
export const SESSION_MODE_STATELESS = 'stateless' as const;
export const SESSION_MODE_STATEFUL = 'stateful' as const;
export const SESSION_MODE_VALUES = [SESSION_MODE_STATELESS, SESSION_MODE_STATEFUL] as const;
export type SessionMode = (typeof SESSION_MODE_VALUES)[number];
