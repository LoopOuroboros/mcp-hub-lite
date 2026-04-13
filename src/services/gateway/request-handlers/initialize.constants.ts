import { z } from 'zod';

export const InitializeRequestSchema = z.object({
  method: z.literal('initialize'),
  params: z
    .object({
      clientInfo: z
        .object({
          name: z.string(),
          version: z.string()
        })
        .optional(),
      capabilities: z
        .object({
          tools: z
            .object({
              list: z.boolean().optional(),
              execute: z.boolean().optional()
            })
            .optional(),
          roots: z
            .object({
              list: z.boolean().optional()
            })
            .optional(),
          experimental: z.record(z.string(), z.any()).optional()
        })
        .optional(),
      protocolVersion: z.string().optional()
    })
    .optional(),
  id: z.union([z.string(), z.number()]),
  jsonrpc: z.literal('2.0')
});

export const PingRequestSchema = z.object({
  method: z.literal('ping'),
  params: z.object({}).optional(),
  id: z.union([z.string(), z.number()]),
  jsonrpc: z.literal('2.0')
});

export const InitializedNotificationSchema = z.object({
  method: z.literal('notifications/initialized'),
  params: z.any().optional(),
  jsonrpc: z.literal('2.0')
});
