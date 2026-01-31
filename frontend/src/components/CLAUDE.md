[根目录](../../../CLAUDE.md) > [frontend](../../) > [src](../) > **components**

# Components 模块

## 模块职责

Components 模块包含可复用的 Vue 3 UI 组件，是前端应用的组件层。

## 目录结构

```
components/
├── Dashboard.vue         # 服务器仪表板组件
├── ServerDetail.vue      # 服务器详情组件
├── Sidebar.vue           # 侧边栏组件
├── Header.vue            # 头部组件
├── AddServerModal.vue    # 添加服务器对话框
├── ToolCard.vue          # 工具卡片组件
├── ToolCallDialog.vue    # 工具调用对话框
└── ServerStatusTags.vue  # 服务器状态标签组件
```

## 组件列表

### Dashboard (`Dashboard.vue`)

**职责**: 显示服务器统计和最近活动

**主要功能**:
- 服务器统计卡片（总数、运行中、错误数）
- 最近活动列表（显示服务器日志）

**状态**:
```typescript
{
  stats: { total: number; running: number; errors: number }
  activities: Activity[]
}
```

**依赖**:
- `useServerStore` - 获取服务器和日志数据
- Element Plus 图标组件

### ServerDetail (`ServerDetail.vue`)

**职责**: 显示和编辑单个服务器的详细信息

**主要功能**:
- 服务器头部（状态、版本、PID、运行时间）
- 服务器操作（重启、启动、停止、删除）
- 配置标签页（编辑传输、命令、参数、环境变量）
- 日志标签页（查看服务器日志、自动滚动）
- 工具标签页（查看可用工具、工具可见性控制）
- 资源标签页（查看服务器资源）

**配置编辑**:
- 支持表单编辑和 JSON 编辑两种方式
- 环境变量动态添加/删除
- 命令参数动态添加/删除
- 工具可见性开关控制（允许全部或仅允许指定工具）

**状态**:
```typescript
{
  activeTab: 'config' | 'logs' | 'tools' | 'resources'
  autoScroll: boolean
  selectedTool: Tool | null
}
```

**依赖**:
- `useServerStore` - 服务器数据管理
- `ToolCallDialog` - 工具调用对话框
- Element Plus 组件

### Sidebar (`Sidebar.vue`)

**职责**: 应用侧边栏导航

**主要功能**:
- 导航菜单项（仪表板、工具、设置）
- 响应式折叠（移动端）

### Header (`Header.vue`)

**职责**: 应用头部

**主要功能**:
- 标题显示
- 状态指示
- 主题切换
- 语言切换

### AddServerModal (`AddServerModal.vue`)

**职责**: 添加新服务器的对话框

**主要功能**:
- 表单输入验证
- 支持多种传输类型
- 环境变量配置

### ToolCard (`ToolCard.vue`)

**职责**: 工具卡片展示组件

**Props**:
```typescript
interface Props {
  title: string          // 工具名称
  description?: string  // 工具描述
  tagName?: string     // 标签文本（服务器名称）
  tagClass?: string    // 标签样式类
}
```

**Emits**:
```typescript
{
  (e: 'call'): void  // 点击调用按钮时触发
}
```

**依赖**:
- `useI18n` - 国际化支持

### ToolCallDialog (`ToolCallDialog.vue`)

**职责**: 工具调用对话框

**Props**:
```typescript
interface Props {
  modelValue: boolean     // 对话框显示状态
  serverId?: string      // 服务器 ID（用于特定服务器工具）
  toolName: string       // 工具名称
  description?: string    // 工具描述
  inputSchema?: any       // 工具参数 Schema
}
```

**主要功能**:
- 自动根据 Schema 生成参数模板
- JSON 参数编辑和格式化
- 执行工具调用
- 显示执行结果或错误

**调用逻辑**:
- 如果提供 `serverId`，调用特定服务器的工具
- 否则，调用系统工具

**依赖**:
- `/web/hub-tools/servers/:serverId/tools/:toolName/call` - 服务器工具 API
- `/web/hub-tools/system/:toolName/call` - 系统工具 API

### ServerStatusTags (`ServerStatusTags.vue`)

**职责**: 显示服务器状态相关的标签信息

**Props**:
```typescript
interface Props {
  server: {
    status: string
    version?: string
    pid?: number | null
    config: {
      type: string
      command?: string
      url?: string
    }
    startTime?: number
  }
  includeUptime?: boolean  // 是否包含运行时间显示
}
```

**主要功能**:
- 显示服务器状态（running/stopped/error/starting）
- 显示传输类型和相关信息（stdio/sse/streamable-http）
- 显示服务器版本信息
- 显示 PID 信息（仅 stdio 类型）
- 可选显示运行时间

**依赖**:
- `useI18n` - 国际化支持
- `format-utils.js` - 格式化工具函数

## 依赖关系

```
components/
├── Dashboard.vue
│   └── depends on: useServerStore
│
├── ServerDetail.vue
│   ├── depends on: useServerStore
│   └── uses: ToolCallDialog
│
├── ToolCard.vue
│   └── depends on: useI18n
│
├── ToolCallDialog.vue
│   └── uses API: /web/hub-tools/*
│
├── Sidebar.vue
│   └── depends on: useI18n
│
├── Header.vue
│   └── depends on: useI18n, useTheme
│
└── ServerStatusTags.vue
    └── depends on: useI18n, format-utils.js
```

## 测试与质量

### 单元测试

**状态**: 已实现 Dashboard 和 ToolCard 组件测试

**已实现测试**:
- Dashboard 组件：服务器统计卡片、加载状态、活动日志显示
- ToolCard 组件：标题/描述渲染、标签显示、点击事件触发

**建议测试**:
- ServerDetail 组件测试
- ToolCallDialog 组件测试
- 其他组件的完整测试覆盖

## 常见问题 (FAQ)

### Q: 如何添加新组件？

A: 在 `components/` 目录创建新的 Vue 文件，导出后在需要的地方导入使用。

### Q: 如何使用国际化文本？

A: 使用 `useI18n()` 钩子获取 `t` 函数，然后在模板中使用 `$t('key')`。

### Q: 工具调用对话框如何处理系统工具和服务器工具？

A: 通过 `serverId` Props 区分：
- 有 `serverId`：调用 `/web/hub-tools/servers/{serverId}/tools/{toolName}/call`
- 无 `serverId`：调用 `/web/hub-tools/system/{toolName}/call`

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `components/Dashboard.vue` | 服务器仪表板 |
| `components/ServerDetail.vue` | 服务器详情 |
| `components/Sidebar.vue` | 侧边栏 |
| `components/Header.vue` | 头部 |
| `components/AddServerModal.vue` | 添加服务器对话框 |
| `components/ToolCard.vue` | 工具卡片 |
| `components/ToolCallDialog.vue` | 工具调用对话框 |
| `components/ServerStatusTags.vue` | 服务器状态标签组件 |

## 变更记录 (Changelog)

### 2026-01-20
- 初始化 Components 模块文档
