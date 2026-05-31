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
│   ├── gateway-logging.test.ts
│   ├── gateway-session-mode.test.ts
│   └── hub-tools/         # Hub Tools 子模块测试
│       └── instance-selector.test.ts
├── cli/                   # CLI 单元测试
│   ├── basic-cli.test.ts
│   ├── cli.test.ts
│   ├── commands.test.ts
│   └── server.test.ts
├── config/                # 配置模块单元测试
│   ├── config-migrator.test.ts
│   ├── config-saver.test.ts
│   └── config.schema.test.ts
├── utils/                 # 工具层单元测试
│   ├── config.test.ts
│   ├── logger.test.ts
│   ├── log-output.test.ts
│   ├── log-rotator.test.ts
│   ├── json-utils.test.ts
│   ├── name-converter.test.ts
│   ├── network-security.test.ts
│   ├── sort-utils.test.ts
│   └── transport-factory.test.ts
└── frontend/              # 前端单元测试
    ├── components/         # 组件测试
    │   ├── dashboard.test.ts
    │   ├── tool-card.test.ts
    │   ├── server-detail-header.test.ts
    │   ├── server-status-tags.test.ts
    │   └── tool-call-dialog.test.ts
    ├── mocks/             # 测试 Mock
    │   └── http.mock.ts
    └── stores/            # Store 测试
        └── server.test.ts
```

## 测试文件

### Server Runner Test (`server/runner.test.ts`)

**被**测模块\*\*: `src/server/runner.ts`

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
- 服务器列表和查找（listServers() 方法仅返回已连接的服务器
- 工具列表和查找
- 工具调用

**最近更新**:

- 添加了对 listServers() 只返回 Connected 服务器的测试
- 添加了 getServerDescription() 通用方法的测试
- 验证 Disconnected 服务器不会出现在结果中

**运行**:

```bash
npx vitest tests/unit/services/hub-tools.service.test.ts
```

### Config Schema Test (`config/config.schema.test.ts`)

**被测模块**: `src/config/config.schema.ts`

**测试覆盖**:

- v1.0 配置 Schema 验证
- v1.1 配置 Schema 验证
- 版本检测函数 (`isV1Config`, `isV1_1Config`)
- 默认值验证
- 边界条件测试

**运行**:

```bash
npx vitest tests/unit/config/config.schema.test.ts
```

### Config Migrator Test (`config/config-migrator.test.ts`)

**被测模块**: `src/config/config-migrator.ts`

**测试覆盖**:

- v1.0 → v1.1 配置迁移
- 迁移验证和备份
- 干运行模式 (Dry Run)
- 回滚功能
- 实例配置解析
- v1.1 → v1.0 向后兼容性
- 模板 + 实例架构转换
- 迁移状态检查

**运行**:

```bash
npx vitest tests/unit/config/config-migrator.test.ts
```

### Config Saver Test (`config/config-saver.test.ts`)

**被测模块**: `src/config/config-saver.ts`

**测试覆盖**:

- 配置文件保存功能
- 空值清理功能（空字符串、空数组、空对象、null、undefined）
- 嵌套对象递归清理
- version 字段保留逻辑
- 真实配置场景测试
- 错误处理

**运行**:

```bash
npx vitest tests/unit/config/config-saver.test.ts
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

### Log Output Test (`utils/log-output.test.ts`)

**被测模块**: `src/utils/logger/log-output.ts`

**测试覆盖**:

- `hasDataUriImage()` — data:image data URI 检测（png/jpeg/svg）
- `simplifyDataUriImages()` — base64 负载替换为 `[Truncated]`，多 URI 处理
- `simplifyImageContent()` — MCP image content 块替换
- `isToolsListResponse()` — tools/list、resources/list 检测（不含 capabilities）
- `formatMcpMessageForLogging()` — 检测链优先级：tools/list → image content → data URI → 完整 JSON
- initialize 响应含 icons 的 data URI 截断验证

**运行**:

```bash
npx vitest tests/unit/utils/log-output.test.ts
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
│   ├── gateway-logging.test.ts
│   │   └── tests: src/services/gateway/
│   ├── gateway-session-mode.test.ts
│   │   └── tests: src/services/gateway/session-manager.ts
│   └── hub-tools/
│       └── instance-selector.test.ts
│           └── tests: src/services/hub-tools/instance-selector.ts
├── cli/
│   ├── basic-cli.test.ts
│   ├── cli.test.ts
│   ├── commands.test.ts
│   └── server.test.ts
│       └── tests: src/cli/
├── config/
│   ├── config-migrator.test.ts
│   │   └── tests: src/config/config-migrator.ts
│   ├── config-saver.test.ts
│   │   └── tests: src/config/config-saver.ts
│   └── config.schema.test.ts
│       └── tests: src/config/config.schema.ts
├── utils/
│   ├── config.test.ts
│   │   └── tests: src/config/config-manager.ts
│   ├── logger.test.ts
│   │   └── tests: src/utils/logger.ts
│   ├── log-output.test.ts
│   │   └── tests: src/utils/logger/log-output.ts
│   ├── log-rotator.test.ts
│   │   └── tests: src/utils/log-rotator.ts
│   ├── json-utils.test.ts
│   │   └── tests: src/utils/json-utils.ts
│   ├── name-converter.test.ts
│   │   └── tests: src/utils/name-converter.ts
│   ├── network-security.test.ts
│   │   └── tests: src/utils/network-security.ts
│   ├── sort-utils.test.ts
│   │   └── tests: src/utils/sort-utils.ts
│   └── transport-factory.test.ts
│       └── tests: src/utils/transports/transport-factory.ts
└── frontend/
    ├── components/
    │   ├── dashboard.test.ts
    │   │   └── tests: frontend/src/components/DashboardView.vue
    │   ├── tool-card.test.ts
    │   │   └── tests: frontend/src/components/ToolCard.vue
    │   ├── server-detail-header.test.ts
    │   │   └── tests: frontend/src/components/ServerDetailHeader.vue
    │   ├── server-status-tags.test.ts
    │   │   └── tests: frontend/src/components/ServerStatusTags.vue
    │   └── tool-call-dialog.test.ts
    │       └── tests: frontend/src/components/ToolCallDialog.vue
    └── stores/
        └── server.test.ts
            └── tests: frontend/src/stores/server.ts
```

## 测试覆盖目标

| 模块                                   | 目标覆盖率 | 当前状态   |
| -------------------------------------- | ---------- | ---------- |
| `server/runner`                        | 80%        | 已实现部分 |
| `services/hub-manager.service`         | 80%        | 部分实现   |
| `api/web/servers`                      | 80%        | 部分实现   |
| `services/hub-tools`                   | 80%        | 部分实现   |
| `services/gateway`                     | 80%        | 部分实现   |
| `services/hub-tools/instance-selector` | 80%        | 已实现     |
| `cli/*`                                | 70%        | 已实现部分 |
| `utils/config`                         | 80%        | 已实现     |
| `utils/logger`                         | 80%        | 已实现     |
| `utils/log-rotator`                    | 80%        | 已实现     |
| `utils/json-utils`                     | 80%        | 已实现     |
| `utils/name-converter`                 | 80%        | 已实现     |
| `utils/network-security`               | 80%        | 已实现     |
| `utils/sort-utils`                     | 80%        | 已实现     |
| `utils/transport-factory`              | 80%        | 已实现     |
| `models/*`                             | 80%        | 部分实现   |
| `api/*`                                | 70%        | 待实现     |
| `pid/*`                                | 70%        | 待实现     |
| `frontend/components/*`                | 70%        | 部分实现   |
| `frontend/stores/*`                    | 70%        | 部分实现   |

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

| 文件路径                                                | 描述                        |
| ------------------------------------------------------- | --------------------------- |
| `unit/server/runner.test.ts`                            | 服务器运行器测试            |
| `unit/services/hub-manager-service.test.ts`             | Hub Manager 服务单元测试    |
| `unit/services/hub-manager.test.ts`                     | Hub Manager API 路由测试    |
| `unit/services/hub-tools.service.test.ts`               | Hub Tools 服务测试          |
| `unit/services/gateway-logging.test.ts`                 | Gateway 日志测试            |
| `unit/services/gateway-session-mode.test.ts`            | Gateway 会话模式测试        |
| `unit/services/hub-tools/instance-selector.test.ts`     | 实例选择器测试              |
| `unit/cli/basic-cli.test.ts`                            | CLI 基础测试                |
| `unit/cli/cli.test.ts`                                  | CLI 测试                    |
| `unit/cli/commands.test.ts`                             | CLI 命令测试                |
| `unit/cli/server.test.ts`                               | CLI 服务器测试              |
| `unit/config/config.schema.test.ts`                     | 配置 Schema 测试            |
| `unit/config/config-migrator.test.ts`                   | 配置迁移器测试              |
| `unit/config/config-saver.test.ts`                      | Config Saver 空值清理测试   |
| `unit/utils/config.test.ts`                             | 配置管理器测试              |
| `unit/utils/logger.test.ts`                             | Logger 测试                 |
| `unit/utils/log-output.test.ts`                         | Log Output 测试             |
| `unit/utils/log-rotator.test.ts`                        | 日志轮转测试                |
| `unit/utils/json-utils.test.ts`                         | JSON 工具测试               |
| `unit/utils/name-converter.test.ts`                     | 名称转换器测试              |
| `unit/utils/network-security.test.ts`                   | 网络安全测试                |
| `unit/utils/sort-utils.test.ts`                         | 排序工具测试                |
| `unit/utils/transport-factory.test.ts`                  | 传输工厂测试                |
| `unit/frontend/components/dashboard.test.ts`            | Dashboard 组件测试          |
| `unit/frontend/components/tool-card.test.ts`            | ToolCard 组件测试           |
| `unit/frontend/components/server-detail-header.test.ts` | ServerDetailHeader 组件测试 |
| `unit/frontend/components/server-status-tags.test.ts`   | ServerStatusTags 组件测试   |
| `unit/frontend/components/tool-call-dialog.test.ts`     | ToolCallDialog 组件测试     |
| `unit/frontend/stores/server.test.ts`                   | Server Store 测试           |
| `unit/frontend/mocks/http.mock.ts`                      | HTTP Mock                   |
| `unit/frontend/setup.ts`                                | 前端测试设置                |
