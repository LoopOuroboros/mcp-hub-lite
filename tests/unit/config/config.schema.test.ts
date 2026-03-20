import { describe, it, expect } from 'vitest';
import {
  TagDefinitionSchema,
  ServerInstanceSchema,
  ServerTemplateSchema,
  ServerConfigV1_1Schema,
  SystemConfigV1Schema,
  isV1Config,
  isV1_1Config,
  type TagDefinition,
  type ServerInstance,
  type ServerTemplate,
  type ServerConfigV1_1,
  type SystemConfigV1
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
        type: 'stdio',
        timeout: 60000,
        allowedTools: ['tool1', 'tool2'],
        description: 'My MCP server template',
        tags: { vendor: 'acme' }
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
        expect(result.data.allowedTools).toEqual([]);
        expect(result.data.tags).toEqual({});
      }
    });
  });

  describe('ServerConfigV1_1Schema', () => {
    it('should validate a complete server configuration', () => {
      const serverConfig: ServerConfigV1_1 = {
        template: {
          command: 'npx my-server',
          args: [],
          type: 'stdio',
          timeout: 60000,
          allowedTools: [],
          tags: {}
        },
        instances: [
          {
            id: 'instance-1',
            enabled: true,
            args: [],
            tags: { environment: 'dev' }
          },
          {
            id: 'instance-2',
            enabled: false,
            args: [],
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

      const result = ServerConfigV1_1Schema.safeParse(serverConfig);
      expect(result.success).toBe(true);
    });

    it('should use defaults for empty instances and tagDefinitions', () => {
      const serverConfig = {
        template: {
          command: 'npx my-server'
        }
      };

      const result = ServerConfigV1_1Schema.safeParse(serverConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.instances).toEqual([]);
        expect(result.data.tagDefinitions).toEqual([]);
      }
    });
  });

  describe('Type Guards', () => {
    describe('isV1Config', () => {
      it('should recognize v1 config by version', () => {
        const config = {
          version: '1.0.0',
          servers: {}
        };

        expect(isV1Config(config)).toBe(true);
      });

      it('should not recognize v1.1 config', () => {
        const config = {
          version: '1.1.0',
          servers: {}
        };

        expect(isV1Config(config)).toBe(false);
      });

      it('should handle null/undefined', () => {
        expect(isV1Config(null)).toBe(false);
        expect(isV1Config(undefined)).toBe(false);
      });
    });

    describe('isV1_1Config', () => {
      it('should recognize v1.1 config by version', () => {
        const config = {
          version: '1.1.0',
          servers: {}
        };

        expect(isV1_1Config(config)).toBe(true);
      });

      it('should not recognize v1 config', () => {
        const config = {
          version: '1.0.0',
          servers: {}
        };

        expect(isV1_1Config(config)).toBe(false);
      });

      it('should handle null/undefined', () => {
        expect(isV1_1Config(null)).toBe(false);
        expect(isV1_1Config(undefined)).toBe(false);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should validate v1.0 config with SystemConfigV1Schema', () => {
      const v1Config: SystemConfigV1 = {
        version: '1.0.0',
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
            sessionDebug: false
          }
        },
        security: {
          allowedNetworks: ['127.0.0.1'],
          maxConcurrentConnections: 50,
          connectionTimeout: 30000,
          idleConnectionTimeout: 300000,
          sessionTimeout: 1800000,
          sessionFlushInterval: 900000,
          maxConnections: 50
        },
        servers: {
          'my-server': {
            command: 'npx my-server',
            args: [],
            enabled: true,
            type: 'stdio',
            timeout: 60000,
            allowedTools: []
          }
        },
        tagDefinitions: []
      };

      const result = SystemConfigV1Schema.safeParse(v1Config);
      expect(result.success).toBe(true);
    });
  });
});
