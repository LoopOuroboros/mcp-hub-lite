[根目录](../CLAUDE.md) > **frontend**

# Frontend UI 模块

## 模块职责

Frontend UI 模块基于 Vue 3 实现 Web 界面，提供 MCP 服务器管理、工具搜索、会话管理等功能的可视化操作界面。

## 目录结构

```
frontend/
├── src/
│   ├── components/          # 可复用 UI 组件
│   ├── views/               # 页面视图组件
│   ├── stores/              # Pinia 状态管理
│   ├── router/              # Vue Router 路由配置
│   ├── i18n/                # 国际化支持
│   ├── composables/         # Vue 3 组合式函数
│   ├── utils/               # 工具函数
│   ├── locales/             # 语言包
│   ├── App.vue              # 根组件
│   └── main.ts              # 应用入口
├── index.html               # HTML 模板
└── style.css                # 全局样式
```

## 入口与启动

### 主入口点

- **应用入口**: `frontend/src/main.ts` - Vue 应用初始化
- **根组件**: `frontend/src/App.vue` - 应用根组件
- **HTML 模板**: `frontend/index.html` - 页面模板

### 启动命令

```bash
# 开发模式（热重载）
npm run dev:frontend

# 构建生产版本
npm run build:frontend

# 运行完整开发模式（前后端）
npm run dev
```

## 对外接口

### API 接口

前端通过以下 API 与后端交互：

- **服务器管理**: `/web/servers`
- **工具搜索**: `/web/search`
- **MCP 状态**: `/web/mcp/status`
- **配置管理**: `/web/config`
- **日志获取**: `/web/servers/:id/logs`
- **系统工具**: `/web/hub-tools`
- **会话管理**: `/web/sessions`

### WebSocket 接口

- **实时事件**: 连接 `ws://localhost:7788/ws` 获取实时事件
- **事件类型**:
  - `server:added` - 服务器添加
  - `server:updated` - 服务器更新
  - `server:deleted` - 服务器删除
  - `server:connected` - 服务器连接
  - `server:disconnected` - 服务器断开
  - `tools:updated` - 工具更新
  - `tool:call:completed` - 工具调用完成

## 关键依赖与配置

### 内部依赖

- `frontend/src/stores/` - 状态管理
- `frontend/src/utils/` - 工具函数
- `frontend/src/components/` - UI 组件

### 外部依赖

- **Vue 3**: 前端框架
- **Pinia**: 状态管理
- **Vue Router**: 路由管理
- **Element Plus**: UI 组件库
- **Vue I18n**: 国际化支持
- **@vue/test-utils**: 组件测试工具

### 配置文件

- **Vite 配置**: `vite.config.ts` - 构建和开发服务器配置
- **国际化**: `frontend/src/i18n/` - 语言包和配置
- **路由配置**: `frontend/src/router/index.ts` - 路由定义

## 数据模型

### 服务器状态

```typescript
interface Server {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  type: 'local' | 'remote';
  config: ServerConfig;
  logs: LogEntry[];
  uptime?: string;
  startTime?: number;
  pid?: number;
  tools?: any[];
  resources?: any[];
  toolsCount?: number;
  resourcesCount?: number;
  version?: string;
}
```

### 会话信息

```typescript
interface SessionInfo {
  sessionId: string;
  clientName?: string;
  clientVersion?: string;
  cwd?: string;
  project?: string;
  createdAt: number;
  lastAccessedAt: number;
}
```

### 工具信息

```typescript
interface Tool {
  title: string; // 工具名称
  description?: string; // 工具描述
  serverId?: string; // 所属服务器 ID
  inputSchema?: any; // 输入参数 Schema
}
```

## 测试与质量

### 测试结构

```
tests/unit/frontend/
├── components/         # 组件测试
├── stores/             # Store 测试
└── mocks/              # 测试 Mock
```

### 测试覆盖

- **组件测试**: Dashboard、ToolCard、ServerStatusTags、ToolCallDialog
- **Store 测试**: Server Store
- **覆盖率**: 部分实现，需要完善其他组件测试

### 运行测试

```bash
# 运行前端测试
npm run test:frontend

# 使用 Vitest 直接运行（带颜色输出）
npx vitest --config vitest.frontend.config.ts
```

## 常见问题 (FAQ)

### Q: 如何添加新的页面？

A: 1. 在 `views/` 目录创建新的 Vue 组件 2. 在 `router/index.ts` 中注册路由 3. 确保正确导入和使用

### Q: 如何处理国际化文本？

A: 使用 Vue I18n 的 `$t()` 函数：

```vue
<template>
  <h1>{{ $t('welcome.message') }}</h1>
</template>
```

语言包位于 `frontend/src/locales/` 目录。

### Q: 如何在组件中使用状态管理？

A: 使用 Pinia Store：

```typescript
import { useServerStore } from '@/stores/server';

const serverStore = useServerStore();
console.log(serverStore.servers);
```

### Q: 如何处理 API 错误？

A: 使用 `utils/http.ts` 中的错误处理：

```typescript
import { apiGet, apiPost } from '@/utils/http';

try {
  const servers = await apiGet('/web/servers');
} catch (error) {
  // 处理错误
  console.error('Failed to fetch servers:', error);
}
```

## 相关文件清单

| 文件路径                        | 描述           |
| ------------------------------- | -------------- |
| `frontend/src/main.ts`          | 应用入口       |
| `frontend/src/App.vue`          | 根组件         |
| `frontend/src/router/index.ts`  | 路由配置       |
| `frontend/src/stores/server.ts` | 服务器状态管理 |
| `frontend/src/components/`      | UI 组件        |
| `frontend/src/views/`           | 页面视图       |

## 变更记录 (Changelog)

### 2026-02-16

- 更新 Frontend UI 模块文档
- 完善会话管理相关文档
- 添加数据模型说明
- 更新测试覆盖信息

### 2026-02-15

- 新增会话管理页面文档
- 更新路由配置说明
- 添加国际化支持文档

### 2026-02-05

- 初始化 Frontend UI 模块文档
