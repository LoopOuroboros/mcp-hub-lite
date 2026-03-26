import { describe, test, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ServerStatusTags from '@frontend/components/ServerStatusTags.vue';
import i18n from '@frontend/i18n/index';

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
        plugins: [i18n]
      }
    });

    // Check status badge
    expect(wrapper.text()).toContain('online');

    // Check transport info
    expect(wrapper.text()).toContain('stdio');
    expect(wrapper.text()).toContain('npm run start');
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
          plugins: [i18n]
        }
      });

      const statusText = `serverDetail.status.${status}`;
      expect(wrapper.text()).toContain(statusText);
    }
  });

  test('handles different transport types', () => {
    // Test stdio
    const stdioWrapper = mount(ServerStatusTags, {
      props: {
        server: mockServer
      },
      global: {
        plugins: [i18n]
      }
    });
    expect(stdioWrapper.text()).toContain('stdio');
    expect(stdioWrapper.text()).toContain('npm run start');

    // Test sse
    const sseServer = {
      ...mockServer,
      config: {
        type: 'sse' as const,
        url: 'http://localhost:8080/mcp'
      }
    };
    const sseWrapper = mount(ServerStatusTags, {
      props: {
        server: sseServer
      },
      global: {
        plugins: [i18n]
      }
    });
    expect(sseWrapper.text()).toContain('sse');
    expect(sseWrapper.text()).toContain('http://localhost:8080/mcp');

    // Test streamable-http
    const httpServer = {
      ...mockServer,
      config: {
        type: 'streamable-http' as const,
        url: 'http://localhost:9000/mcp'
      }
    };
    const httpWrapper = mount(ServerStatusTags, {
      props: {
        server: httpServer
      },
      global: {
        plugins: [i18n]
      }
    });
    expect(httpWrapper.text()).toContain('streamable-http');
    expect(httpWrapper.text()).not.toContain('http://localhost:9000/mcp'); // No URL shown for streamable-http
  });

  test('handles missing version and PID', () => {
    const serverWithoutVersion = {
      ...mockServer,
      version: undefined,
      pid: undefined,
      config: {
        type: 'sse' as const,
        url: 'http://localhost:8080/mcp'
      }
    };

    const wrapper = mount(ServerStatusTags, {
      props: {
        server: serverWithoutVersion
      },
      global: {
        plugins: [i18n]
      }
    });

    expect(wrapper.text()).not.toContain('1.0.0');
    expect(wrapper.text()).not.toContain('12345');
  });
});
