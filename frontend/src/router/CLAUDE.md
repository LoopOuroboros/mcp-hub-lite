[根目录](../../../CLAUDE.md) > [frontend](../) > [src](../) > **router**

# Router 模块

## 模块职责

Router 模块负责前端路由管理，使用 Vue Router 实现单页应用（SPA）的客户端路由。

## 核心文件

### Index (`index.ts`)

**职责**: Vue Router 配置和初始化

**主要功能**:

- 定义应用路由配置
- 配置路由守卫（如果需要）
- 创建和导出 router 实例

**路由配置**:

- `/` - 主页 (HomeView)
- `/servers` - 服务器仪表板 (ServerDashboard)
- `/tools` - 工具列表 (ToolsView)
- `/sessions` - 会话管理 (SessionsView)
- `/settings` - 系统设置 (SettingsView)

**依赖**:

- `vue-router` - Vue Router 库
- View 组件 - 各个页面视图组件

## 依赖关系

```
router/
└── index.ts
    ├── depends on: ../views/HomeView.vue
    ├── depends on: ../views/ServerDashboard.vue
    ├── depends on: ../views/ToolsView.vue
    ├── depends on: ../views/SessionsView.vue
    └── depends on: ../views/SettingsView.vue
```

## 集成方式

Router 模块在 `frontend/src/main.ts` 中被初始化和使用：

```typescript
import router from './router';
// ...
app.use(router);
```

## 测试与质量

Router 模块目前没有专门的单元测试，主要通过端到端测试验证路由功能。

## 常见问题 (FAQ)

### Q: 如何添加新页面？

A: 1. 在 `views/` 目录下创建新的 Vue 组件 2. 在 `router/index.ts` 中添加新的路由配置 3. 确保组件正确导入并注册到路由

### Q: 如何实现路由守卫？

A: 在 `router/index.ts` 中使用 Vue Router 的导航守卫：

- `beforeEach` - 全局前置守卫
- `beforeResolve` - 全局解析守卫
- `afterEach` - 全局后置钩子

## 相关文件清单

| 文件路径          | 描述            |
| ----------------- | --------------- |
| `router/index.ts` | Vue Router 配置 |

## 变更记录 (Changelog)

### 2026-02-16

- 将 ClientsView 重命名为 SessionsView，路由路径从 `/clients` 更新为 `/sessions`

### 2026-01-29

- 初始化 Router 模块文档
