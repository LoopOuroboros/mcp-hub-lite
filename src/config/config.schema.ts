import {
  TransportType,
  TagDefinitionSchema,
  ServerInstanceSchema,
  ServerInstanceUpdateSchema,
  ServerTemplateSchema,
  ServerConfigSchema,
  LoggingConfigSchema,
  SecurityConfigSchema,
  SystemConfigSchema,
  ServerInstanceConfigSchema,
  type SystemConfig,
  type ServerConfig,
  type ServerTemplate,
  type ServerInstance,
  type ServerInstanceUpdate,
  type TagDefinition,
  type ServerInstanceConfig,
  type ServerRuntimeConfig
} from '@shared-models/server.model.js';

/**
 * MCP Server Configuration Schema
 * Simplified v1.1 only - No v1.0 compatibility
 *
 * Note: All core schemas are now defined in @shared-models/server.model.ts
 * This file re-exports them for backward compatibility and retains
 * TransportType constants and legacy helper functions.
 */

// Re-export shared types for backward compatibility
export {
  TransportType,
  TagDefinitionSchema,
  ServerInstanceSchema,
  ServerInstanceUpdateSchema,
  ServerTemplateSchema,
  ServerConfigSchema,
  LoggingConfigSchema,
  SecurityConfigSchema,
  SystemConfigSchema,
  ServerInstanceConfigSchema
};

export type {
  SystemConfig,
  ServerConfig,
  ServerTemplate,
  ServerInstance,
  ServerInstanceUpdate,
  TagDefinition,
  ServerInstanceConfig,
  ServerRuntimeConfig
};

/**
 * Simplified type guard - only check for legacy v1.0 format for migration
 */
export function isLegacyV1Config(config: unknown): boolean {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as { version?: string };
  return c.version !== '1.1.0';
}
