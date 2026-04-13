import { describe, it, expect } from 'vitest';
import { InstanceSelector } from '@services/hub-tools/instance-selector.js';
import type { ServerConfig, ServerInstance } from '@shared-models/server.model.js';

describe('InstanceSelector', () => {
  const baseTemplate = {
    type: 'stdio' as const,
    command: 'test-command',
    args: [],
    env: {},
    headers: {},
    timeout: 60000,
    aggregatedTools: []
  };

  const baseInstance: Omit<ServerInstance, 'id' | 'index'> = {
    enabled: true,
    args: [],
    env: {},
    headers: {},
    tags: {}
  };

  describe('random strategy', () => {
    it('should select random instance from enabled instances', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'random'
        },
        instances: [
          { ...baseInstance, id: '1', index: 0, enabled: true },
          { ...baseInstance, id: '2', index: 1, enabled: true },
          { ...baseInstance, id: '3', index: 2, enabled: false }
        ],
        tagDefinitions: []
      };

      const selected = InstanceSelector.selectInstance('test-server', config);
      expect(selected).toBeDefined();
      expect(['1', '2']).toContain(selected!.id);
    });

    it('should return undefined when no enabled instances', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'random'
        },
        instances: [
          { ...baseInstance, id: '1', index: 0, enabled: false },
          { ...baseInstance, id: '2', index: 1, enabled: false }
        ],
        tagDefinitions: []
      };

      const selected = InstanceSelector.selectInstance('test-server', config);
      expect(selected).toBeUndefined();
    });
  });

  describe('round-robin strategy', () => {
    it('should cycle through enabled instances', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'round-robin'
        },
        instances: [
          { ...baseInstance, id: '1', index: 0, enabled: true },
          { ...baseInstance, id: '2', index: 1, enabled: true },
          { ...baseInstance, id: '3', index: 2, enabled: true }
        ],
        tagDefinitions: []
      };

      const selected1 = InstanceSelector.selectInstance('test-server-rr', config);
      const selected2 = InstanceSelector.selectInstance('test-server-rr', config);
      const selected3 = InstanceSelector.selectInstance('test-server-rr', config);
      const selected4 = InstanceSelector.selectInstance('test-server-rr', config);

      expect(selected1!.id).toBe('1');
      expect(selected2!.id).toBe('2');
      expect(selected3!.id).toBe('3');
      expect(selected4!.id).toBe('1');
    });
  });

  describe('tag-match-unique strategy', () => {
    it('should select instance that uniquely matches tags', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'tag-match-unique'
        },
        instances: [
          { ...baseInstance, id: '1', index: 0, tags: { env: 'dev', region: 'us' } },
          { ...baseInstance, id: '2', index: 1, tags: { env: 'prod', region: 'us' } },
          { ...baseInstance, id: '3', index: 2, tags: { env: 'prod', region: 'eu' } }
        ],
        tagDefinitions: []
      };

      const selected = InstanceSelector.selectInstance('test-server', config, {
        tags: { env: 'prod', region: 'us' }
      });

      expect(selected).toBeDefined();
      expect(selected!.id).toBe('2');
    });

    it('should throw error when no instance matches tags', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'tag-match-unique'
        },
        instances: [
          { ...baseInstance, id: '1', index: 0, tags: { env: 'dev' } },
          { ...baseInstance, id: '2', index: 1, tags: { env: 'prod' } }
        ],
        tagDefinitions: []
      };

      expect(() => {
        InstanceSelector.selectInstance('test-server', config, {
          tags: { env: 'staging' }
        });
      }).toThrow('No instance found matching tags');
    });

    it('should throw error when multiple instances match tags', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'tag-match-unique'
        },
        instances: [
          { ...baseInstance, id: '1', index: 0, tags: { env: 'prod' } },
          { ...baseInstance, id: '2', index: 1, tags: { env: 'prod' } }
        ],
        tagDefinitions: []
      };

      expect(() => {
        InstanceSelector.selectInstance('test-server', config, {
          tags: { env: 'prod' }
        });
      }).toThrow('Multiple instances match tags');
    });

    it('should return the single instance when no tags provided and only one instance exists', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'tag-match-unique'
        },
        instances: [{ ...baseInstance, id: '1', index: 0 }],
        tagDefinitions: []
      };

      const selected = InstanceSelector.selectInstance('test-server', config);
      expect(selected).toBeDefined();
      expect(selected!.id).toBe('1');
    });

    it('should throw error when no tags provided with multiple instances', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'tag-match-unique'
        },
        instances: [
          { ...baseInstance, id: '1', index: 0 },
          { ...baseInstance, id: '2', index: 1 }
        ],
        tagDefinitions: []
      };

      expect(() => {
        InstanceSelector.selectInstance('test-server', config);
      }).toThrow(
        'No tags provided for tag-match-unique strategy with 2 instances. Expected exactly one instance or specific tags for unique selection.'
      );
    });
  });

  describe('single instance', () => {
    it('should return the single instance regardless of strategy', () => {
      const config: ServerConfig = {
        template: {
          ...baseTemplate,
          instanceSelectionStrategy: 'round-robin'
        },
        instances: [{ ...baseInstance, id: '1', index: 0 }],
        tagDefinitions: []
      };

      const selected = InstanceSelector.selectInstance('test-server', config);
      expect(selected).toBeDefined();
      expect(selected!.id).toBe('1');
    });
  });

  describe('default strategy', () => {
    it('should use random strategy when no strategy specified', () => {
      const config: ServerConfig = {
        template: baseTemplate,
        instances: [
          { ...baseInstance, id: '1', index: 0 },
          { ...baseInstance, id: '2', index: 1 }
        ],
        tagDefinitions: []
        // No instanceSelectionStrategy field
      };

      const selected = InstanceSelector.selectInstance('test-server', config);
      expect(selected).toBeDefined();
      expect(['1', '2']).toContain(selected!.id);
    });
  });
});
