import { describe, it, expect } from 'vitest';
import {
  TagDefinitionSchema,
  ServerInstanceSchema,
  ServerInstanceUpdateSchema,
  ServerTemplateSchema,
  ServerConfigSchema,
  SystemConfigSchema,
  isLegacyV1Config,
  type TagDefinition,
  type ServerInstance,
  type ServerTemplate,
  type ServerConfig,
  type SystemConfig
} from '@config/config.schema.js';

describe('Config Schema (v1.1)', () => {
  describe('TagDefinitionSchema', () => {
    it('should validate a valid tag definition', () => {
      const tagDef: TagDefinition = {
        key: 'environment',
        description: 'Deployment environment',
        type: 'enum',
        values: ['dev', 'staging', 'prod']
      };

      const result = TagDefinitionSchema.safeParse(tagDef);
      expect(result.success).toBe(true);
    });

    it('should use default values for optional fields', () => {
      const tagDef = {
        key: 'simple-tag'
      };

      const result = TagDefinitionSchema.safeParse(tagDef);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('string');
      }
    });

    it('should reject invalid tag types', () => {
      const tagDef = {
        key: 'test',
        type: 'invalid-type'
      };

      const result = TagDefinitionSchema.safeParse(tagDef);
      expect(result.success).toBe(false);
    });
  });

  describe('ServerInstanceSchema', () => {
    it('should validate a valid server instance', () => {
      const instance: ServerInstance = {
        id: 'instance-1',
        enabled: true,
        args: ['--verbose'],
        env: { NODE_ENV: 'development' },
        headers: {},
        tags: { environment: 'dev', region: 'us-east' }
      };

      const result = ServerInstanceSchema.safeParse(instance);
      expect(result.success).toBe(true);
    });

    it('should use default values for optional fields', () => {
      const instance = {
        id: 'instance-1'
      };

      const result = ServerInstanceSchema.safeParse(instance);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.args).toEqual([]);
        expect(result.data.env).toEqual({});
        expect(result.data.headers).toEqual({});
        expect(result.data.tags).toEqual({});
      }
    });

    it('should reject instances without id', () => {
      const instance = {
        enabled: true
      };

      const result = ServerInstanceSchema.safeParse(instance);
      expect(result.success).toBe(false);
    });
  });

  describe('ServerTemplateSchema', () => {
    it('should validate a valid server template', () => {
      const template: ServerTemplate = {
        command: 'npx my-server',
        args: ['--config', 'default.json'],
        env: { LOG_LEVEL: 'info' },
        headers: {},
        type: 'stdio',
        timeout: 60000,
        aggregatedTools: ['tool1', 'tool2'],
        description: 'My MCP server template'
      };

      const result = ServerTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should use default values', () => {
      const template = {};

      const result = ServerTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('stdio');
        expect(result.data.timeout).toBe(60000);
        expect(result.data.args).toEqual([]);
        expect(result.data.env).toEqual({});
        expect(result.data.headers).toEqual({});
        expect(result.data.aggregatedTools).toEqual([]);
      }
    });
  });

  describe('ServerConfigSchema', () => {
    it('should validate a complete server configuration', () => {
      const serverConfig: ServerConfig = {
        template: {
          command: 'npx my-server',
          args: [],
          env: {},
          headers: {},
          type: 'stdio',
          timeout: 60000,
          aggregatedTools: []
        },
        instances: [
          {
            id: 'instance-1',
            enabled: true,
            args: [],
            env: {},
            headers: {},
            tags: { environment: 'dev' }
          },
          {
            id: 'instance-2',
            enabled: false,
            args: [],
            env: {},
            headers: {},
            tags: { environment: 'prod' }
          }
        ],
        tagDefinitions: [
          {
            key: 'environment',
            type: 'enum',
            values: ['dev', 'prod']
          }
        ]
      };

      const result = ServerConfigSchema.safeParse(serverConfig);
      expect(result.success).toBe(true);
    });

    it('should validate all instance selection strategies', () => {
      const strategies: ('random' | 'round-robin' | 'tag-match-unique')[] = [
        'random',
        'round-robin',
        'tag-match-unique'
      ];

      for (const strategy of strategies) {
        const serverConfig = {
          template: {
            command: 'npx my-server',
            instanceSelectionStrategy: strategy
          }
        };

        const result = ServerConfigSchema.safeParse(serverConfig);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.template.instanceSelectionStrategy).toBe(strategy);
        }
      }
    });

    it('should reject invalid instance selection strategies', () => {
      const serverConfig = {
        template: {
          command: 'npx my-server',
          instanceSelectionStrategy: 'invalid-strategy'
        }
      };

      const result = ServerConfigSchema.safeParse(serverConfig);
      expect(result.success).toBe(false);
    });

    it('should use defaults for empty instances and tagDefinitions', () => {
      const serverConfig = {
        template: {
          command: 'npx my-server'
        }
      };

      const result = ServerConfigSchema.safeParse(serverConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instances).toEqual([]);
        expect(result.data.tagDefinitions).toEqual([]);
        expect(result.data.template.instanceSelectionStrategy).toBeUndefined();
      }
    });
  });

  describe('Type Guards', () => {
    describe('isLegacyV1Config', () => {
      it('should recognize v1 config by version', () => {
        const config = {
          version: '1.0.0',
          servers: {}
        };

        expect(isLegacyV1Config(config)).toBe(true);
      });

      it('should not recognize v1.1 config', () => {
        const config = {
          version: '1.1.0',
          servers: {}
        };

        expect(isLegacyV1Config(config)).toBe(false);
      });

      it('should handle null/undefined', () => {
        expect(isLegacyV1Config(null)).toBe(false);
        expect(isLegacyV1Config(undefined)).toBe(false);
      });
    });
  });

  describe('SystemConfigSchema', () => {
    it('should validate a complete system configuration', () => {
      const config: SystemConfig = {
        version: '1.1.0',
        system: {
          host: 'localhost',
          port: 7788,
          language: 'zh',
          theme: 'system',
          logging: {
            level: 'info',
            rotationAge: '7d',
            jsonPretty: true,
            mcpCommDebug: false,
            apiDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          maxConnections: 50
        },
        servers: {},
        tagDefinitions: []
      };

      const result = SystemConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('ServerInstanceUpdateSchema (Regression Test)', () => {
    it('should NOT add default values when parsing empty object', () => {
      const updates = {};
      const result = ServerInstanceUpdateSchema.safeParse(updates);
      expect(result.success).toBe(true);
      if (result.success) {
        // Should NOT have default values - only the fields that were provided
        expect(result.data).toEqual({});
        expect(result.data.args).toBeUndefined();
        expect(result.data.env).toBeUndefined();
        expect(result.data.headers).toBeUndefined();
        expect(result.data.tags).toBeUndefined();
        expect(result.data.enabled).toBeUndefined();
      }
    });

    it('should preserve only the provided fields (displayName only)', () => {
      const updates = { displayName: 'My Updated Instance' };
      const result = ServerInstanceUpdateSchema.safeParse(updates);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBe('My Updated Instance');
        expect(result.data.args).toBeUndefined();
        expect(result.data.env).toBeUndefined();
        expect(result.data.headers).toBeUndefined();
        expect(result.data.tags).toBeUndefined();
      }
    });

    it('should preserve only the provided fields (env only)', () => {
      const updates = { env: { NEW_KEY: 'new-value' } };
      const result = ServerInstanceUpdateSchema.safeParse(updates);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.env).toEqual({ NEW_KEY: 'new-value' });
        expect(result.data.args).toBeUndefined();
        expect(result.data.headers).toBeUndefined();
        expect(result.data.tags).toBeUndefined();
        expect(result.data.displayName).toBeUndefined();
      }
    });

    it('should preserve only the provided fields (args only)', () => {
      const updates = { args: ['--new-arg'] };
      const result = ServerInstanceUpdateSchema.safeParse(updates);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.args).toEqual(['--new-arg']);
        expect(result.data.env).toBeUndefined();
        expect(result.data.headers).toBeUndefined();
        expect(result.data.tags).toBeUndefined();
      }
    });

    it('should work correctly with object merge (preventing regression)', () => {
      // Simulate the original instance with existing values
      const originalInstance: ServerInstance = {
        id: 'instance-1',
        enabled: true,
        args: ['--existing-arg'],
        env: { EXISTING_KEY: 'existing-value' },
        headers: { 'X-Existing': 'header' },
        tags: { existing: 'tag' }
      };

      // User only wants to update displayName
      const updates = { displayName: 'Updated Name' };
      const parsedUpdates = ServerInstanceUpdateSchema.parse(updates);

      // Merge should NOT overwrite existing env/args/headers/tags
      const mergedInstance = {
        ...originalInstance,
        ...parsedUpdates
      };

      // Verify existing fields are preserved
      expect(mergedInstance.args).toEqual(['--existing-arg']);
      expect(mergedInstance.env).toEqual({ EXISTING_KEY: 'existing-value' });
      expect(mergedInstance.headers).toEqual({ 'X-Existing': 'header' });
      expect(mergedInstance.tags).toEqual({ existing: 'tag' });
      expect(mergedInstance.displayName).toBe('Updated Name');
    });

    it('should work correctly when updating env without affecting args', () => {
      const originalInstance: ServerInstance = {
        id: 'instance-1',
        enabled: true,
        args: ['--keep-this'],
        env: { KEEP_THIS: 'value' },
        headers: {},
        tags: {}
      };

      const updates = { env: { NEW_KEY: 'new-value' } };
      const parsedUpdates = ServerInstanceUpdateSchema.parse(updates);

      const mergedInstance = {
        ...originalInstance,
        ...parsedUpdates
      };

      // args should still be preserved
      expect(mergedInstance.args).toEqual(['--keep-this']);
      // env should be updated
      expect(mergedInstance.env).toEqual({ NEW_KEY: 'new-value' });
    });

    it('should NOT fill in defaults when using ServerInstanceSchema.partial() [demonstrating the bug]', () => {
      // This test demonstrates the bug we're fixing
      const updates = { displayName: 'Test' };
      const result = ServerInstanceSchema.partial().safeParse(updates);
      expect(result.success).toBe(true);
      if (result.success) {
        // ServerInstanceSchema.partial() WILL add default values!
        // This is the bug - it adds args: [], env: {}, etc.
        expect(result.data.args).toEqual([]);
        expect(result.data.env).toEqual({});
        expect(result.data.headers).toEqual({});
        expect(result.data.tags).toEqual({});
      }
    });
  });
});
