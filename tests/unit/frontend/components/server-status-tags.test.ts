import { describe, test, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ServerStatusTags from '@frontend/components/ServerStatusTags.vue';

// Mock i18n plugin
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));

describe('ServerStatusTags', () => {
  const mockServer = {
    id: 'test-server',
    name: 'Test Server',
    status: 'online' as const,
    version: '1.0.0',
    pid: 12345,
    config: {
      type: 'stdio' as const,
      command: 'npm run start',
      args: ['--port', '3000']
    },
    startTime: Date.now() - 1000 * 60 * 5 // 5 minutes ago
  };

  test('renders server status tags correctly', () => {
    const wrapper = mount(ServerStatusTags, {
      props: {
        server: mockServer
      },
      global: {
        stubs: {
          'el-tag': true
        }
      }
    });

    // Check that component renders without errors
    expect(wrapper.exists()).toBe(true);
  });

  test('handles different server statuses', () => {
    const statuses = ['online', 'offline', 'error', 'starting', 'stopping'] as const;

    for (const status of statuses) {
      const wrapper = mount(ServerStatusTags, {
        props: {
          server: {
            ...mockServer,
            status
          }
        },
        global: {
          stubs: {
            'el-tag': true
          }
        }
      });

      expect(wrapper.exists()).toBe(true);
    }
  });
});
