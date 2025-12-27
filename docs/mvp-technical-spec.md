# MCP Hub Lite MVP 技术规范文档
## 第一里程碑：前端-API集成

**版本**：v1.0.0

**创建日期**：2025-12-16

**作者**：MCP Hub Lite 开发团队

---

## 目录

1. [MVP 定义与范围](#1-mvp-定义与范围)
2. [技术架构](#2-技术架构)
3. [API 设计规范](#3-api-设计规范)
4. [组件设计](#4-组件设计)
5. [数据模型](#5-数据模型)
6. [测试策略](#6-测试策略)
7. [实施计划](#7-实施计划)
8. [部署和交付](#8-部署和交付)

---

## 1. MVP 定义与范围

### 1.1 MVP 目标

MVP（最小可工作系统）是 MCP Hub Lite 的第一阶段实现，重点验证前后端集成及核心服务器管理功能。该阶段将创建基础但完整的系统，能够执行基本的 MCP 服务器生命周期管理操作。

### 1.2 核心功能（必须包含）

#### 1.2.1 服务器管理
- **服务器列表查看**：显示所有配置的 MCP 服务器
- **服务器详情查看**：查看单个服务器的基本信息
- **服务器添加**：通过配置文件添加新服务器
- **服务器状态监控**：显示服务器在线/离线状态
- **服务器搜索**：根据名称、标签筛选服务器

#### 1.2.2 基础界面
- **服务器列表页**：展示服务器基本信息表格
- **搜索栏**：实时搜索和过滤服务器
- **响应式布局**：适配桌面和平板设备

#### 1.2.3 后端 API
- **GET /api/servers**：获取服务器列表
- **GET /api/servers/:id**：获取单个服务器详情
- **POST /api/servers**：添加新服务器（通过配置）
- **GET /api/servers/search**：根据条件搜索服务器
- **GET /api/health**：健康检查接口

### 1.3 可延后功能

以下功能将在后续里程碑中实现：
- ❌ **服务器启动/停止控制**（移至第二里程碑）
- ❌ **服务器分组管理**（移至第二里程碑）
- ❌ **性能监控仪表板**（移至第三里程碑）
- ❌ **服务器日志查看**（移至第二里程碑）
- ❌ **高级配置管理 UI**（移至第二里程碑）
- ❌ **用户认证和授权**（移至第四里程碑）
- ❌ **批量操作**（移至第二里程碑）

### 1.4 明确排除功能

以下功能超出 MVP 范围：
- ❌ **MCP 协议转发**：第一里程碑不使用真实 MCP 协议
- ❌ **工具调用功能**：仅显示服务器列表，不执行工具调用
- ❌ **多语言支持**：仅支持中文界面
- ❌ **插件系统**：第一里程碑不包含扩展机制
- ❌ **服务端渲染 (SSR)**：仅使用客户端渲染
- ❌ **PWA 离线支持**：第一里程碑不使用 Service Worker

### 1.5 MVP 验收标准

系统必须满足以下标准才能通过验收：

#### 功能标准
- [x] 用户可以查看所有配置的服务器列表
- [x] 用户可以通过搜索栏筛选服务器
- [x] 用户可以查看单个服务器的详细信息
- [x] 系统显示服务器当前状态（在线/离线/错误）
- [x] 所有 API 响应时间 < 500ms
- [x] 前端页面加载时间 < 2 秒

#### 质量标准
- [x] TypeScript 编译无错误
- [x] 代码覆盖率 ≥ 90%
- [x] 所有单元测试通过
- [x] 所有集成测试通过
- [x] 无内存泄漏
- [x] 响应式设计支持 1024px+ 屏幕

---

## 2. 技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端层 (Frontend)                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ ServerList.vue  │  │   SearchBox.vue │  │  Header.vue    ││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Pinia 状态管理                              ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │              API 客户端层                                ││
│  │         (fetchServerList, fetchServer)                  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                      HTTP/JSON
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      后端层 (Backend)                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Fastify 服务器                              ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌──────────────┐ ││
│  │  │ ServerRoutes  │  │ SearchRoutes  │  │ HealthRoutes │ ││
│  │  └───────────────┘  └───────────────┘  └──────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │              服务层 (Services)                           ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ ││
│  │  │ServerService │  │SearchService │  │HealthService  │ ││
│  │  └──────────────┘  └──────────────┘  └───────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │              数据层 (Data Layer)                         ││
│  │              .mcp-hub.json 配置文件                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 2.2 前端架构

#### 技术栈
- **框架**：[Vue 3.4.21](https://vuejs.org/) - 使用 `<script setup>` 语法
- **语言**：[TypeScript 5.3.3](https://www.typescriptlang.org/)
- **构建工具**：[Vite 5.1.6](https://vitejs.dev/)
- **UI 库**：[Element Plus 2.6.3](https://element-plus.org/)
- **状态管理**：[Pinia 2.x](https://pinia.vuejs.org/)
- **HTTP 客户端**：[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) (原生)

#### 目录结构

```
frontend/
├── src/
│   ├── components/           # 可复用组件
│   │   ├── ServerList/       # 服务器列表组件
│   │   ├── SearchBox/        # 搜索框组件
│   │   └── Header/           # 头部导航组件
│   ├── views/                # 页面视图
│   │   └── ServerPage.vue    # 服务器主页面
│   ├── stores/               # Pinia 状态管理
│   │   ├── serverStore.ts    # 服务器状态
│   │   └── index.ts          # store 入口
│   ├── api/                  # API 客户端
│   │   ├── http.ts           # HTTP 基础配置
│   │   ├── serverApi.ts      # 服务器 API
│   │   └── types.ts          # API 类型定义
│   ├── types/                # TypeScript 类型
│   │   ├── server.ts         # 服务器类型
│   │   ├── api.ts            # API 类型
│   │   └── index.ts          # 类型入口
│   ├── utils/                # 工具函数
│   │   ├── formatters.ts     # 格式化函数
│   │   └── validators.ts     # 验证函数
│   ├── App.vue               # 根组件
│   └── main.ts               # 应用入口
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```

### 2.3 后端架构

#### 技术栈
- **框架**：[Fastify 4.28.1](https://www.fastify.io/)
- **语言**：[TypeScript 5.3.3](https://www.typescriptlang.org/)
- **运行时**：[Node.js 18+](https://nodejs.org/)
- **开发工具**：[tsx 4.7.0](https://github.com/privatenumber/tsx)
- **协议**：《MCP 1.0 规范兼容》（第一里程碑只验证协议格式，不做实际转发）

#### 目录结构

```
backend/
├── src/
│   ├── routes/               # 路由定义
│   │   ├── serverRoutes.ts   # 服务器路由
│   │   ├── healthRoutes.ts   # 健康检查路由
│   │   └── searchRoutes.ts   # 搜索路由
│   ├── services/             # 业务逻辑层
│   │   ├── ServerService.ts  # 服务器服务
│   │   ├── SearchService.ts  # 搜索服务
│   │   └── HealthService.ts  # 健康检查服务
│   ├── controllers/          # 控制器层
│   │   ├── ServerController.ts
│   │   └── BaseController.ts
│   ├── models/               # 数据模型
│   │   ├── Server.ts         # 服务器模型
│   │   ├── Config.ts         # 配置模型
│   │   └── types.ts          # 类型定义
│   ├── utils/                # 工具函数
│   │   ├── validator.ts      # 验证器
│   │   ├── logger.ts         # 日志工具
│   │   └── response.ts       # 响应格式化
│   ├── config/               # 配置管理
│   │   └── config.ts         # 配置加载
│   └── server.ts             # 服务器入口
├── .mcp-hub.json             # 配置文件（示例）
├── package.json
└── tsconfig.json
```

### 2.4 数据流

```
用户操作                    请求/响应                    数据处理
   │
   ▼
┌─────────────────┐
│   Vue 组件      │ 触发事件
│  (e.g., 点击)   │
└─────────────────┘
   │
   ▼ (dispatch)
┌─────────────────┐
│   Pinia Store   │ 调用 API action
│  (serverStore)  │
└─────────────────┘
   │
   ▼ (fetch)
┌─────────────────┐
│   API 客户端    │ HTTP 请求
│  (http.ts)      │
└─────────────────┘
   │
   ▼ (JSON)
┌─────────────────┐
│  Fastify 路由   │ 路由匹配
│ (/api/servers)  │
└─────────────────┘
   │
   ▼ (调用)
┌─────────────────┐
│  服务层函数     │ 业务逻辑
│ (ServerService) │
└─────────────────┘
   │
   ▼ (读取)
┌─────────────────┐
│   配置文件      │ 返回数据
│ .mcp-hub.json   │
└─────────────────┘
   │
   ▼ (返回)
┌─────────────────┐
│   响应格式化    │ JSON 响应
│ (CMD 格式)      │
└─────────────────┘
   │
   ▼ (回传)
┌─────────────────┐
│   Pinia Store   │ 更新状态
│  (subscribe)    │
└─────────────────┘
   │
   ▼ (触发)
┌─────────────────┐
│   Vue 组件      │ 重新渲染
│  (响应式更新)   │
└─────────────────┘
   │
   ▼
   用户界面更新
```

---

## 3. API 设计规范

### 3.1 API 端点定义

#### 3.1.1 获取服务器列表

**接口**：`GET /api/servers`

**描述**：获取配置的 MCP 服务器列表

**Query 参数**：
```typescript
{
  tags?: Record<string, string>;  // 按标签筛选（可选）
  status?: "online" | "offline" | "error";  // 按状态筛选（可选）
  limit?: number;   // 限制返回数量（可选，默认 50）
  offset?: number;  // 偏移量（可选，默认 0）
}
```

**响应**：
```typescript
{
  "code": 200,
  "message": "获取服务器列表成功",
  "data": {
    "servers": Server[],
    "total": number,
    "limit": number,
    "offset": number
  },
  "timestamp": "2025-12-16T10:00:00.000Z",
  "requestId": "req-12345"
}
```

#### 3.1.2 获取单服务器详情

**接口**：`GET /api/servers/:id`

**路径参数**：
```typescript
{
  id: string;  // 服务器唯一标识
}
```

**响应**：
```typescript
{
  "code": 200,
  "message": "获取服务器详情成功",
  "data": Server,
  "timestamp": "2025-12-16T10:00:00.000Z",
  "requestId": "req-12346"
}
```

#### 3.1.3 搜索服务器

**接口**：`GET /api/servers/search`

**Query 参数**：
```typescript
{
  q?: string;        // 搜索关键词
  tags?: string;     // 标签匹配（JSON 字符串）
  status?: string;   // 状态过滤
}
```

**响应**：
```typescript
{
  "code": 200,
  "message": "搜索服务器成功",
  "data": {
    "servers": Server[],
    "query": string,
    "total": number
  },
  "timestamp": "2025-12-16T10:00:00.000Z",
  "requestId": "req-12347"
}
```

#### 3.1.4 健康检查

**接口**：`GET /api/health`

**响应**：
```typescript
{
  "code": 200,
  "message": "系统运行正常",
  "data": {
    "status": "healthy",
    "uptime": number,  // 运行时间（秒）
    "timestamp": "2025-12-16T10:00:00.000Z"
  },
  "timestamp": "2025-12-16T10:00:00.000Z",
  "requestId": "req-12348"
}
```

### 3.2 CMD 响应格式规范

所有 API 响应必须遵循 **CMD (Common Data Model)** 统一格式：

#### 成功响应

```typescript
interface CMDSuccess<T = unknown> {
  code: 200 | 201 | 204;    // 标准 HTTP 状态码
  message: string;          // 人类可读的错误信息
  data: T;                  // 实际数据
  timestamp: string;        // ISO 8601 时间戳
  requestId?: string;       // 请求唯一标识（可选）
}
```

#### 错误响应

```typescript
interface CMDError<T = null> {
  code: AllErrorCodes;      // 错误码（见下文）
  message: string;          // 错误信息
  data: null;               // 错误响应数据为 null
  timestamp: string;        // ISO 8601 时间戳
  requestId?: string;       // 请求唯一标识
  error?: {
    category: "SYSTEM" | "SECURITY" | "BUSINESS" | "API" | "MCP_PROTOCOL";
    severity: "FATAL" | "ERROR" | "WARN" | "INFO";
    stack?: string;         // 错误堆栈（仅开发环境）
    context?: Record<string, unknown>;  // 错误上下文
  };
}
```

### 3.3 错误码定义

#### 系统级错误 (1000-1999)

| 错误码 | 名称 | 描述 |
|--------|------|------|
| 1001 | DATABASE_CONNECTION_FAILED | 数据库连接失败（预留） |
| 1005 | SERVICE_UNAVAILABLE | 服务不可用 |
| 1500 | INTERNAL_SERVER_ERROR | 内部服务器错误 |

#### 业务逻辑错误 (3000-3999)

| 错误码 | 名称 | 描述 |
|--------|------|------|
| 3004 | RESOURCE_NOT_FOUND | 资源未找到 |
| 3009 | RESOURCE_ALREADY_EXISTS | 资源已存在 |
| 3012 | CONFIGURATION_INVALID | 配置无效 |

#### API 错误 (4000-4999)

| 错误码 | 名称 | 描述 |
|--------|------|------|
| 4000 | INVALID_REQUEST_FORMAT | 请求格式无效 |
| 4001 | MISSING_REQUIRED_PARAMETER | 缺少必需参数 |
| 4002 | INVALID_PARAMETER_VALUE | 参数值无效 |

#### MCP 协议错误 (MCP 标准)

| 错误码 | 名称 | 描述 |
|--------|------|------|
| -32001 | MCP_SERVER_UNREACHABLE | MCP 服务器不可达 |
| -32801 | MCP_TOOL_NOT_FOUND | MCP 工具未找到 |

### 3.4 HTTP 状态码映射

| HTTP 状态码 | CMD 错误码 | 说明 |
|-------------|------------|------|
| 200 | 200 | 成功 |
| 201 | 201 | 创建成功 |
| 400 | 4000 | 请求格式错误 |
| 404 | 3004 | 资源未找到 |
| 500 | 1500 | 内部服务器错误 |

---

## 4. 组件设计

### 4.1 前端组件清单

#### 4.1.1 ServerList 组件

**文件位置**：`src/components/ServerList/ServerList.vue`

**功能**：
- 显示服务器列表（表格形式）
- 支持分页
- 支持状态标识（在线/离线/错误）
- 可点击查看详情
- 支持排序

**Props**：
```typescript
interface ServerListProps {
  servers: Server[];
  loading?: boolean;
  error?: string | null;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
  onServerClick?: (serverId: string) => void;
}
```

**Emits**：
```typescript
interface ServerListEmits {
  (e: "server-click", serverId: string): void;
  (e: "page-change", page: number, pageSize: number): void;
}
```

**示例使用**：
```vue
<template>
  <ServerList
    :servers="serverStore.servers"
    :loading="serverStore.loading"
    :error="serverStore.error"
    :page="currentPage"
    :page-size="pageSize"
    @server-click="handleServerClick"
    @page-change="handlePageChange"
  />
</template>

<script setup lang="ts">
import ServerList from "@/components/ServerList/ServerList.vue";

const handleServerClick = (serverId: string) => {
  // 导航到服务器详情页
};

const handlePageChange = (page: number, pageSize: number) => {
  // 加载指定页数据
};
</script>
```

#### 4.1.2 SearchBox 组件

**文件位置**：`src/components/SearchBox/SearchBox.vue`

**功能**：
- 实时搜索服务器
- 支持标签过滤
- 防抖处理（300ms）
- 清空搜索功能

**Props**：
```typescript
interface SearchBoxProps {
  placeholder?: string;
  debounceMs?: number;  // 默认 300ms
}
```

**Emits**：
```typescript
interface SearchBoxEmits {
  (e: "search", query: string, tags: Record<string, string>): void;
  (e: "clear"): void;
}
```

#### 4.1.3 Header 组件

**文件位置**：`src/components/Header/Header.vue`

**功能**：
- 显示应用标题
- 显示系统状态
- 显示服务器总数

**Props**：
```typescript
interface HeaderProps {
  title?: string;
  totalServers?: number;
  onlineServers?: number;
}
```

### 4.2 后端组件清单

#### 4.2.1 ServerController

**文件位置**：`src/controllers/ServerController.ts`

**职责**：处理服务器相关的 HTTP 请求和响应

**方法**：
```typescript
export class ServerController {
  // 获取服务器列表
  static async listServers(request: FastifyRequest): Promise<CMDSuccess> {
    const { tags, status, limit = 50, offset = 0 } = request.query as any;
    const servers = await ServerService.getServers({
      tags,
      status,
      limit: Number(limit),
      offset: Number(offset)
    });

    return {
      code: 200,
      message: "获取服务器列表成功",
      data: {
        servers,
        total: servers.length,
        limit: Number(limit),
        offset: Number(offset)
      },
      timestamp: new Date().toISOString(),
      requestId: request.id
    };
  }

  // 获取单服务器详情
  static async getServer(request: FastifyRequest): Promise<CMDSuccess | CMDError> {
    const { id } = request.params as { id: string };

    const server = await ServerService.getServerById(id);
    if (!server) {
      return createCMDError(3004, "服务器未找到", request.id);
    }

    return {
      code: 200,
      message: "获取服务器详情成功",
      data: server,
      timestamp: new Date().toISOString(),
      requestId: request.id
    };
  }

  // 搜索服务器
  static async searchServers(request: FastifyRequest): Promise<CMDSuccess> {
    const { q, tags, status } = request.query as any;
    const servers = await SearchService.searchServers({
      query: q,
      tags: tags ? JSON.parse(tags) : undefined,
      status
    });

    return {
      code: 200,
      message: "搜索服务器成功",
      data: {
        servers,
        query: q || "",
        total: servers.length
      },
      timestamp: new Date().toISOString(),
      requestId: request.id
    };
  }
}
```

#### 4.2.2 ServerService

**文件位置**：`src/services/ServerService.ts`

**职责**：封装服务器业务的业务逻辑

**方法**：
```typescript
export class ServerService {
  // 获取服务器列表
  static async getServers(options: ServerQueryOptions): Promise<Server[]> {
    let servers = await this.loadServersFromConfig();

    // 按状态过滤
    if (options.status) {
      servers = servers.filter(s => s.status === options.status);
    }

    // 按标签过滤
    if (options.tags) {
      servers = servers.filter(s => {
        return Object.entries(options.tags!).every(([key, value]) => {
          return s.tags?.[key] === value;
        });
      });
    }

    // 分页
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    return servers.slice(offset, offset + limit);
  }

  // 根据 ID 获取服务器
  static async getServerById(id: string): Promise<Server | null> {
    const servers = await this.loadServersFromConfig();
    return servers.find(s => s.id === id) || null;
  }

  // 从配置文件加载服务器
  private static async loadServersFromConfig(): Promise<Server[]> {
    // 实现从 .mcp-hub.json 加载逻辑
  }
}
```

#### 4.2.3 SearchService

**文件位置**：`src/services/SearchService.ts`

**职责**：处理服务器搜索和过滤逻辑

**方法**：
```typescript
export class SearchService {
  static async searchServers(options: SearchOptions): Promise<Server[]> {
    let servers = await ServerService.getServers({});

    // 关键词搜索（名称、描述）
    if (options.query) {
      const query = options.query.toLowerCase();
      servers = servers.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }

    // 标签匹配
    if (options.tags) {
      servers = servers.filter(s => {
        return Object.entries(options.tags!).every(([key, value]) => {
          return s.tags?.[key] === value;
        });
      });
    }

    // 状态匹配
    if (options.status) {
      servers = servers.filter(s => s.status === options.status);
    }

    return servers;
  }
}
```

#### 4.2.4 Validator

**文件位置**：`src/utils/validator.ts`

**职责**：验证请求参数和数据格式

**方法**：
```typescript
export class Validator {
  // 验证服务器查询参数
  static validateServerQuery(params: unknown): ValidationResult {
    const result = new ValidationResult();

    if (params && typeof params === 'object') {
      const { tags, status, limit, offset } = params as any;

      // 验证状态
      if (status && !["online", "offline", "error"].includes(status)) {
        result.addError("status", "状态必须是 online、offline 或 error");
      }

      // 验证限制数量
      if (limit && (typeof limit !== 'number' || limit < 1 || limit > 100)) {
        result.addError("limit", "限制数量必须为 1-100 的数字");
      }

      // 验证偏移量
      if (offset && (typeof offset !== 'number' || offset < 0)) {
        result.addError("offset", "偏移量必须为非负数字");
      }
    }

    return result;
  }

  // 验证服务器 ID
  static validateServerId(id: string): boolean {
    // ID 必须是字母、数字和连字符的组合
    return /^[a-zA-Z0-9-]+$/.test(id);
  }
}
```

---

## 5. 数据模型

### 5.1 Server 数据模型

#### 5.1.1 基础 Server 类型

```typescript
// src/types/server.ts

export interface Server {
  // 基础信息
  id: string;                    // 唯一标识符
  name: string;                  // 服务器名称
  description?: string;          // 描述信息

  // MCP 配置
  command: string;               // 启动命令
  args?: string[];               // 启动参数
  env?: Record<string, string>;  // 环境变量
  cwd?: string;                  // 工作目录

  // 状态信息（实时更新）
  status: "online" | "offline" | "error";  // 当前状态
  lastStarted?: string;          // 最后启动时间（ISO 8601）
  lastError?: string;            // 最后错误信息

  // 元数据
  tags?: Record<string, string>; // 标签
  version?: string;              // 服务器版本
  capabilities?: string[];       // 能力列表

  // 资源信息
  pid?: number;                  // 进程 ID
  port?: number;                 // 端口（如果适用）
  maxConnections?: number;       // 最大连接数（如果适用）

  // 统计信息
  requestCount?: number;         // 请求计数（预留）
  avgLatencyMs?: number;         // 平均延迟（预留）
  errorCount?: number;           // 错误计数（预留）

  // 时间戳
  createdAt: string;             // 创建时间（ISO 8601）
  updatedAt: string;             // 最后更新时间（ISO 8601）
}
```

#### 5.1.2 服务器查询选项

```typescript
export interface ServerQueryOptions {
  tags?: Record<string, string>;
  status?: "online" | "offline" | "error";
  limit?: number;
  offset?: number;
}
```

#### 5.1.3 搜索选项

```typescript
export interface SearchOptions {
  query?: string;        // 搜索关键词
  tags?: Record<string, string>;
  status?: "online" | "offline" | "error";
}
```

### 5.2 配置文件结构

#### .mcp-hub.json 格式

配置文件遵循 `schema/config-schema.json` 的规范，MVP 阶段使用的字段：

```json
{
  "version": "1.0.0",
  "description": "MCP-HUB-LITE 配置文件",
  "port": 7788,
  "host": "localhost",

  "mcpServers": [
    {
      "id": "server-filesystem",
      "name": "文件系统工具",
      "description": "提供文件读写功能的 MCP 服务器",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/files"],
      "tags": {
        "category": "utility",
        "environment": "development"
      },
      "version": "0.1.0",
      "capabilities": ["read", "write"]
    },
    {
      "id": "server-sqlite",
      "name": "SQLite 数据库",
      "description": "SQLite 数据库操作工具",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sqlite", "database.db"],
      "tags": {
        "category": "database",
        "environment": "production"
      },
      "version": "0.1.0",
      "capabilities": ["query", "update"]
    }
  ],

  "groups": [
    {
      "id": "group-developer",
      "name": "开发工具组",
      "description": "用于开发环境的 MCP 服务器集合",
      "servers": ["server-filesystem", "server-sqlite"],
      "tags": {
        "environment": "development"
      }
    }
  ],

  "logging": {
    "level": "info",
    "rotation": {
      "enabled": true,
      "maxSize": "100MB",
      "maxAge": "7d"
    }
  }
}
```

### 5.3 TypeScript 类型定义

#### 5.3.1 API 响应类型

```typescript
// src/types/api.ts

import type { Server } from "./server";

// 成功响应
export interface APIResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
  requestId: string;
}

// 错误响应
export interface APIError {
  code: number;
  message: string;
  data: null;
  timestamp: string;
  requestId: string;
  error?: {
    category: "SYSTEM" | "SECURITY" | "BUSINESS" | "API" | "MCP_PROTOCOL";
    severity: "FATAL" | "ERROR" | "WARN" | "INFO";
    stack?: string;
    context?: Record<string, unknown>;
  };
}

// 服务器列表响应
export interface ServerListResponse {
  servers: Server[];
  total: number;
  limit: number;
  offset: number;
}

// 搜索响应
export interface SearchResponse {
  servers: Server[];
  query: string;
  total: number;
}

// 健康检查响应
export interface HealthResponse {
  status: "healthy" | "unhealthy";
  uptime: number;
  timestamp: string;
}
```

#### 5.3.2 请求类型

```typescript
// 服务器查询参数
export interface ServerQueryParams {
  tags?: Record<string, string>;
  status?: "online" | "offline" | "error";
  limit?: number;
  offset?: number;
}

// 搜索参数
export interface SearchParams {
  q?: string;
  tags?: string;  // JSON 字符串
  status?: string;
}
```

### 5.4 数据验证规则

#### 5.4.1 Server 数据验证

```typescript
// src/utils/validators/server.ts

import type { Server } from "@/types/server";

export function validateServer(server: unknown): ValidationResult {
  const result = new ValidationResult();

  if (!isServer(server)) {
    result.addError("", "无效的服务器对象");
    return result;
  }

  const s = server as Server;

  // 必填字段验证
  if (!s.id || s.id.trim().length === 0) {
    result.addError("id", "服务器 ID 不能为空");
  } else if (!/^[a-zA-Z0-9-]+$/.test(s.id)) {
    result.addError("id", "服务器 ID 只能包含字母、数字和连字符");
  }

  if (!s.name || s.name.trim().length === 0) {
    result.addError("name", "服务器名称不能为空");
  }

  if (!s.command || s.command.trim().length === 0) {
    result.addError("command", "启动命令不能为空");
  }

  // 标签验证（可选）
  if (s.tags) {
    for (const [key, value] of Object.entries(s.tags)) {
      if (!key || !value) {
        result.addError("tags", "标签的 key 和 value 都不能为空");
      }
    }
  }

  return result;
}

function isServer(value: unknown): value is Server {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value &&
    "command" in value &&
    "status" in value
  );
}
```

---

## 6. 测试策略

### 6.1 测试金字塔

```
                  ┌──────────────────┐
                  │   E2E 测试        │  ← 少量（5-10个）
                  │  (Playwright)    │
                  └──────────────────┘
        ┌──────────────────────────────┐
        │        集成测试               │  ← 中等（10-20个）
        │    (API + 组件测试)           │
        └──────────────────────────────┘
      ┌──────────────────────────────────┐
      │           单元测试                │  ← 大量（50-100个）
      │    (组件 + 服务 + 工具)           │
      └──────────────────────────────────┘
```

### 6.2 单元测试

#### 6.2.1 前端组件测试

**测试文件**：`tests/unit/ServerList.test.ts`

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ServerList from "@/components/ServerList/ServerList.vue";
import type { Server } from "@/types/server";

describe("ServerList 组件", () => {
  let mockServers: Server[];

  beforeEach(() => {
    mockServers = [
      {
        id: "server-1",
        name: "服务器 1",
        command: "npx test-server",
        status: "online",
        createdAt: "2025-12-16T10:00:00.000Z",
        updatedAt: "2025-12-16T10:00:00.000Z"
      },
      {
        id: "server-2",
        name: "服务器 2",
        command: "npx test-server-2",
        status: "offline",
        createdAt: "2025-12-16T10:00:00.000Z",
        updatedAt: "2025-12-16T10:00:00.000Z"
      }
    ];
  });

  test("应正确渲染服务器列表", () => {
    const wrapper = mount(ServerList, {
      props: { servers: mockServers }
    });

    expect(wrapper.text()).toContain("服务器 1");
    expect(wrapper.text()).toContain("服务器 2");
  });

  test("应显示加载状态", () => {
    const wrapper = mount(ServerList, {
      props: { servers: [], loading: true }
    });

    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true);
  });

  test("应显示错误信息", () => {
    const errorMessage = "测试错误";
    const wrapper = mount(ServerList, {
      props: { servers: [], error: errorMessage }
    });

    expect(wrapper.text()).toContain(errorMessage);
  });

  test("点击服务器应触发事件", async () => {
    const wrapper = mount(ServerList, {
      props: { servers: mockServers }
    });

    await wrapper.find('[data-testid="server-row"]').trigger("click");

    expect(wrapper.emitted("server-click")).toBeTruthy();
    expect(wrapper.emitted("server-click")[0]).toEqual(["server-1"]);
  });
});
```

#### 6.2.2 Pinia Store 测试

**测试文件**：`tests/unit/serverStore.test.ts`

```typescript
import { describe, test, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useServerStore } from "@/stores/serverStore";
import * as serverApi from "@/api/serverApi";

// Mock API
vi.mock("@/api/serverApi");

describe("Server Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  test("应能获取服务器列表", async () => {
    const mockServers = [
      { id: "1", name: "服务器 1", command: "npx test", status: "online" as const }
    ];

    vi.mocked(serverApi.getServerList).mockResolvedValue({
      code: 200,
      data: { servers: mockServers, total: 1, limit: 50, offset: 0 }
    });

    const store = useServerStore();
    await store.fetchServers();

    expect(serverApi.getServerList).toHaveBeenCalled();
    expect(store.servers).toEqual(mockServers);
    expect(store.loading).toBe(false);
  });

  test("应能处理搜索", async () => {
    const mockServers = [
      { id: "1", name: "服务器 1", command: "npx test", status: "online" as const }
    ];

    vi.mocked(serverApi.searchServers).mockResolvedValue({
      code: 200,
      data: { servers: mockServers, query: "测试", total: 1 }
    });

    const store = useServerStore();
    await store.searchServers("测试");

    expect(serverApi.searchServers).toHaveBeenCalledWith("测试");
    expect(store.servers).toEqual(mockServers);
  });

  test("应能处理错误", async () => {
    const error = new Error("网络错误");
    vi.mocked(serverApi.getServerList).mockRejectedValue(error);

    const store = useServerStore();
    await store.fetchServers();

    expect(store.error).toBe(error.message);
    expect(store.loading).toBe(false);
  });
});
```

#### 6.2.3 后端服务测试

**测试文件**：`tests/unit/ServerService.test.ts`

```typescript
import { describe, test, expect, beforeEach } from "vitest";
import { ServerService } from "@/services/ServerService";
import type { Server } from "@/models/Server";

describe("ServerService", () => {
  let mockServers: Server[];

  beforeEach(() => {
    mockServers = [
      {
        id: "server-1",
        name: "服务 1",
        command: "npx test",
        status: "online",
        createdAt: "2025-12-16T10:00:00.000Z",
        updatedAt: "2025-12-16T10:00:00.000Z"
      }
    ];

    // Mock 配置文件
    vi.spyOn(ServerService as any, "loadServersFromConfig").mockResolvedValue(mockServers);
  });

  test("应能获取所有服务器", async () => {
    const servers = await ServerService.getServers({});

    expect(servers).toEqual(mockServers);
  });

  test("应能按状态过滤", async () => {
    const servers = await ServerService.getServers({ status: "online" });

    expect(servers).toEqual(mockServers);
    expect(servers[0].status).toBe("online");
  });

  test("应能获取单服务器", async () => {
    const server = await ServerService.getServerById("server-1");

    expect(server).toEqual(mockServers[0]);
  });

  test("应返回 null 如果服务器未找到", async () => {
    const server = await ServerService.getServerById("non-existent");

    expect(server).toBeNull();
  });

  test("应支持分页", async () => {
    const servers = await ServerService.getServers({ offset: 0, limit: 1 });

    expect(servers).toHaveLength(1);
  });
});
```

### 6.3 集成测试

#### 6.3.1 API 集成测试

**测试文件**：`tests/integration/api.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { buildServer } from "@/server";
import type { FastifyInstance } from "fastify";

describe("API 集成测试", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  test("GET /api/servers 应返回服务器列表", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/servers"
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      code: 200,
      message: "获取服务器列表成功",
      data: {
        servers: expect.any(Array),
        total: expect.any(Number)
      }
    });
  });

  test("GET /api/servers/:id 应返回单服务器详情", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/servers/server-1"
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      code: 200,
      data: {
        id: "server-1",
        name: expect.any(String)
      }
    });
  });

  test("GET /api/servers/:id 应返回 404 如果服务器不存在", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/servers/non-existent"
    });

    expect(response.statusCode).toBe(200); // CMD 格式返回 200

    const body = JSON.parse(response.body);
    expect(body.code).toBe(3004); // 资源未找到错误码
    expect(body.message).toContain("服务器未找到");
  });

  test("GET /api/servers/search 应返回搜索结果", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/servers/search?q=test"
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      code: 200,
      data: {
        servers: expect.any(Array),
        query: "test",
        total: expect.any(Number)
      }
    });
  });

  test("GET /api/health 应返回健康状态", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      code: 200,
      data: {
        status: "healthy",
        uptime: expect.any(Number)
      }
    });
  });

  test("所有响应应遵循 CMD 格式", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/servers"
    });

    const body = JSON.parse(response.body);

    // 验证 CMD 格式结构
    expect(body).toHaveProperty("code");
    expect(body).toHaveProperty("message");
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("requestId");
  });
});
```

#### 6.3.2 前后端集成测试

**测试文件**：`tests/integration/frontend-backend.test.ts`

```typescript
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { setupBrowser } from "@/test-utils/browser";
import { buildServer } from "@/server";
import type { FastifyInstance } from "fastify";

describe("前后端集成测试", () => {
  let browser: Browser;
  let app: FastifyInstance;
  let frontendUrl: string;

  beforeAll(async () => {
    // 启动后端服务器
    app = await buildServer();
    await app.listen({ port: 7788, host: "localhost" });

    // 启动前端测试环境
    browser = await setupBrowser();
    frontendUrl = "http://localhost:5173";
  });

  afterAll(async () => {
    await browser.close();
    await app.close();
  });

  test("应能通过 UI 查看服务器列表", async () => {
    await browser.goto(`${frontendUrl}/servers`);

    // 等待服务器列表加载
    await browser.waitForSelector('[data-testid="server-row"]');

    // 验证至少显示一个服务器
    const serverRows = await browser.$$('[data-testid="server-row"]');
    expect(serverRows.length).toBeGreaterThan(0);
  });

  test("应能通过搜索栏搜索服务器", async () => {
    await browser.goto(`${frontendUrl}/servers`);

    // 输入搜索关键词
    await browser.fill('[data-testid="search-input"]', "服务器");

    // 等待搜索结果
    await browser.waitForSelector('[data-testid="server-row"]');

    // 验证搜索结果
    const serverNames = await browser.$$eval('[data-testid="server-name"]', els =>
      els.map(el => el.textContent)
    );

    expect(serverNames.every(name => name?.includes("服务器"))).toBe(true);
  });

  test("应能点击服务器查看详情", async () => {
    await browser.goto(`${frontendUrl}/servers`);

    // 点击第一个服务器
    await browser.click('[data-testid="server-row"]');

    // 等待详情页面加载
    await browser.waitForSelector('[data-testid="server-detail"]');

    // 验证显示服务器详情
    const detail = await browser.textContent('[data-testid="server-detail"]');
    expect(detail).toContain("服务器详细信息");
  });

  test("应能处理 API 错误", async () => {
    // 模拟 API 错误（通过 mock 响应）

    await browser.goto(`${frontendUrl}/servers`);

    // 等待错误信息显示
    await browser.waitForSelector('[data-testid="error-message"]');

    // 验证显示错误
    const errorMsg = await browser.textContent('[data-testid="error-message"]');
    expect(errorMsg).toBeTruthy();
  });
});
```

### 6.4 端到端测试（E2E）

**测试文件**：`tests/e2e/full-workflow.test.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("完整工作流测试", () => {
  test("用户应能完成从应用到服务器管理的完整流程", async ({ page }) => {
    // 1. 访问应用主页
    await page.goto("http://localhost:5173");
    await expect(page).toHaveTitle(/MCP Hub Lite/);

    // 2. 验证显示服务器列表
    await expect(page.locator('[data-testid="server-list"]')).toBeVisible();

    // 3. 验证显示服务器总数
    const totalText = await page.textContent('[data-testid="total-servers"]');
    const totalCount = parseInt(totalText?.match(/\d+/)?.[0] || "0");
    expect(totalCount).toBeGreaterThan(0);

    // 4. 使用搜索功能
    await page.fill('[data-testid="search-input"]', "服务器");
    await page.waitForTimeout(500); // 等待防抖

    // 5. 验证搜索结果
    const searchResults = await page.locator('[data-testid="server-row"]').count();
    expect(searchResults).toBeGreaterThan(0);

    // 6. 点击第一个服务器
    await page.click('[data-testid="server-row"]');

    // 7. 验证跳转到详情页
    await expect(page).toHaveURL(/.*\/servers\/.*/);
    await expect(page.locator('[data-testid="server-detail-name"]')).toBeVisible();

    // 8. 验证显示服务器信息
    const serverName = await page.textContent('[data-testid="server-detail-name"]');
    expect(serverName).toBeTruthy();

    // 9. 返回列表页
    await page.click('[data-testid="back-button"]');
    await expect(page).toHaveURL(/.*\/servers$/);

    // 10. 使用真实服务器测试真实场景
    const serverRow = await page.locator('[data-testid="server-row"]').first();
    await expect(serverRow.locator('[data-testid="status-badge"]')).toBeVisible();

    const statusText = await serverRow.locator('[data-testid="status-badge"]').textContent();
    expect(statusText).toMatch(/online|offline|error/i);
  });

  test("应处理网络错误情况", async ({ page }) => {
    // 1. 访问应用
    await page.goto("http://localhost:5173/servers");

    // 2. 模拟网络错误（通过路由或 proxy）
    await page.route("**/api/servers", route => {
      route.abort("internetdisconnected");
    });

    // 3. 等待错误提示
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({
      timeout: 5000
    });

    // 4. 验证错误信息内容
    const errorText = await page.textContent('[data-testid="error-message"]');
    expect(errorText).toContain("网络错误");
  });

  test("响应式设计测试", async ({ page }) => {
    // 1. 测试桌面端视图
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("http://localhost:5173");
    await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();

    // 2. 测试平板视图
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();

    // 3. 测试移动端（不适用于第一里程碑，仅测试到大屏平板）
    // 小于 1024px 的屏幕将在后续里程碑中支持
  });
});
```

### 6.5 代码覆盖率要求

#### 6.5.1 覆盖率阈值

| 指标 | 最小要求 | 目标值 |
|------|----------|--------|
| **行覆盖率** | 90% | 95% |
| **分支覆盖率** | 90% | 95% |
| **函数覆盖率** | 90% | 95% |
| **语句覆盖率** | 90% | 95% |

#### 6.5.2 Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "dist/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/coverage/**",
        "**/index.html"
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
```

#### 6.5.3 覆盖率报告

测试完成后，将生成以下三种格式的覆盖率报告：

1. **终端输出**：快速查看覆盖率统计
2. **JSON 报告**：`coverage/coverage-final.json`（供 CI 使用）
3. **HTML 报告**：`coverage/index.html`（详细查看，支持浏览器打开）

### 6.6 测试运行命令

#### 6.6.1 package.json 脚本

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "validate": "npm run validate:types && npm run validate:test",
    "validate:test": "vitest run --coverage"
  }
}
```

#### 6.6.2 测试命令使用

```bash
# 运行所有单元测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行集成测试
vitest run tests/integration

# 运行端到端测试
npm run test:e2e

# 监视模式运行测试
npm run test:watch

# 运行特定测试文件
vitest run ServerList.test.ts

# 运行特定测试
vitest run --reporter=verbose --name "应能获取所有服务器"
```

---

## 7. 实施计划

### 7.1 第一周（Week 1）详细任务分解

#### Day 1：项目初始化与配置

**任务**：
- [ ] 创建前端项目结构（Vue + Vite + TypeScript）
- [ ] 创建后端项目结构（Fastify + TypeScript）
- [ ] 配置 TypeScript 编译选项（tsconfig.json）
- [ ] 配置 ESLint 和 Prettier
- [ ] 配置 Vitest 测试框架
- [ ] 配置路径别名（@ 指向 src）
- [ ] 引入 Element Plus UI 库
- [ ] 创建基础 Git 提交钩子（pre-commit）

**预计时间**：6-8 小时（1 人天）

**验收标准**：
- ✅ 前端项目可正常启动（`npm run dev`）
- ✅ 后端项目可正常启动（`npm run dev`）
- ✅ TypeScript 编译无错误
- ✅ 测试环境配置正确（`npm test` 可运行）

---

#### Day 2：数据模型与类型定义

**任务**：
- [ ] 定义 Server、Config 等核心 TypeScript 类型
- [ ] 创建 API 响应格式类型（CMD 格式）
- [ ] 定义错误码类型（AllErrorCodes）
- [ ] 创建数据验证器函数（validator.ts）
- [ ] 实现配置文件加载器（config.ts）
- [ ] 编写数据模型单元测试

**预计时间**：8 小时（1 人天）

**验收标准**：
- ✅ 所有类型定义完整且正确
- ✅ 类型检查通过（`tsc --noEmit`）
- ✅ 数据验证器测试通过
- ✅ 配置文件解析正确

---

#### Day 3：后端服务层实现

**任务**：
- [ ] 实现 ServerService（服务器业务逻辑）
- [ ] 实现 SearchService（搜索服务）
- [ ] 实现 HealthService（健康检查服务）
- [ ] 实现 Validator（验证器）
- [ ] 编写服务层单元测试
- [ ] 配置文件集成测试

**预计时间**：10 小时（1.25 人天）

**验收标准**：
- ✅ 所有服务方法测试通过
- ✅ 单元测试覆盖率 ≥ 90%
- ✅ 服务能够正确加载配置文件
- ✅ 搜索和过滤功能正常

---

#### Day 4：后端 API 路由实现

**任务**：
- [ ] 实现 ServerController（服务器控制器）
- [ ] 创建 /api/servers 路由（GET）
- [ ] 创建 /api/servers/:id 路由（GET）
- [ ] 创建 /api/servers/search 路由（GET）
- [ ] 创建 /api/health 路由（GET）
- [ ] 实现统一错误处理
- [ ] 编写 API 集成测试
- [ ] 实现 CMD 格式响应中间件

**预计时间**：8 小时（1 人天）

**验收标准**：
- ✅ 所有 API 端点测试通过
- ✅ API 响应格式符合 CMD 规范
- ✅ 错误处理正确映射到错误码
- ✅ 集成测试覆盖率 ≥ 90%

---

#### Day 5：中期里程碑检查点 ⏱️

**检查点**：第一天到第四天的工作完成情况

**检查项**：
- [ ] **后端功能完整**：所有 API 端点测试通过
- [ ] **类型安全**：TypeScript 编译无错误
- [ ] **测试覆盖**：代码覆盖率 ≥ 90%
- [ ] **配置管理**：配置文件加载和解析正常
- [ ] **错误处理**：错误响应符合 CMD 格式

**里程碑标准**：
- ✅ 后端可独立运行和测试
- ✅ 所有 API 端点正常工作
- ✅ 前端可开始集成

**如果未完成**：
- 🔴 **延后**：前端开发任务，专注完成后端
- 🔴 **资源调整**：增加人手或延长期限

---

#### Day 6：Pinia 状态管理实现

**任务**：
- [ ] 配置 Pinia 状态管理
- [ ] 实现 serverStore（服务器状态）
- [ ] 实现 API 客户端层（http.ts, serverApi.ts）
- [ ] 编写 async action（fetchServers、searchServers）
- [ ] 实现状态持久化（localStorage）
- [ ] 编写 Store 单元测试
- [ ] 实现错误状态处理

**预计时间**：8 小时（1 人天）

**验收标准**：
- ✅ Store 测试全部通过
- ✅ 状态更新正确触发组件重新渲染
- ✅ API 错误正确设置 error 状态
- ✅ 状态持久化功能正常

---

#### Day 7：前端基础组件实现

**任务**：
- [ ] 实现 SearchBox 组件
- [ ] 实现 Header 组件
- [ ] 实现 ServerList 组件（表格形式）
- [ ] 实现 ServerPage（主页面）
- [ ] 编写组件单元测试
- [ ] 实现响应式布局（1024px+）
- [ ] 配置 Element Plus 组件主题

**预计时间**：10 小时（1.25 人天）

**验收标准**：
- ✅ 所有组件渲染正确
- ✅ 组件测试覆盖率 ≥ 90%
- ✅ 响应式布局实现
- ✅ 用户交互（点击、搜索）正确触发

---

### 7.2 第二周（Week 2）验收准备

#### Day 8-9：端到端集成与测试

**任务**：
- [ ] 配置 Playwright E2E 测试框架
- [ ] 编写完整工作流 E2E 测试
- [ ] 编写前端-后端集成测试
- [ ] 修复发现的问题
- [ ] 优化性能和稳定性
- [ ] 生成测试报告和覆盖率报告

**预计时间**：12 小时（1.5 人天）

**验收标准**：
- ✅ 所有 E2E 测试通过
- ✅ 可视化测试报告显示流畅的用户体验
- ✅ 性能指标：API 响应 < 500ms，前端加载 < 2s
- ✅ 无内存泄漏

---

#### Day 10：文档完善与代码审查

**任务**：
- [ ] 完善代码注释和 JSDoc
- [ ] 更新 README.md
- [ ] 创建 API 文档
- [ ] 代码审查与重构
- [ ] 性能优化（如有必要）
- [ ] 最终测试验证

**预计时间**：6-8 小时（1 人天）

**验收标准**：
- ✅ 代码库可读性良好
- ✅ 文档完整且准确
- ✅ 通过代码审查
- ✅ 所有质量检查通过

---

### 7.3 测试驱动开发（TDD）循环

每个功能遵循 TDD 三步循环：

```
步骤 1：编写测试 → 功能未实现 → 测试失败（红色）
              ↓
步骤 2：编写代码 → 最简实现 → 测试通过（绿色）
              ↓
步骤 3：重构 → 保持测试通过 → 代码质量提升（蓝色）
              ↓
迭代下一功能
```

**示例**（ServerService.getServers）：
1. ✅ 编写测试：测试获取服务器列表功能
2. 🔴 运行测试：确认失败（方法未实现）
3. ✅ 编写代码：实现最简的 getServers 方法
4. 🟢 运行测试：确认通过
5. ✅ 重构：优化代码结构，保持测试通过

### 7.4 里程碑检查点

#### Day 5 中期检查

**必须完成**：
- ✅ 后端所有 API 端点
- ✅ 数据模型和类型定义
- ✅ 服务层单元测试
- ✅ 覆盖率 ≥ 90%

**延后至 Week 2**：
- 🔘 前端组件开发
- 🔘 E2E 测试
- 🔘 集成测试

**如果未达标**：
- 🔴 **决策点**：是否延后前端开发，集中精力完善后端
- 🔴 **风险评估**：评估是否需要额外资源或延长期限

#### Week 2 验收检查

**必须完成**：
- ✅ 前后端集成正常工作
- ✅ 所有 E2E 测试通过
- ✅ 代码覆盖率 ≥ 90%
- ✅ 性能指标达标

**MVP 验收标准**：
- ✅ 用户可以查看服务器列表
- ✅ 用户可以通过搜索过滤服务器
- ✅ 系统显示服务器状态
- ✅ API 响应时间 < 500ms
- ✅ 前端加载时间 < 2 秒

---

## 8. 部署和交付

### 8.1 构建和打包流程

#### 8.1.1 前端构建配置

```typescript
// frontend/vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks: {
          "element-plus": ["element-plus"],
          "vendor": ["vue", "pinia"]
        }
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
```

**构建命令**：
```bash
cd frontend
npm run build
# 输出目录：frontend/dist/
```

#### 8.1.2 后端构建配置

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**构建命令**：
```bash
cd backend
npm run build
# 输出目录：backend/dist/
# 启动：node dist/server.js
```

### 8.2 开发环境配置

#### 8.2.1 环境要求

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| **Node.js** | ≥ 18.0.0 | JavaScript 运行时 |
| **npm** | ≥ 8.0.0 | 包管理器 |
| **TypeScript** | 5.3.3 | 类型检查 |
| **Vue** | 3.4.21 | 前端框架 |
| **Fastify** | 4.28.1 | 后端框架 |

#### 8.2.2 环境变量

创建 `backend/.env` 文件：

```bash
# MCP Hub Lite 配置
PORT=7788
HOST=localhost
NODE_ENV=development

# 日志配置
LOG_LEVEL=info
LOG_FILE=./logs/mcp-hub.log

# 配置文件路径
CONFIG_PATH=./.mcp-hub.json

# API 设置
API_TIMEOUT=30000
API_RATE_LIMIT=100

# 安全设置
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

创建 `frontend/.env` 文件：

```bash
# API 基础 URL
VITE_API_BASE_URL=http://localhost:7788/api

# 应用信息
VITE_APP_TITLE=MCP Hub Lite
VITE_APP_VERSION=1.0.0

# 开发设置
VITE_DEV_TOOLS=true
```

#### 8.2.3 项目初始化脚本

创建 `setup.sh` 初始化脚本：

```bash
#!/bin/bash
# setup.sh - 项目初始化脚本

echo "🚀 正在初始化 MCP Hub Lite MVP 项目..."

# 安装后端依赖
echo "📦 安装后端依赖..."
cd backend
npm install
npm run build

# 安装前端依赖
echo "📦 安装前端依赖..."
cd ../frontend
npm install

# 生成类型文件
echo "🔧 生成类型文件..."
cd ..
npm run generate:types

# 创建必要目录
echo "📁 创建必要目录..."
mkdir -p logs
mkdir -p backups

# 复制示例配置
echo "📋 复制示例配置..."
cp .mcp-hub.json.example .mcp-hub.json

echo "✅ 项目初始化完成!"
echo ""
echo "启动命令："
echo "后端: cd backend && npm run dev"
echo "前端: cd frontend && npm run dev"
```

### 8.3 项目结构说明

#### 8.3.1 完整目录结构

```
mcp-hub-lite/
├── docs/                          # 项目文档
│   ├── mvp-technical-spec.md      # 本文档
│   └── api/                       # API 文档
├── backend/                       # 后端代码
│   ├── src/
│   │   ├── controllers/           # 控制器
│   │   ├── services/              # 服务层
│   │   ├── routes/                # 路由
│   │   ├── models/                # 数据模型
│   │   ├── utils/                 # 工具函数
│   │   └── server.ts              # 服务器入口
│   ├── dist/                      # 构建输出
│   ├── tests/                     # 后端测试
│   ├── .env                       # 环境变量
│   ├── package.json
│   └── tsconfig.json
├── frontend/                      # 前端代码
│   ├── src/
│   │   ├── components/            # Vue 组件
│   │   ├── views/                 # 页面视图
│   │   ├── stores/                # Pinia 状态管理
│   │   ├── api/                   # API 客户端
│   │   ├── types/                 # TypeScript 类型
│   │   └── App.vue                # 根组件
│   ├── public/                    # 静态资源
│   ├── dist/                      # 构建输出
│   ├── tests/                     # 前端测试
│   ├── .env
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── tests/                         # E2E 测试
│   ├── e2e/
│   └── integration/
├── .mcp-hub.json                  # 配置文件（示例）
├── logs/                          # 日志文件
├── specs/                         # 需求规范
├── .claude/                       # AI 助手配置
└── README.md
```

#### 8.3.2 关键文件说明

| 文件/目录 | 说明 | 修改频率 |
|-----------|------|----------|
| `.mcp-hub.json` | 主配置文件，包含所有 MCP 服务器配置 | 中等（添加服务器时修改） |
| `frontend/src/` | 前端源代码 | 高（每次功能更新） |
| `backend/src/` | 后端源代码 | 高（每次功能更新） |
| `tests/` | 所有测试文件 | 高（随代码更新） |
| `logs/` | 日志输出目录 | 高（实时写入） |
| `backups/` | 配置备份目录 | 低（定期创建） |

### 8.4 开发工作流

#### 8.4.1 本地开发启动

```bash
# 1. 启动后端（终端 1）
cd backend
npm run dev
# 后端运行在 http://localhost:7788

# 2. 启动前端（终端 2）
cd frontend
npm run dev
# 前端运行在 http://localhost:5173

# 3. 访问应用
# 打开浏览器访问：http://localhost:5173
```

#### 8.4.2 代码验证流程

```bash
# 1. 运行类型检查
npm run validate:types

# 2. 运行单元测试
npm test

# 3. 生成覆盖率报告
npm run test:coverage

# 4. 运行集成测试
npm run test:integration

# 5. 运行端到端测试
npm run test:e2e

# 6. 运行所有检查（提交前）
npm run validate
```

#### 8.4.3 预提交检查

使用 Husky 配置自动检查：

```bash
# 安装 husky（首次）
npx husky install

# 设置预提交钩子
npx husky add .husky/pre-commit "npm run validate"
```

预提交钩子将在每次 `git commit` 前自动运行：
- 类型检查
- 单元测试
- ESlint 检查

如果任何检查失败，提交将被阻止。

### 8.5 性能基准

#### 8.5.1 前端性能指标

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| **首次内容绘制 (FCP)** | < 1.5s | Lighthouse |
| **最大内容绘制 (LCP)** | < 2.5s | Lighthouse |
| **累积布局偏移 (CLS)** | < 0.1 | Lighthouse |
| **首屏加载时间** | < 2s | Performance API |
| **交互延迟** | < 100ms | Lighthouse |

#### 8.5.2 后端性能指标

| 指标 | 目标值 | 测试方法 |
|------|--------|----------|
| **API 响应时间** | < 500ms | API 测试 |
| **并发请求处理** | 100 req/s | 负载测试 |
| **内存使用** | < 512MB | Node.js monitoring |
| **CPU 使用率** | < 50% | 监控系统 |

#### 8.5.3 资源使用

| 资源 | 开发环境 | 生产环境（预估） |
|------|----------|------------------|
| **内存** | 1-2GB | 512MB - 1GB |
| **磁盘** | < 5GB | < 2GB |
| **网络** | 10Mbps | 5Mbps |

### 8.6 故障排除

#### 8.6.1 常见问题

**Q1: TypeScript 编译错误 "Cannot find module"**
```bash
# 解决方案：配置路径别名
# 确保 vite.config.ts 或 tsconfig.json 中有：
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**Q2: 前端请求 API 跨域错误**
```typescript
// 解决方案：后端配置 CORS
// backend/src/server.ts
import cors from "@fastify/cors";

await app.register(cors, {
  origin: ["http://localhost:5173"],
  credentials: true
});
```

**Q3: 单元测试通过但集成测试失败**
```bash
# 解决方案：检查测试环境配置
# 确保测试使用相同的配置文件和依赖注入
```

#### 8.6.2 日志查看

```bash
# 查看后端日志
tail -f backend/logs/mcp-hub.log

# 查看前端错误（浏览器控制台）
# 打开 DevTools (F12) → Console

# 查看测试覆盖率报告
open frontend/coverage/index.html
```

#### 8.6.3 调试技巧

**后端调试**：
```bash
# 使用 Inspector 调试
node --inspect-brk dist/server.js

# 使用 VS Code 调试配置：
{
  "type": "node",
  "request": "launch",
  "name": "Debug Backend",
  "program": "${workspaceFolder}/backend/dist/server.js",
  "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
}
```

**前端调试**：
```typescript
// 使用 Vue DevTools 调试
// 在浏览器中安装 Vue DevTools 扩展

// 使用 console.log 调试
console.log("store state:", store.servers);
console.log("api response:", response);
```

### 8.7 交付清单

#### 8.7.1 代码交付

- ✅ 前端源代码（完整项目）
- ✅ 后端源代码（完整项目）
- ✅ 测试套件（单元 + 集成 + E2E）
- ✅ 配置文件（.mcp-hub.json 示例）
- ✅ 构建脚本和 npm scripts
- ✅ TypeScript 类型定义

#### 8.7.2 文档交付

- ✅ 本技术规范文档
- ✅ API 文档（自动生成或手动创建）
- ✅ 代码注释和 JSDoc
- ✅ README.md（安装和使用指南）
- ✅ 架构设计文档
- ✅ 开发者指南（CONTRIBUTING.md）

#### 8.7.3 测试交付

- ✅ 单元测试报告（覆盖率 > 90%）
- ✅ 集成测试报告
- ✅ E2E 测试报告
- ✅ 性能测试报告
- ✅ 浏览器兼容性报告

#### 8.7.4 可执行交付

- ✅ 前端构建产物（dist/）
- ✅ 后端构建产物（dist/）
- ✅ 启动脚本（start.sh）
- ✅ Docker 配置（可选）
- ✅ 示例配置文件

---

## 结语

本文档定义了 MCP Hub Lite 第一里程碑的完整技术规范，涵盖了从前端到后端、从数据模型到测试策略的所有关键方面。通过遵循本规范，团队能够开发出一个稳定、可维护、可扩展的 MVP 系统。

**关键原则**：
1. **类型安全第一**：全程使用 TypeScript 严格模式
2. **测试驱动开发**：所有功能必须先有测试
3. **CMD 格式规范**：统一响应格式，提升可维护性
4. **性能优先**：严格控制性能指标
5. **文档先行**：代码与文档同步更新

**成功指标**：
- 代码覆盖率 ≥ 90%
- API 响应时间 < 500ms
- 前端加载时间 < 2s
- 零 TypeScript 编译错误
- 所有自动化检查通过

通过第一里程碑的验证，我们为后续里程碑奠定了坚实的基础，也为 MCP Hub Lite 的长期成功做好了准备。

---

**文档状态**：✅ 完成

**版本历史**：
- v1.0.0 (2025-12-16) - 初始版本，完整技术规范