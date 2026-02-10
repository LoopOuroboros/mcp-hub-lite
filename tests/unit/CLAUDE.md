[根目录](../../CLAUDE.md) > [tests](../) > **unit**

# Unit Tests 模块

## 模块职责

Unit Tests 模块包含单元测试，用于测试代码中的最小可测试单元（函数、类、模块）。

## 目录结构

```
unit/
├── server/                # 服务器运行时单元测试
│   └── runner.test.ts
├── services/              # 服务层单元测试
│   ├── hub-manager-service.test.ts
│   ├── hub-manager.test.ts
│   ├── hub-tools.service.test.ts
│   └── search/            # 搜索服务单元测试
│       ├── search-cache.test.ts
│       ├── search-core.service.test.ts
│       └── search-scorer.test.ts
├── utils/                 # 工具层单元测试
│   ├── config.test.ts
│   ├── logger.test.ts
│   ├── log-rotator.test.ts
│   ├── mcp-error-handler.test.ts
│   └── request-context.test.ts
└── frontend/              # 前端单元测试
    ├── components/         # 组件测试
    │   ├── dashboard.test.ts
    │   └── tool-card.test.ts
    ├── mocks/             # 测试 Mock
    │   └── http.mock.ts
    └── stores/            # Store 测试
        └── server.test.ts
```

## 测试文件

### Server Runner Test (`server/runner.test.ts`)

**被**测模块**: `src/server/runner.ts`

**测试覆盖**:
- HTTP 模式服务器启动
- stdio 模式服务器启动
- 端口冲突检测和处理
- 自动连接启用的服务器
- 信号处理（SIGTERM, SIGINT）
- 启动错误处理
- PID 文件管理

**运行**:
```bash
npx vitest tests/unit/server/runner.test.ts
```

### Hub Manager Service Test (`services/hub-manager-service.test.ts`)

**被测模块**: `src/services/hub-manager.service.ts`

**测试覆盖**:
- 服务器 CRUD 操作
- 自动连接/断开逻辑
- 服务器实例管理
- 错误处理
- 边界条件

**运行**:
```bash
npx vitest tests/unit/services/hub-manager-service.test.ts
```

### Hub Manager API Test (`services/hub-manager.test.ts`)

**被测模块**: `src/api/web/servers.ts` (Web API 路由)

**测试覆盖**:
- 服务器 API 路由功能
- 输入验证
- 服务器 CRUD 操作
- 错误处理

**运行**:
```bash
npx vitest tests/unit/services/hub-manager.test.ts
```

### Hub Tools Service Test (`services/hub-tools.service.test.ts`)

**被测模块**: `src/services/hub-tools.service.ts`

**测试覆盖**:
- 系统工具列表获取
- 服务器列表和查找
- 工具列表和查找
- 工具调用

**运行**:
```bash
npx vitest tests/unit/services/hub-tools.service.test.ts
```

### Search Cache Test (`services/search/search-cache.test.ts`)

**被测模块**: `src/services/search/search-cache.ts`

**测试覆盖**:
- 缓存存储和检索
- 缓存过期
- 缓存清除

**运行**:
```bash
npx vitest tests/unit/services/search/search-cache.test.ts
```

### Search Core Service Test (`services/search/search-core.service.test.ts`)

**被测模块**: `src/services/search/search-core.service.ts`

**测试覆盖**:
- 模糊搜索功能
- 过滤器应用
- 分页处理

**运行**:
```bash
npx vitest tests/unit/services/search/search-core.service.test.ts
```

### Search Scorer Test (`services/search/search-scorer.test.ts`)

**被测模块**: `src/services/search/search-scorer.ts`

**测试覆盖**:
- 工具名称匹配评分
- 工具描述匹配评分
- 标签匹配评分

**运行**:
```bash
npx vitest tests/unit/services/search/search-scorer.test.ts
```

### Config Test (`utils/config.test.ts`)

**被测模块**: `src/config/config-manager.ts`

**测试覆盖**:
- 配置加载和解析
- Schema 验证
- 环境变量覆盖
- 配置更新操作

**运行**:
```bash
npx vitest tests/unit/utils/config.test.ts
```

### Logger Test (`utils/logger.test.ts`)

**被测模块**: `src/utils/logger.ts`

**测试覆盖**:
- 日志级别过滤
- 日志格式化
- 日志输出

**运行**:
```bash
npx vitest tests/unit/utils/logger.test.ts
```

### Log Rotator Test (`utils/log-rotator.test.ts`)

**被测模块**: `src/utils/log-rotator.ts`

**测试覆盖**:
- 日志轮转逻辑
- 文件大小检测
- 日志清理

**运行**:
```bash
npx vitest tests/unit/utils/log-rotator.test.ts
```

### MCP Error Handler Test (`utils/mcp-error-handler.test.ts`)

**被测模块**: `src/utils/mcp-error-handler.ts`

**测试覆盖**:
- MCP 错误转换
- 错误码映射
- 错误格式标准化

**运行**:
```bash
npx vitest tests/unit/utils/mcp-error-handler.test.ts
```

### Request Context Test (`utils/request-context.test.ts`)

**被测模块**: `src/utils/request-context.ts`

**测试覆盖**:
- 异步上下文存储和检索
- 客户端上下文管理
- 工作目录获取
- 上下文隔离和并发处理

**运行**:
```bash
npx vitest tests/unit/utils/request-context.test.ts
```

### Dashboard Component Test (`frontend/components/dashboard.test.ts`)

**被测模块**: `frontend/src/components/DashboardView.vue`

**测试覆盖**:
- 组件渲染
- 服务器列表显示
- 状态处理
- 用户交互

**运行**:
```bash
npx vitest tests/unit/frontend/components/dashboard.test.ts --config vitest.frontend.config.ts
```

### Tool Card Component Test (`frontend/components/tool-card.test.ts`)

**被测模块**: `frontend/src/components/ToolCard.vue`

**测试覆盖**:
- 组件渲染
- 工具信息显示
- 工具调用事件

**运行**:
```bash
npx vitest tests/unit/frontend/components/tool-card.test.ts --config vitest.frontend.config.ts
```

### Server Status Tags Component Test (`frontend/components/server-status-tags.test.ts`)

**被测模块**: `frontend/src/components/ServerStatusTags.vue`

**测试覆盖**:
- 组件渲染
- 服务器状态显示（running/stopped/error/starting）
- 传输类型显示（stdio/sse/streamable-http）
- 版本和 PID 信息显示
- 运行时间显示（可选）
- 不同配置的处理

**运行**:
```bash
npx vitest tests/unit/frontend/components/server-status-tags.test.ts --config vitest.frontend.config.ts
```

### Server Store Test (`frontend/stores/server.test.ts`)

**被测模块**: `frontend/src/stores/server.ts`

**测试覆盖**:
- Server Store 状态管理
- 服务器数据获取
- 状态更新



**运行**:
```bash
npx vitest tests/unit/frontend/stores/server.test.ts --config vitest.frontend.config.ts
```

## 测试框架

- **Vitest**: 单元测试框架
- **@vitest/coverage-v8**: 代码覆盖率工具
- **@vue/test-utils**: Vue 组件测试工具
- **jsdom**: DOM 环境模拟

## 测试配置

### 后端测试配置

配置文件: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true
    }
  }
});
```

### 前端测试配置

配置文件: `vitest.frontend.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: 'tests/unit/frontend/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      all: true
    }
  }
});
```

## 依赖关系

```
unit/
├── server/
│   └── runner.test.ts
│       └── tests: src/server/runner.ts
├── services/
│   ├── hub-manager-service.test.ts
│   │   └── tests: src/services/hub-manager.service.ts
│   ├── hub-manager.test.ts
│   │   └── tests: src/api/web/servers.ts
│   ├── hub-tools.service.test.ts
│   │   └── tests: src/services/hub-tools.service.ts
│   └── search/
│       ├── search-cache.test.ts
│       │   └── tests: src/services/search/search-cache.ts
│       ├── search-core.service.test.ts
│       │   └── tests: src/services/search/search-core.service.ts
│       └── search-scorer.test.ts
│           └── tests: src/services/search/search-scorer.ts
├── utils/
│   ├── config.test.ts
│   │   └── tests: src/config/config-manager.ts
│   ├── logger.test.ts
│   │   └── tests: src/utils/logger.ts
│   ├── log-rotator.test.ts
│   │   └── tests: src/utils/log-rotator.ts
│   ├── mcp-error-handler.test.ts
│   │   └── tests: src/utils/mcp-error-handler.ts
│   └── request-context.test.ts
│       └── tests: src/utils/request-context.ts
└── frontend/
    ├── components/
    │   ├── dashboard.test.ts
    │   │   └── tests: frontend/src/components/DashboardView.vue
    │   └── tool-card.test.ts
    │       └── tests: frontend/src/components/ToolCard.vue
    └── stores/
        └── server.test.ts
            └── tests: frontend/src/stores/server.ts
```

## 测试覆盖目标

| 模块 | 目标覆盖率 | 当前状态 |
|-------|-----------|---------|
| `server/runner` | 80% | 已实现部分 |
| `services/hub-manager.service` | 80% | 部分实现 |
| `api/web/servers` | 80% | 部分实现 |
| `services/hub-tools` | 80% | 部分实现 |
| `services/search/*` | 80% | 已实现 |
| `utils/config` | 80% | 已实现 |
| `utils/logger` | 80% | 已实现 |
| `utils/log-rotator` | 80% | 已实现 |
| `utils/mcp-error-handler` | 80% | 已实现 |
| `utils/request-context` | 100% | 已实现 |
| `models/*` | 80% | 待实现 |
| `api/*` | 70% | 待实现 |
| `cli/*` | 70% | 待实现 |
| `pid/*` | 70% | 待实现 |
| `frontend/components/*` | 70% | 部分实现 |
| `frontend/stores/*` | 70% | 部分实现 |

## 常见问题 (FAQ)

### Q: 如何运行所有单元测试？

A: `npm run test:backend` (仅后端) 或 `npm run test:frontend` (仅前端) 或 `npm test` (全部)

### Q: 如何生成覆盖率报告？

A: `npx vitest --coverage tests/unit/`

### Q: 如何运行特定测试文件？

A: `npx vitest <文件路径>` 或 `npx vitest <文件路径> --config vitest.frontend.config.ts` (前端)

### Q: 如何调试失败的测试？

A: 添加 `.only` 到测试函数，或使用 `--inspect` 参数运行测试。

### Q: 前端测试需要什么配置？

A: 前端测试需要使用 `vitest.frontend.config.ts` 配置文件，该文件配置了 jsdom 环境和 Vue Test Utils。

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `unit/server/runner.test.ts` | 服务器运行器测试 |
| `unit/services/hub-manager-service.test.ts` | Hub Manager 服务单元测试 |
| `unit/services/hub-manager.test.ts` | Hub Manager API 路由测试 |
| `unit/services/hub-tools.service.test.ts` | Hub Tools 服务测试 |
| `unit/services/search/search-cache.test.ts` | 搜索缓存测试 |
| `unit/services/search/search-core.service.test.ts` | 搜索核心服务测试 |
| `unit/services/search/search-scorer.test.ts` | 搜索评分器测试 |
| `unit/utils/config.test.ts` | 配置管理器测试 |
| `unit/utils/logger.test.ts` | Logger 测试 |
| `unit/utils/log-rotator.test.ts` | 日志轮转测试 |
| `unit/utils/mcp-error-handler.test.ts` | MCP 错误处理器测试 |
| `unit/utils/request-context.test.ts` | 请求上下文测试 |
| `unit/frontend/components/dashboard.test.ts` | Dashboard 组件测试 |
| `unit/frontend/components/tool-card.test.ts` | ToolCard 组件测试 |
| `unit/frontend/components/server-status-tags.test.ts` | ServerStatusTags 组件测试 |
| `unit/frontend/stores/server.test.ts` | Server Store 测试 |
| `unit/frontend/mocks/http.mock.ts` | HTTP Mock |
| `unit/frontend/setup.ts` | 前端测试设置 |

## 变更记录 (Changelog)

### 2026-01-29
- 为 utils/logger 模块添加单元测试
- 为 utils/log-rotator 模块添加单元测试
- 为 utils/mcp-error-handler 模块添加单元测试
- 为 frontend/components/Dashboard 组件添加单元测试
- 为 frontend/components/ToolCard 组件添加单元测试
- 为 frontend/stores/server 添加单元测试
- 更新 Unit Tests 模块文档，包含所有新增测试

### 2026-01-20
- 更新 Unit Tests 模块文档
- 添加搜索服务测试文档

### 2026-01-19
- 初始化 Unit Tests 模块文档
