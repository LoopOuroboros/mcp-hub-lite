import { z } from 'zod';
import type { LogLevel } from '@shared-types/common.types.js';

/**
 * MCP Server Configuration Schema
 * Simplified schema for MCP-HUB-LITE Lite version
 */

// Server configuration schema (keyed by server name)
export const ServerConfigSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
  tags: z.record(z.string(), z.string()).optional(),
  type: z.enum(['stdio', 'sse', 'streamable-http', 'http']).default('stdio'),
  timeout: z.number().default(60000),
  url: z.string().optional(),
  allowedTools: z.array(z.string()).default([]),
  description: z.string().optional()
});

// Server instance schema (each instance contains id, timestamp, hash)
export const ServerInstanceConfigSchema = z.object({
  id: z.string(),
  timestamp: z.number(), // Startup time
  hash: z.string(),
  pid: z.number().optional(), // Process ID
  startTime: z.number().optional() // Startup time (same as timestamp, for compatibility)
});

/**
 * Logging Configuration Schema
 */
export const LoggingConfigSchema = z
  .object({
    level: z.custom<LogLevel>().default('info'),
    rotationAge: z.string().default('7d'), // e.g., "7d", "30d"
    jsonPretty: z.boolean().default(true) // Enable pretty JSON formatting in logs
  })
  .default({
    level: 'info',
    rotationAge: '7d',
    jsonPretty: true
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
 * System Configuration Schema
 */
export const SystemConfigSchema = z.object({
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
        jsonPretty: true
      }
    }),
  security: SecurityConfigSchema,
  servers: z.record(z.string(), ServerConfigSchema).default({})
});

// Export types
export type SystemConfig = z.infer<typeof SystemConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type ServerInstanceConfig = z.infer<typeof ServerInstanceConfigSchema>;
