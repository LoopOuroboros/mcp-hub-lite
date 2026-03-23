import { z } from 'zod';
import type { LogLevel } from '@shared-types/common.types.js';

/**
 * MCP Server Configuration Schema
 * Simplified v1.1 only - No v1.0 compatibility
 */

/**
 * Transport type constants for MCP server connections
 */
export const TransportType = {
  STDIO: 'stdio',
  SSE: 'sse',
  STREAMABLE_HTTP: 'streamable-http',
  HTTP: 'http'
} as const;

export type TransportType = (typeof TransportType)[keyof typeof TransportType];

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
  type: z
    .enum([
      TransportType.STDIO,
      TransportType.SSE,
      TransportType.STREAMABLE_HTTP,
      TransportType.HTTP
    ])
    .default(TransportType.STDIO),
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
export const ServerConfigSchema = z.object({
  template: ServerTemplateSchema,
  instances: z.array(ServerInstanceSchema).default([]),
  tagDefinitions: z.array(TagDefinitionSchema).default([])
});

/**
 * Logging Configuration Schema
 */
export const LoggingConfigSchema = z
  .object({
    level: z.custom<LogLevel>().default('info'),
    rotationAge: z.string().default('7d'),
    jsonPretty: z.boolean().default(true),
    mcpCommDebug: z.boolean().default(false),
    sessionDebug: z.boolean().default(false)
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
      .default(30 * 60 * 1000),
    sessionFlushInterval: z
      .number()
      .min(1000)
      .default(15 * 60 * 1000),
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
 * System Configuration Schema (v1.1 - Primary)
 */
export const SystemConfigSchema = z.object({
  version: z.literal('1.1.0').default('1.1.0'),
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
  servers: z.record(z.string(), ServerConfigSchema).default({}),
  tagDefinitions: z.array(TagDefinitionSchema).default([])
});

/**
 * Simplified type guard - only check for legacy v1.0 format for migration
 */
export function isLegacyV1Config(config: unknown): boolean {
  if (typeof config !== 'object' || config === null) return false;
  const c = config as { version?: string };
  return c.version !== '1.1.0';
}

/**
 * Server instance runtime configuration (for connection manager)
 * Contains runtime-specific fields like timestamp, hash, pid, etc.
 */
export const ServerInstanceConfigSchema = z.object({
  id: z.string(),
  timestamp: z.number(), // Startup time
  hash: z.string(),
  pid: z.number().optional(), // Process ID
  startTime: z.number().optional(), // Startup time (same as timestamp, for compatibility)
  index: z.number().optional(),
  displayName: z.string().optional()
});

// ====== Export Types ======

export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type ServerTemplate = z.infer<typeof ServerTemplateSchema>;
export type ServerInstance = z.infer<typeof ServerInstanceSchema>;
export type TagDefinition = z.infer<typeof TagDefinitionSchema>;
export type ServerInstanceConfig = z.infer<typeof ServerInstanceConfigSchema>;
