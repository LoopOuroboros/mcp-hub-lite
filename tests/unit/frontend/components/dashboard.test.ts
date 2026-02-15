import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Dashboard from '@frontend/components/DashboardView.vue';
import { createPinia, setActivePinia } from 'pinia';

// Mock the stores
const mockServerStore = {
  servers: [],
  loading: false,
  stats: {
    total: 0,
    running: 0,
    errors: 0
  },
  fetchAllLogs: vi.fn()
};

vi.mock('@frontend/stores/server', () => ({
  useServerStore: () => mockServerStore
}));

vi.mock('@frontend/stores/websocket', () => ({
  useWebSocketStore: () => ({})
}));

// Mock Element Plus components
const mockElSkeleton = { template: '<div class="el-skeleton"><slot /></div>' };
const mockElSkeletonItem = { template: '<div class="el-skeleton-item"><slot /></div>' };
const mockElIcon = { template: '<div class="el-icon"><slot /></div>' };

describe('Dashboard Component', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  it('should render title correctly', () => {
    const wrapper = mount(Dashboard, {
      global: {
        components: {
          ElSkeleton: mockElSkeleton,
          ElSkeletonItem: mockElSkeletonItem,
          ElIcon: mockElIcon
        }
      }
    });
    expect(wrapper.text()).toContain('dashboard.title');
  });

  it('should show loading skeleton when loading and no servers', () => {
    mockServerStore.loading = true;
    mockServerStore.servers = [];

    const wrapper = mount(Dashboard, {
      global: {
        components: {
          ElSkeleton: mockElSkeleton,
          ElSkeletonItem: mockElSkeletonItem,
          ElIcon: mockElIcon
        }
      }
    });
    expect(wrapper.find('.el-skeleton').exists()).toBe(true);
  });

  it('should show stats cards when not loading', () => {
    mockServerStore.loading = false;
    mockServerStore.servers = [
      {
        id: '1',
        name: 'test-server',
        status: 'running',
        type: 'local',
        config: { type: 'stdio' },
        instance: { id: '1', timestamp: 1234567890, hash: 'abc123' },
        logs: []
      }
    ];
    mockServerStore.stats = {
      total: 1,
      running: 1,
      errors: 0
    };

    const wrapper = mount(Dashboard, {
      global: {
        components: {
          ElSkeleton: mockElSkeleton,
          ElSkeletonItem: mockElSkeletonItem,
          ElIcon: mockElIcon
        }
      }
    });
    expect(wrapper.find('.stat-card').exists()).toBe(true);
    expect(wrapper.text()).toContain('1');
  });

  it('should show recent activity section', () => {
    mockServerStore.loading = false;
    mockServerStore.servers = [
      {
        id: '1',
        name: 'test-server',
        status: 'running',
        type: 'local',
        config: { type: 'stdio' },
        instance: { id: '1', timestamp: 1234567890, hash: 'abc123' },
        logs: [{ timestamp: 1234567890, level: 'info', message: 'Test log message' }]
      }
    ];
    mockServerStore.stats = {
      total: 1,
      running: 1,
      errors: 0
    };

    const wrapper = mount(Dashboard, {
      global: {
        components: {
          ElSkeleton: mockElSkeleton,
          ElSkeletonItem: mockElSkeletonItem,
          ElIcon: mockElIcon
        }
      }
    });
    expect(wrapper.text()).toContain('dashboard.recentActivity');
    expect(wrapper.text()).toContain('Test log message');
  });

  it('should show "No recent activity" when no logs', () => {
    mockServerStore.loading = false;
    mockServerStore.servers = [
      {
        id: '1',
        name: 'test-server',
        status: 'running',
        type: 'local',
        config: { type: 'stdio' },
        instance: { id: '1', timestamp: 1234567890, hash: 'abc123' },
        logs: []
      }
    ];
    mockServerStore.stats = {
      total: 1,
      running: 1,
      errors: 0
    };

    const wrapper = mount(Dashboard, {
      global: {
        components: {
          ElSkeleton: mockElSkeleton,
          ElSkeletonItem: mockElSkeletonItem,
          ElIcon: mockElIcon
        }
      }
    });
    expect(wrapper.text()).toContain('No recent activity');
  });
});
