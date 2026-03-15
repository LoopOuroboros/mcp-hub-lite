/**
 * Gateway service type definitions.
 */

import type { JsonSchema } from '@shared-models/tool.model.js';

/**
 * Tool map entry for routing gateway tool calls to actual servers.
 */
export interface ToolMapEntry {
  serverId: string;
  realToolName: string;
}

/**
 * Gateway tool with annotations support.
 */
export interface GatewayTool {
  name: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}
