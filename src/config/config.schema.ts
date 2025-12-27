import { z } from 'zod';

export const McpServerConfigSchema = z.object({
  id: z.string().uuid().optional().default(() => crypto.randomUUID()),
  name: z.string().min(1, 'Name is required'),
  command: z.string().min(1, 'Command is required'),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true)
});

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

export const GlobalConfigSchema = z.object({
  servers: z.array(McpServerConfigSchema).default([]),
  port: z.number().int().positive().default(3000),
  host: z.string().default('localhost'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
