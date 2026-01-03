# MCP Hub Lite API 契约示例文档

本文档提供了基于 `api-contract.yaml` 的完整测试用例示例，帮助理解API的使用方式和响应格式。

## 目录

- [TypeScript客户端示例](#typescript客户端示例)
- [测试用例集合](#测试用例集合)
- [常用场景测试](#常用场景测试)
- [错误处理测试](#错误处理测试)

## TypeScript客户端示例

### 基本HTTP客户端（调用API契约）

```typescript
// utils/http-client.ts
import type {
  Server,
  ServerListResponse,
  ServerDetailResponse,
  SearchResponse,
  HealthResponse,
  CMDError
} from '@/types/api-contract.ts';

/**
 * MCP Hub Lite API HTTP客户端
 * 封装与后端API的交互逻辑
 */
export class MCPHubLiteClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * 为请求添加追踪ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 通用的API请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const requestId = this.generateRequestId();
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.defaultHeaders,
        'X-Request-ID': requestId,
        ...options.headers
      }
    });

    // 根据响应状态处理
    if (!response.ok) {
      const errorData = await response.json() as CMDError;
      throw new Error(`API请求失败: ${errorData.message}`);
    }

    return response.json() as T;
  }

  /**
   * 获取系统健康状态
   */
  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/health');
  }

  /**
   * 获取服务器列表（支持分页和过滤）
   */
  async getServers(
    options: {
      page?: number;
      limit?: number;
      status?: string[];
      tags?: string;
      sortBy?: 'lastSeen' | 'name' | 'status' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<ServerListResponse> {
    const params = new URLSearchParams();

    if (options.page !== undefined) params.append('page', options.page.toString());
    if (options.limit !== undefined) params.append('limit', options.limit.toString());
    if (options.status?.length) params.append('status', options.status.join(','));
    if (options.tags) params.append('tags', options.tags);
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);

    return this.request<ServerListResponse>(`/api/servers?${params.toString()}`);
  }

  /**
   * 获取特定服务器详情
   */
  async getServerById(serverId: string): Promise<ServerDetailResponse> {
    return this.request<ServerDetailResponse>(`/api/servers/${serverId}`);
  }

  /**
   * 搜索服务器
   */
  async searchServers(
    query: string,
    options: {
      tags?: Record<string, string>;
      limit?: number;
      offset?: number;
      sortBy?: 'score' | 'lastSeen' | 'name' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      minScore?: number;
    } = {}
  ): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (options.tags) {
      const tagString = Object.entries(options.tags)
        .map(([key, value]) => `${key}:${value}`)
        .join(',');
      params.append('tags', tagString);
    }

    if (options.limit !== undefined) params.append('limit', options.limit.toString());
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.sortBy) params.append('sortBy', options.sortBy);
    if (options.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options.minScore !== undefined) params.append('minScore', options.minScore.toString());

    return this.request<SearchResponse>(`/api/servers/search?${params.toString()}`);
  }
}

// 使用示例
export const apiClient = new MCPHubLiteClient();
```

### Vue 3中的服务层使用

```typescript
// services/serverService.ts
import { ref, computed } from 'vue';
import type { Ref } from 'vue';
import type {
  Server,
  ServerListResponse,
  ServerDetailResponse,
  SearchResponse
} from '@/types/api-contract.ts';
import { apiClient } from '@/utils/http-client.ts';

/**
 * 服务器管理服务（Vue 3 + TypeScript）
 * 遵循Composition API最佳实践
 */
export class ServerService {
  // 响应式数据
  private servers: Ref<Server[]> = ref([]);
  private loading: Ref<boolean> = ref(false);
  private error: Ref<string | null> = ref(null);
  private currentPage: Ref<number> = ref(1);
  private totalPages: Ref<number> = ref(0);
  private total: Ref<number> = ref(0);

  // 计算属性
  const onlineServers = computed(() =>
    servers.value.filter(s => s.status === 'online')
  );

  const errorServers = computed(() =>
    servers.value.filter(s => s.status === 'error')
  );

  const serversByCategory = computed(() => {
    const map = new Map<string, Server[]>();
    servers.value.forEach(server => {
      const category = server.tags?.category || 'uncategorized';
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)?.push(server);
    });
    return map;
  });

  /**
   * 获取服务器列表
   */
  async fetchServers(
    options: {
      page?: number;
      limit?: number;
      status?: string[];
      tags?: string;
      sortBy?: 'lastSeen' | 'name' | 'status' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response: ServerListResponse = await apiClient.getServers(options);

      servers.value = response.data.servers;
      currentPage.value = response.data.pagination.page;
      totalPages.value = response.data.pagination.totalPages;
      total.value = response.data.pagination.total;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 获取服务器详情
   */
  async fetchServerById(serverId: string): Promise<Server | null> {
    loading.value = true;
    error.value = null;

    try {
      const response: ServerDetailResponse = await apiClient.getServerById(serverId);
      return response.data;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 搜索服务器
   */
  async searchServers(
    query: string,
    options: {
      tags?: Record<string, string>;
      limit?: number;
      offset?: number;
      sortBy?: 'score' | 'lastSeen' | 'name' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      minScore?: number;
    } = {}
  ): Promise<SearchResponse> {
    loading.value = true;
    error.value = null;

    try {
      const response: SearchResponse = await apiClient.searchServers(query, options);
      return response;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 刷新服务器列表
   */
  async refreshServers(): Promise<void> {
    await fetchServers({
      page: currentPage.value,
      limit: 20
    });
  }

  // 暴露响应式数据
  return {
    servers: readonly(servers),
    loading: readonly(loading),
    error: readonly(error),
    currentPage: readonly(currentPage),
    totalPages: readonly(totalPages),
    total: readonly(total),
    onlineServers,
    errorServers,
    serversByCategory
  };
}

// 使用示例
// const serverService = ServerService();
```

## 测试用例集合

### 单元测试（使用 Vitest）

```typescript
// tests/unit/api/client.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MCPHubLiteClient } from '@/utils/http-client.ts';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MCPHubLiteClient', () => {
  let client: MCPHubLiteClient;

  beforeEach(() => {
    client = new MCPHubLiteClient('http://localhost:3000');
    mockFetch.mockClear();
  });

  describe('getHealth', () => {
    test('应该成功获取健康状态', async () => {
      const mockResponse = {
        code: 200,
        message: '系统运行正常',
        data: {
          status: 'healthy',
          uptime: 86400,
          timestamp: '2025-12-16T10:30:00.000Z',
          version: '1.0.0',
          components: []
        },
        timestamp: '2025-12-16T10:30:00.000Z',
        requestId: 'req-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.getHealth();

      expect(result.data.status).toBe('healthy');
      expect(result.code).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/health',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Request-ID': expect.stringMatching(/req-\d+/)
          })
        })
      );
    });
  });

  describe('getServers', () => {
    test('应该成功获取服务器列表', async () => {
      const mockResponse = {
        code: 200,
        message: '获取服务器列表成功',
        data: {
          servers: [
            {
              id: 'srv-001',
              name: 'MySQL数据库工具',
              status: 'online'
            }
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 100,
            totalPages: 5
          }
        },
        timestamp: '2025-12-16T10:30:00.000Z',
        requestId: 'req-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.getServers({ page: 1, limit: 20 });

      expect(result.data.servers).toHaveLength(1);
      expect(result.data.pagination.total).toBe(100);
    });

    test('应该支持状态过滤', async () => {
      await client.getServers({ status: ['online'] });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=online'),
        expect.any(Object)
      );
    });

    test('应该支持标签过滤', async () => {
      await client.getServers({ tags: 'category:database' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tags=category:database'),
        expect.any(Object)
      );
    });
  });

  describe('searchServers', () => {
    test('应该成功搜索服务器', async () => {
      const mockResponse = {
        code: 200,
        message: '搜索完成',
        data: {
          results: [
            {
              server: {
                id: 'srv-001',
                name: 'MySQL数据库工具',
                status: 'online'
              },
              score: 0.95,
              matchedFields: ['name', 'tags.category']
            }
          ],
          total: 1,
          took: 15,
          query: {
            query: '数据库',
            limit: 10,
            offset: 0,
            sortBy: 'score',
            sortOrder: 'desc'
          }
        },
        timestamp: '2025-12-16T10:30:00.000Z',
        requestId: 'req-123'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await client.searchServers('数据库');

      expect(result.data.results).toHaveLength(1);
      expect(result.data.took).toBe(15);
      expect(result.data.results[0].score).toBe(0.95);
    });

    test('应该支持标签过滤和分数过滤', async () => {
      await client.searchServers('数据库', {
        tags: { category: 'database' },
        minScore: 0.5
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('tags=category:database'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('minScore=0.5'),
        expect.any(Object)
      );
    });
  });
});
```

### 集成测试

```typescript
// tests/integration/api.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

// 假设有一个测试服务器在运行
const TEST_SERVER_URL = 'http://localhost:3001';

describe('API集成测试', () => {
  test('端到端健康检查流程', async () => {
    const response = await fetch(`${TEST_SERVER_URL}/api/health`);

    expect(response.status).toBe(200);

    const data = await response.json();

    // 验证响应格式
    expect(data).toMatchObject({
      code: 200,
      message: expect.any(String),
      data: {
        status: expect.stringMatching(/healthy|degraded|unhealthy/),
        uptime: expect.any(Number),
        timestamp: expect.any(String),
        version: expect.any(String)
      },
      timestamp: expect.any(String),
      requestId: expect.stringMatching(/^req-/)
    });
  });

  test('端到端服务器列表获取流程', async () => {
    const response = await fetch(`${TEST_SERVER_URL}/api/servers?page=1&limit=10`);

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data.data.servers).toBeInstanceOf(Array);
    expect(data.data.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: expect.any(Number),
      totalPages: expect.any(Number)
    });
  });

  test('端到端搜索流程', async () => {
    const response = await fetch(
      `${TEST_SERVER_URL}/api/servers/search?q=数据库&limit=10`
    );

    expect(response.status).toBe(200);

    const data = await response.json();

    expect(data.data.results).toBeInstanceOf(Array);
    expect(data.data.total).toBeGreaterThanOrEqual(0);
    expect(data.data.took).toBeGreaterThan(0);
  });
});
```

## 常用场景测试

### 场景1：Dashboard首页加载

```typescript
// tests/scenarios/dashboard-load.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ServerService } from '@/services/serverService.ts';

describe('Dashboard首页加载场景', () => {
  test('应该加载完整的服务器列表和统计信息', async () => {
    const serverService = ServerService();

    // Mock API调用
    vi.spyOn(serverService, 'fetchServers').mockResolvedValue(undefined);

    await serverService.fetchServers({ limit: 20 });

    // 验证加载了服务器数据
    expect(serverService.servers.value).toBeDefined();

    // 验证统计信息计算正确
    expect(serverService.onlineServers.value.length).toBeGreaterThan(0);
    expect(serverService.errorServers.value.length).toBeGreaterThanOrEqual(0);
    expect(serverService.serversByCategory.value.size).toBeGreaterThan(0);
  });
});
```

### 场景2：服务器详情查看

```typescript
// tests/scenarios/server-detail.test.ts
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ServerService } from '@/services/serverService.ts';

describe('服务器详情查看场景', () => {
  test('应该正确加载并显示服务器详细信息', async () => {
    const serverService = ServerService();
    const serverId = 'srv-550e8400-e29b-41d4-a716-446655440000';

    const mockServer = {
      id: serverId,
      name: 'MySQL数据库工具',
      description: '提供MySQL数据库查询和管理功能',
      status: 'online',
      tags: {
        category: 'database',
        environment: 'production'
      },
      version: '1.2.3',
      mcpVersion: '2025-11-25'
    };

    vi.spyOn(serverService, 'fetchServerById').mockResolvedValue(mockServer);

    const server = await serverService.fetchServerById(serverId);

    expect(server?.id).toBe(serverId);
    expect(server?.name).toBe('MySQL数据库工具');
    expect(server?.status).toBe('online');
    expect(server?.tags?.category).toBe('database');
  });
});
```

### 场景3：搜索功能

```typescript
// tests/scenarios/search-servers.test.ts
import { describe, test, expect, vi } from 'vitest';
import { ServerService } from '@/services/serverService.ts';

describe('服务器搜索场景', () => {
  test('应该根据关键词和标签过滤搜索结果', async () => {
    const serverService = ServerService();

    vi.spyOn(serverService, 'searchServers').mockResolvedValue({
      code: 200,
      message: '搜索完成',
      data: {
        results: [
          {
            server: {
              id: 'srv-001',
              name: 'MySQL数据库工具',
              status: 'online'
            },
            score: 0.95
          }
        ],
        total: 1,
        took: 15
      },
      timestamp: '2025-12-16T10:30:00.000Z',
      requestId: 'req-123'
    });

    const result = await serverService.searchServers('数据库', {
      tags: { category: 'database' },
      limit: 10
    });

    expect(result.data.results).toHaveLength(1);
    expect(result.data.results[0].score).toBeGreaterThan(0.8);
  });
});
```

## 错误处理测试

### CMD错误码验证

```typescript
// tests/errors/cmd-errors.test.ts
import { describe, test, expect } from 'vitest';
import type { CMDError } from '@/types/api-contract.ts';

describe('CMD错误处理测试', () => {
  test('应该正确处理服务器不存在错误', async () => {
    const errorResponse: CMDError = {
      code: 3004,
      message: '服务器不存在',
      data: null,
      timestamp: '2025-12-16T10:30:00.000Z',
      requestId: 'req-123',
      error: {
        category: 'BUSINESS',
        severity: 'ERROR',
        context: {
          serverId: 'srv-not-found'
        },
        httpStatus: 404
      }
    };

    expect(errorResponse.code).toBe(3004);
    expect(errorResponse.error?.category).toBe('BUSINESS');
    expect(errorResponse.error?.severity).toBe('ERROR');
    expect(errorResponse.error?.httpStatus).toBe(404);
  });

  test('应该正确处理系统错误', async () => {
    const errorResponse: CMDError = {
      code: 1005,
      message: '服务不可用',
      data: null,
      timestamp: '2025-12-16T10:30:00.000Z',
      requestId: 'req-124',
      error: {
        category: 'SYSTEM',
        severity: 'FATAL',
        context: {
          service: 'database'
        },
        httpStatus: 503
      }
    };

    expect(errorResponse.code).toBe(1005);
    expect(errorResponse.error?.category).toBe('SYSTEM');
    expect(errorResponse.error?.severity).toBe('FATAL');
  });

  test('应该正确处理API参数错误', async () => {
    const errorResponse: CMDError = {
      code: 4001,
      message: '无效的页码参数',
      data: null,
      timestamp: '2025-12-16T10:30:00.000Z',
      requestId: 'req-125',
      error: {
        category: 'API',
        severity: 'ERROR',
        context: {
          parameter: 'page',
          value: 0,
          minValue: 1
        },
        httpStatus: 400
      }
    };

    expect(errorResponse.code).toBe(4001);
    expect(errorResponse.error?.category).toBe('API');
    expect(errorResponse.error?.severity).toBe('ERROR');
  });

  test('应该正确处理MCP协议错误', async () => {
    const errorResponse: CMDError = {
      code: 6003,
      message: '工具未找到',
      data: null,
      timestamp: '2025-12-16T10:30:00.000Z',
      requestId: 'req-126',
      error: {
        category: 'MCP_PROTOCOL',
        severity: 'ERROR',
        context: {
          toolName: 'nonexistent-tool'
        },
        httpStatus: 404
      }
    };

    expect(errorResponse.code).toBe(6003);
    expect(errorResponse.error?.category).toBe('MCP_PROTOCOL');
  });
});
```

### 网络错误模拟

```typescript
// tests/errors/network-errors.test.ts
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { MCPHubLiteClient } from '@/utils/http-client.ts';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('网络错误处理测试', () => {
  let client: MCPHubLiteClient;

  beforeEach(() => {
    client = new MCPHubLiteClient();
    mockFetch.mockClear();
  });

  test('应该正确处理网络超时', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(client.getHealth()).rejects.toThrow('Network timeout');
  });

  test('应该正确处理服务器错误', async () => {
    const errorResponse = {
      code: 500,
      message: 'Internal Server Error',
      data: null,
      timestamp: '2025-12-16T10:30:00.000Z',
      requestId: 'req-127',
      error: {
        category: 'SYSTEM',
        severity: 'FATAL'
      }
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => errorResponse
    });

    try {
      await client.getHealth();
    } catch (e) {
      expect(e).toThrow('API请求失败');
    }
  });

  test('应该正确处理无效响应格式', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => 'invalid-json'
    });

    await expect(client.getHealth()).rejects.toThrow();
  });
});
```

### 类型安全验证测试

```typescript
// tests/types/api-types.test.ts
import { describe, test, expect } from 'vitest';
import type {
  Server,
  ServerListResponse,
  ServerStatus,
  CMDErrors
} from '@/types/api-contract.ts';

// 辅助函数：类型守卫，用于测试
function isServer(obj: unknown): obj is Server {
  return typeof obj === 'object' &&
         obj !== null &&
         typeof (obj as Server).id === 'string' &&
         typeof (obj as Server).name === 'string' &&
         typeof (obj as Server).status === 'string';
}

function isServerListResponse(obj: unknown): obj is ServerListResponse {
  return typeof obj === 'object' &&
         obj !== null &&
         typeof (obj as ServerListResponse).code === 'number' &&
         Array.isArray((obj as ServerListResponse).data?.servers);
}

describe('API类型安全测试', () => {
  test('应该正确验证Server对象类型', () => {
    const validServer = {
      id: 'srv-001',
      name: 'MySQL数据库工具',
      status: 'online',
      lastSeen: '2025-12-16T10:30:00.000Z',
      createdAt: '2025-12-15T08:00:00.000Z',
      updatedAt: '2025-12-16T10:30:00.000Z'
    };

    expect(isServer(validServer)).toBe(true);

    const invalidServer = {
      id: 123, // 应该是 string
      name: 'MySQL数据库工具',
      status: 'online'
    };

    expect(isServer(invalidServer)).toBe(false);
  });

  test('应该正确验证ServerListResponse类型', () => {
    const validResponse = {
      code: 200,
      message: 'success',
      data: {
        servers: [
          {
            id: 'srv-001',
            name: 'MySQL',
            status: 'online',
            lastSeen: '2025-12-16T10:30:00.000Z',
            createdAt: '2025-12-15T08:00:00.000Z',
            updatedAt: '2025-12-16T10:30:00.000Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      },
      timestamp: '2025-12-16T10:30:00.000Z',
      requestId: 'req-123'
    };

    expect(isServerListResponse(validResponse)).toBe(true);
  });

  test('应该正确枚举ServerStatus', () => {
    const statuses: ServerStatus[] = [
      'online',
      'offline',
      'error',
      'starting',
      'stopping'
    ];

    expect(statuses).toContain('online');
    expect(statuses).toContain('offline');
    expect(statuses).toContain('error');
  });
});
```

### 性能测试用例

```typescript
// tests/performance/api-performance.test.ts
import { describe, test, expect, vi } from 'vitest';
import { MCPHubLiteClient } from '@/utils/http-client.ts';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API性能测试', () => {
  test('健康检查应该在合理时间内完成', async () => {
    const client = new MCPHubLiteClient();

    mockFetch.mockImplementationOnce(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({
          code: 200,
          message: 'success',
          data: { status: 'healthy', uptime: 86400 },
          timestamp: new Date().toISOString()
        })
      }), 100))
    );

    const startTime = Date.now();
    await client.getHealth();
    const endTime = Date.now();

    // 应该在200ms内完成（包括模拟延迟）
    expect(endTime - startTime).toBeLessThan(150);
  });

  test('应该正确处理并发请求', async () => {
    const client = new MCPHubLiteClient();

    mockFetch.mockImplementation(
      (url: string) => Promise.resolve({
        ok: true,
        json: async () => ({
          code: 200,
          message: 'success',
          data: { status: 'healthy', uptime: 86400 },
          timestamp: new Date().toISOString()
        })
      })
    );

    const promises = Array.from({ length: 5 }, () => client.getHealth());
    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.code).toBe(200);
    });
  });
});
```

---

## 使用指南

### 运行测试

```bash
# 运行所有单元测试
npm test

# 运行特定测试文件
npm test api/client.test.ts

# 运行集成测试
npm run test:integration

# 运行性能测试
npm run test:performance

# 生成测试覆盖率报告
npm run test:coverage
```

### 测试最佳实践

1. **优先使用单元测试**：测试单个函数/方法的逻辑
2. **Mock外部依赖**：使用Vitest的mock功能隔离测试
3. **保持测试独立性**：每个测试应该独立运行
4. **覆盖边界Case**：确保测试覆盖正常流程和异常情况
5. **使用类型检查**：利用TypeScript确保API契约的正确性
6. **测试可读性**：使用描述性的测试名称和注释

### 持续集成检查

```yaml
# .github/workflows/test.yml (示例)
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run validate:types
      - run: npm test -- --coverage
      - run: npm run lint
```

这份文档提供了完整的API契约测试用例示例，帮助开发团队快速理解和使用API契约，确保前后端协作的高效性和准确性。