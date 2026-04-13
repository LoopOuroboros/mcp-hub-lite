[根目录](../../../CLAUDE.md) > [frontend](../) > [src](../) > **router**

# Router 模块

## 模块职责

Router 模块负责前端路由管理，使用 Vue Router 实现单页应用（SPA）的客户端路由，采用嵌套路由结构，所有功能页面都作为 HomeView 的子路由。

## 核心文件

### Index (`index.ts`)

**职责**: Vue Router 配置和初始化

**主要功能**:

- 定义应用路由配置
- 使用嵌套路由结构（所有功能页面作为 HomeView 的子路由
- 配置懒加载组件（动态 import）
- 创建和导出 router 实例

**路由配置**:

```
/ (HomeView)
├── / - 服务器仪表板 (ServerDashboard)
├── /servers - 服务器列表 (ServerListView)
├── /servers/:name - 服务器详情 (ServerDetail) [redirect to config]
│   ├── /servers/:name/config - 服务器配置 (ServerDetail)
│   ├── /servers/:name/tools - 服务器工具 (ServerDetail)
│   └── /servers/:name/resources - 服务器资源 (ServerDetail)
├── /tools - 工具列表 (ToolsView)
├── /resources - 资源列表 (ResourcesView)
├── /sessions - 会话管理 (SessionsView)
├── /servers/:name/resources/detail - 资源详情 (ResourceDetailView)
└── /settings - 系统设置 (SettingsView)
```

**详细路由表**:

| 路径                              | 路由名称                | 组件               | 描述               |
| --------------------------------- | ----------------------- | ------------------ | ------------------ |
| `/`                               | -                       | HomeView           | 根布局             |
| `/` (子路由)                      | dashboard               | ServerDashboard    | 服务器仪表板       |
| `/servers`                        | servers                 | ServerListView     | 服务器列表         |
| `/servers/:name`                  | server-detail           | ServerDetail       | 服务器详情(重定向) |
| `/servers/:name/config`           | server-detail-config    | ServerDetail       | 服务器配置         |
| `/servers/:name/tools`            | server-detail-tools     | ServerDetail       | 服务器工具         |
| `/servers/:name/resources`        | server-detail-resources | ServerDetail       | 服务器资源         |
| `/tools`                          | tools                   | ToolsView          | 工具列表           |
| `/resources`                      | resources               | ResourcesView      | 资源列表           |
| `/sessions`                       | sessions                | SessionsView       | 会话管理           |
| `/servers/:name/resources/detail` | resource-detail         | ResourceDetailView | 资源详情           |
| `/settings`                       | settings                | SettingsView       | 系统设置           |

**依赖**:

- `vue-router` - Vue Router 库
- View 组件 - 各个页面视图组件

## 目录结构

```
router/
└── index.ts              # Vue Router 配置
```

## 依赖关系

```
router/
└── index.ts
    ├── depends on: ../views/HomeView.vue
    ├── depends on: ../views/ServerDashboard.vue
    ├── depends on: ../views/ServerListView.vue
    ├── depends on: ../views/ToolsView.vue
    ├── depends on: ../views/ResourcesView.vue
    ├── depends on: ../views/ResourceDetailView.vue
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

A: 1. 在 `views/` 目录下创建新的 Vue 组件 2. 在 `router/index.ts` 中添加新的路由配置（作为 HomeView 的子路由） 3. 确保组件正确导入并注册到路由

### Q: 如何实现路由守卫？

A: 在 `router/index.ts` 中使用 Vue Router 的导航守卫：

- `beforeEach` - 全局前置守卫
- `beforeResolve` - 全局解析守卫
- `afterEach` - 全局后置钩子

## 相关文件清单

| 文件路径          | 描述            |
| ----------------- | --------------- |
| `router/index.ts` | Vue Router 配置 |
