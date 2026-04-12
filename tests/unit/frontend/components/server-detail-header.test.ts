import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ServerDetailHeader from '@frontend/components/ServerDetailHeader.vue';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));

describe('ServerDetailHeader', () => {
  it('显示聚合实例的正确操作数量', () => {
    const wrapper = mount(ServerDetailHeader, {
      props: {
        server: {
          id: 'server-1',
          name: 'mcp-test',
          status: 'online',
          type: 'local',
          config: {
            type: 'stdio',
            command: 'npm'
          },
          logs: [],
          instances: [
            { id: 'instance-1', timestamp: 1, index: 0, status: 'online' },
            { id: 'instance-2', timestamp: 2, index: 1, status: 'online' },
            { id: 'instance-3', timestamp: 3, index: 2, status: 'online' }
          ],
          rawV11Config: {
            template: {
              type: 'stdio',
              args: []
            },
            instances: [
              { id: 'instance-1', timestamp: 1, index: 0 },
              { id: 'instance-2', timestamp: 2, index: 1 },
              { id: 'instance-3', timestamp: 3, index: 2 }
            ]
          }
        }
      },
      global: {
        stubs: {
          ServerStatusTags: true,
          'el-button': {
            template: '<button><slot /></button>'
          },
          'el-tag': {
            template: '<span><slot /></span>'
          }
        }
      }
    });

    const text = wrapper.text();

    expect(text).toContain('action.restartAll (3)');
    expect(text).toContain('action.stopAll (3)');
  });
});
