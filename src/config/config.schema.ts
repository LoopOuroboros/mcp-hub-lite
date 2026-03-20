import { z } from 'zod';
import type { LogLevel } from '@shared-types/common.types.js';

/**
 * MCP Server Configuration Schema
 * Simplified schema for MCP-HUB-LITE Lite version
 */

// ====== v1.1 Configuration Schema (Server Template + Instance Model) ======

/**
 * Tag Definition Schema
 * Defines metadata about a tag key for validation and UI purposes
 */
export const TagDefinitionSchema = z.object({
  key: z.string(),
  description: z.string().optional(),
  type: z.enum(['string', 'number', 'boolean', 'enum']).default('string'),
  values: z.array(z.string()).optional() // For enum type
});

/**
 * Server Instance Configuration Schema
 * Represents a single instance of a server with specific configuration
 */
export const ServerInstanceSchema = z.object({
  id: z.string(),
  enabled: z.boolean().default(true),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  tags: z.record(z.string(), z.string()).default({}),
  index: z.number().optional(),
  displayName: z.string().optional()
});

/**
 * Server Template Configuration Schema
 * Template configuration that can be shared across multiple instances
 */
export const ServerTemplateSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  type: z.enum(['stdio', 'sse', 'streamable-http', 'http']).default('stdio'),
  timeout: z.number().default(60000),
  url: z.string().optional(),
  allowedTools: z.array(z.string()).default([]),
  description: z.string().optional(),
  tags: z.record(z.string(), z.string()).default({})
});

/**
 * Server Configuration Schema (v1.1)
 * A server with a template and multiple instances
 */
export const ServerConfigV1_1Schema = z.object({
  template: ServerTemplateSchema,
  instances: z.array(ServerInstanceSchema).default([]),
  tagDefinitions: z.array(TagDefinitionSchema).default([])
});

// ====== v1.0 Configuration Schema (Legacy Server Model) ======

/**
 * Legacy Server Configuration Schema (v1.0)
 * Single server per configuration entry
 */
export const ServerConfigV1Schema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
  tags: z.record(z.string(), z.string()).optional(),
  type: z.enum(['stdio', 'sse', 'streamable-http', 'http']).default('stdio'),
  timeout: z.number().default(60000),
  url: z.string().optional(),
  allowedTools: z.array(z.string()).default([]),
  description: z.string().optional()
});

// ====== Alias for Backward Compatibility ======
export const ServerConfigSchema = ServerConfigV1Schema;

// Server instance schema (each instance contains id, timestamp, hash)
export const ServerInstanceConfigSchema = z.object({
  id: z.string(),
  timestamp: z.number(), // Startup time
  hash: z.string(),
  pid: z.number().optional(), // Process ID
  startTime: z.number().optional(), // Startup time (same as timestamp, for compatibility)
  index: z.number().optional(),
  displayName: z.string().optional()
});

/**
 * Logging Configuration Schema
 */
export const LoggingConfigSchema = z
  .object({
    level: z.custom<LogLevel>().default('info'),
    rotationAge: z.string().default('7d'), // e.g., "7d", "30d"
    jsonPretty: z.boolean().default(true), // Enable pretty JSON formatting in logs
    mcpCommDebug: z.boolean().default(false), // Enable MCP communication debug logging
    sessionDebug: z.boolean().default(false) // Enable session debug logging
  })
  .default({
    level: 'info',
    rotationAge: '7d',
    jsonPretty: true,
    mcpCommDebug: false,
    sessionDebug: false
  });

/**
 * Security Configuration Schema
 */
export const SecurityConfigSchema = z
  .object({
    allowedNetworks: z
      .array(z.string())
      .default(['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12']),
    maxConcurrentConnections: z.number().min(1).max(1000).default(50),
    connectionTimeout: z.number().min(1000).default(30000),
    idleConnectionTimeout: z.number().min(30000).default(300000),
    sessionTimeout: z
      .number()
      .min(60000)
      .default(30 * 60 * 1000), // Default 30 minutes, min 1 minute
    sessionFlushInterval: z
      .number()
      .min(1000)
      .default(15 * 60 * 1000), // Default 15 minutes, min 1 second
    maxConnections: z.number().min(1).max(1000).default(50)
  })
  .default({
    allowedNetworks: ['127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
    maxConcurrentConnections: 50,
    connectionTimeout: 30000,
    idleConnectionTimeout: 300000,
    sessionTimeout: 30 * 60 * 1000,
    sessionFlushInterval: 15 * 60 * 1000,
    maxConnections: 50
  });

/**
 * System Configuration Schema (v1.0 - Legacy)
 */
export const SystemConfigV1Schema = z.object({
  version: z.string().default('1.0.0'),
  system: z
    .object({
      host: z.string().default('localhost'),
      port: z.number().default(7788),
      language: z.enum(['zh', 'en']).default('zh'),
      theme: z.enum(['light', 'dark', 'system']).default('system'),
      logging: LoggingConfigSchema
    })
    .default({
      host: 'localhost',
      port: 7788,
      language: 'zh',
      theme: 'system',
      logging: {
        level: 'info',
        rotationAge: '7d',
        jsonPretty: true,
        mcpCommDebug: false,
        sessionDebug: false
      }
    }),
  security: SecurityConfigSchema,
  servers: z.record(z.string(), ServerConfigV1Schema).default({}),
  tagDefinitions: z.array(TagDefinitionSchema).default([])
});

/**
 * System Configuration Schema (v1.1 - Server Template + Instance Model)
 */
export const SystemConfigV1_1Schema = z.object({
  version: z.literal('1.1.0'),
  system: z
    .object({
      host: z.string().default('localhost'),
      port: z.number().default(7788),
      language: z.enum(['zh', 'en']).default('zh'),
      theme: z.enum(['light', 'dark', 'system']).default('system'),
      logging: LoggingConfigSchema
    })
    .default({
      host: 'localhost',
      port: 7788,
      language: 'zh',
      theme: 'system',
      logging: {
        level: 'info',
        rotationAge: '7d',
        jsonPretty: true,
        mcpCommDebug: false,
        sessionDebug: false
      }
    }),
  security: SecurityConfigSchema,
  servers: z.record(z.string(), ServerConfigV1_1Schema).default({}),
  tagDefinitions: z.array(TagDefinitionSchema).default([])
});

/**
 * Union type for both configuration versions (maintains backward compatibility)
 * For now, we keep using v1.0 as the primary schema for backward compatibility
 */
export const SystemConfigSchema = SystemConfigV1Schema;

/**
 * Union schema that accepts both versions (for validation)
 */
export const AnySystemConfigSchema = SystemConfigV1Schema.or(SystemConfigV1_1Schema);

// ====== Type Guards ======

/**
 * Type guard to check if config is v1.0 format
 */
export function isV1Config(config: unknown): config is SystemConfigV1 {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as { version?: string };
  // Check for v1.0 version or not v1.1
  if (c.version === '1.1.0') return false;
  return true;
}

/**
 * Type guard to check if config is v1.1 format
 */
export function isV1_1Config(config: unknown): config is SystemConfigV1_1 {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as { version?: string };
  // Check for v1.1 version
  return c.version === '1.1.0';
}

// ====== Export Types ======

export type SystemConfigV1 = z.infer<typeof SystemConfigV1Schema>;
export type SystemConfigV1_1 = z.infer<typeof SystemConfigV1_1Schema>;
export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export type ServerConfigV1 = z.infer<typeof ServerConfigV1Schema>;
export type ServerConfig = ServerConfigV1; // Backward compatibility
export type ServerConfigV1_1 = z.infer<typeof ServerConfigV1_1Schema>;
export type ServerTemplate = z.infer<typeof ServerTemplateSchema>;
export type ServerInstance = z.infer<typeof ServerInstanceSchema>;
export type TagDefinition = z.infer<typeof TagDefinitionSchema>;
export type ServerInstanceConfig = z.infer<typeof ServerInstanceConfigSchema>;

/**
 * Type union for any system configuration version
 */
export type AnySystemConfig = SystemConfigV1 | SystemConfigV1_1;
