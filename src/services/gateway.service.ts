/**
 * Gateway service - Thin wrapper for backward compatibility.
 * @deprecated Use @services/gateway/index.ts instead
 */

// Re-export from the new modular structure
export { GatewayService, gateway } from './gateway/index.js';
export type { ToolMapEntry, GatewayTool } from './gateway/types.js';
