[根目录](../../../CLAUDE.md) > [frontend](../../) > [src](../) > **views**

# Views 模块

## 模块职责

Views 模块包含页面视图组件，是前端应用的主要页面展示层。

## 目录结构

```
views/
├── HomeView.vue          # 主页视图（根路由容器）
├── ServerDashboard.vue    # 服务器仪表板
├── ToolsView.vue        # 工具浏览和搜索页面
└── SettingsView.vue      # 设置页面
```

## 视图组件

### HomeView (`HomeView.vue`)

**职责**: 根路由容器，根据选择状态渲染仪表板或服务器详情

**功能**:
- 检测是否选择了服务器
- 动态渲染 `Dashboard` 或 `ServerDetail` 组件

### ServerDashboard (`ServerDashboard.vue`)

**职责**: 服务器仪表板视图（已被 HomeView 替代，此组件现在作为 HomeView 的内部渲染目标）

**功能**:
- 切换仪表板和服务器详情视图

### ToolsView (`ToolsView.vue`)

**职责**: 工具浏览和搜索页面

**主要功能**:
- 系统工具展示（list-servers、find-servers 等）
- 聚合工具展示（按服务器分组）
- 工具搜索
- 工具调用对话框

**组件结构**:
```
ToolsView
├── SystemTools Section
│   └── ToolCard (xN)
├── Aggregated Tools Section
│   └── Server Group
│       ├── Server Header
│       └── ToolCard (xN)
└── ToolCallDialog (Dialog)
```

**状态管理**:
```typescript
{
  searchQuery: string              // 搜索关键词
  searchResults: SearchResult[]     // 搜索结果
  systemTools: Tool[]             // 系统工具列表
  selectedTool: Tool | null       // 当前选中的工具
  collapsedServers: Set<string>   // 折叠的服务器集合
  collapsedSystemTools: boolean    // 系统工具折叠状态
}
```

**依赖**:
- `useServerStore` - 获取服务器状态
- `/web/hub-tools/system` - 获取系统工具列表
- `/web/search` - 搜索工具
- `ToolCard` - 工具卡片组件
- `ToolCallDialog` - 工具调用对话框组件

### SettingsView (`SettingsView.vue`)

**职责**: 系统设置页面

**主要功能**:
- 日志配置（级别、轮转、压缩）
- 安全配置（允许的网络、连接限制）

**配置项**:

| 配置项 | 类型 | 默认值 | 描述 |
|---------|------|---------|------|
| `logging.level` | string | 'info' | 日志级别 |
| `logging.rotation.enabled` | boolean | true | 启用日志轮转 |
| `logging.rotation.maxAge` | string | '7d' | 日志最大保留时间 |
| `logging.rotation.maxSize` | string | '100MB' | 日志最大文件大小 |
| `logging.rotation.compress` | boolean | false | 是否压缩日志 |
| `security.allowedNetworks` | string[] | [] | 允许的网络 CIDR |
| `security.maxConcurrentConnections` | number | 50 | 最大并发连接数 |
| `security.maxConnections` | number | 50 | 最大连接数 |
| `security.connectionTimeout` | number | 30000 | 连接超时 (ms) |
| `security.idleConnectionTimeout` | number | 300000 | 空闲连接超时 (ms) |

**依赖**:
- `/web/config` - 配置 API
- Element Plus 组件

## 路由配置

路由定义在 `frontend/src/router/index.ts`：

```typescript
const routes = [
  {
    path: '/',
    component: HomeView,
    children: [
      { path: '', name: 'dashboard', component: ServerDashboard },
      { path: 'tools', name: 'tools', component: ToolsView },
      { path: 'settings', name: 'settings', component: SettingsView }
    ]
  }
]
```

## 依赖关系

```
views/
├── HomeView.vue
│   └── depends on: Dashboard.vue, ServerDetail.vue, useServerStore
│
├── ServerDashboard.vue
│   └── depends on: Dashboard.vue, ServerDetail.vue, useServerStore
│
├── ToolsView.vue
│   ├── depends on: ToolCard.vue, ToolCallDialog.vue
│   ├── depends on: useServerStore
│   └── uses API: /web/hub-tools/system, /web/search
│
└── SettingsView.vue
    └── uses API: /web/config
```

## 测试与质量

### 单元测试

**状态**: 待添加

**建议测试**:
- 组件渲染测试
- 搜索功能测试
- 工具调用测试
- 配置保存测试

## 常见问题 (FAQ)

### Q: 如何添加新的视图页面？

A: 在 `views/` 目录创建新的 Vue 组件，然后在 `router/index.ts` 中注册路由。

### Q: 如何在视图中使用国际化的文本？

A: 使用 `useI18n()` 钩子获取 `t` 函数，然后在模板中使用 `$t('key')`。

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `views/HomeView.vue` | 主页视图 |
| `views/ServerDashboard.vue` | 服务器仪表板 |
| `views/ToolsView.vue` | 工具浏览和搜索页面 |
| `views/SettingsView.vue` | 设置页面 |

`../router/index.ts` | 路由配置 |

## 变更记录 (Changelog)

### 2026-01-20
- 初始化 Views 模块文档
