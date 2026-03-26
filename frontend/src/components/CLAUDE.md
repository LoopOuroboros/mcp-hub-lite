[根目录](../../../CLAUDE.md) > [frontend](../../) > [src](../) > **components**

# Components 模块

## 模块职责

Components 模块包含可复用的 Vue 3 UI 组件，是前端应用的组件层。

## 目录结构

```
components/
├── DashboardView.vue             # 服务器仪表板组件
├── ServerDetail.vue              # 服务器详情组件（协调器）
├── ServerDetailHeader.vue        # 服务器详情头部组件
├── ConfigTemplateForm.vue        # 配置模板表单组件
├── LogViewer.vue                 # 日志查看器组件
├── ToolsTab.vue                  # 工具标签页组件
├── ResourcesTab.vue              # 资源标签页组件
├── JsonConfigEditor.vue          # JSON 配置编辑器组件
├── InstanceSelectDialog.vue      # 实例选择对话框组件
├── MergedConfigPreviewDialog.vue # 合并配置预览对话框组件
├── HeaderView.vue                # 头部组件
├── AddServerModal.vue            # 添加服务器对话框
├── ToolCard.vue                  # 工具卡片组件
├── ToolCallDialog.vue            # 工具调用对话框
├── ServerStatusTags.vue          # 服务器状态标签组件
├── InstanceCardList.vue          # 实例卡片列表组件
├── InstanceConfig.vue            # 实例配置组件
└── ResourceCard.vue              # 资源卡片组件
```

## 组件列表

### Dashboard (`DashboardView.vue`)

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

**职责**: 服务器详情协调器组件，整合所有子组件

**主要功能**:

- 路由同步和状态管理（通过 useServerSelection composable）
- 实例操作和状态管理（通过 useServerInstances composable）
- 对话框状态管理（通过 useToolAndResourceDialogs composable）
- 子组件之间的协调
- Store 交互
- 配置保存和删除操作

**状态管理**:

- 使用 `useServerSelection` 管理 Tab 和实例选择状态
- 使用 `useServerInstances` 管理实例操作和状态
- 使用 `useToolAndResourceDialogs` 管理工具调用和资源查看对话框

**依赖**:

- `useServerStore` - 服务器数据管理
- `useServerSelection` - 路由和选择状态管理 composable
- `useServerInstances` - 实例操作 composable
- `useToolAndResourceDialogs` - 对话框管理 composable
- `@/types/server-detail` - 共享类型定义
- `@/utils/format-utils` - 共享工具函数
- 所有 ServerDetail 子组件

**子组件**:

- ServerDetailHeader
- ConfigTemplateForm
- LogViewer
- ToolsTab
- ResourcesTab
- JsonConfigEditor
- InstanceSelectDialog
- InstanceCardList
- InstanceConfig

**重构历史**:

- 2026-03-26: 从 1053 行重构为约 500 行，提取 3 个 composables

### ServerDetailHeader (`ServerDetailHeader.vue`)

**职责**: 显示服务器信息和操作按钮

**Props**:

```typescript
interface Props {
  server: Server;
  formattedUptime: string;
}
```

**Emits**:

```typescript
{
  (e: 'back'): void;
  (e: 'restart'): void;
  (e: 'start'): void;
  (e: 'stop'): void;
  (e: 'delete'): void;
}
```

**主要功能**:

- 返回按钮
- 服务器名称标题（带版本号 Tag）
- ServerStatusTags 组件
- 操作按钮（重启、启动、停止、删除）

**依赖**:

- ServerStatusTags
- Element Plus 图标和 Tag 组件

**版本号显示**:

- 版本号以 Element Plus Tag 组件形式显示在服务器名称右侧
- 使用 `size="small"` 样式
- 直接显示版本号内容，无前缀文字

### ConfigTemplateForm (`ConfigTemplateForm.vue`)

**职责**: 编辑服务器配置模板

**Props**:

```typescript
interface Props {
  config: ServerConfig;
}
```

**Emits**:

```typescript
{
  (e: 'update:config', config: ServerConfig): void;
  (e: 'save'): void;
  (e: 'edit-json'): void;
}
```

**主要功能**:

- 传输类型选择
- 命令/URL 输入
- 参数动态列表
- 环境变量动态列表
- 请求头动态列表
- 超时设置
- 描述输入
- 保存按钮和 JSON 编辑按钮

**注意**: 自动启动（autoStart/enabled）配置已移至实例级别配置，不再在模板级别配置。

### LogViewer (`LogViewer.vue`)

**职责**: 显示和操作日志

**Props**:

```typescript
interface Props {
  logs: LogEntry[];
  autoScroll?: boolean;
}
```

**Emits**:

```typescript
{
  (e: 'update:autoScroll', value: boolean): void;
  (e: 'clear'): void;
  (e: 'copy'): void;
}
```

**主要功能**:

- 自动滚动开关
- 清除日志按钮
- 复制日志按钮
- 日志显示区域
- 日志级别颜色样式

### ToolsTab (`ToolsTab.vue`)

**职责**: 显示和管理服务器工具

**Props**:

```typescript
interface Props {
  tools: Tool[];
  allowedTools?: string[] | null;
}
```

**Emits**:

```typescript
{
  (e: 'select-tool', tool: Tool): void;
  (e: 'update-tool-visibility', toolName: string, enabled: boolean): void;
  (e: 'call-tool', tool: Tool): void;
}
```

**主要功能**:

- 工具列表（左侧）
- 工具详情（右侧）
- 工具可见性开关
- 工具调用按钮

### ResourcesTab (`ResourcesTab.vue`)

**职责**: 显示服务器资源

**Props**:

```typescript
interface Props {
  resources: Resource[] | undefined;
}
```

**Emits**:

```typescript
{
  (e: 'view-resource', resource: Resource): void;
}
```

**主要功能**:

- 资源表格
- 查看资源按钮

### JsonConfigEditor (`JsonConfigEditor.vue`)

**职责**: JSON 格式配置编辑对话框

**Props**:

```typescript
interface Props {
  modelValue: boolean;
  config: ServerConfig;
  serverName: string;
}
```

**Emits**:

```typescript
{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', config: ServerConfig): void;
}
```

**主要功能**:

- 对话框
- JSON 文本域
- 保存/取消按钮

### InstanceSelectDialog (`InstanceSelectDialog.vue`)

**职责**: 选择服务器实例的对话框

**Props**:

```typescript
interface Props {
  modelValue: boolean;
  instances: ServerInstanceConfig[];
  title?: string;
}
```

**Emits**:

```typescript
{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', instanceIndex: number): void;
}
```

**主要功能**:

- 对话框
- 实例下拉选择
- 确认/取消按钮

### MergedConfigPreviewDialog (`MergedConfigPreviewDialog.vue`)

**职责**: 显示合并后的最终配置预览对话框

**Props**:

```typescript
interface Props {
  modelValue: boolean;
  mergedConfig: Record<string, unknown>;
}
```

**Emits**:

```typescript
{
  (e: 'update:modelValue', value: boolean): void;
}
```

**主要功能**:

- Element Plus Dialog 弹窗
- 格式化 JSON 配置显示
- 一键复制到剪贴板
- 响应式布局

**依赖**:

- `useI18n` - 国际化支持
- Element Plus 图标和消息组件

### InstanceConfig (`InstanceConfig.vue`)

**职责**: 实例配置组件，显示模板配置（只读）和实例配置覆盖（可编辑）

**Props**:

```typescript
interface Props {
  templateConfig: ServerConfig;
  instanceConfig: InstanceConfigOverrides;
  serverName: string;
}
```

**Emits**:

```typescript
{
  (e: 'update', config: Partial<InstanceConfigOverrides>): void;
}
```

**主要功能**:

- 单列统一布局，模板值作为只读参考显示
- 模板配置以灰色禁用样式显示
- 实例配置覆盖完全可编辑
- 高亮显示与模板不同的字段
- 右上角"查看合并配置"按钮打开预览对话框
- 支持动态添加/删除字段（args、env、headers、tags）

**子组件**:

- MergedConfigPreviewDialog

**依赖**:

- `useI18n` - 国际化支持
- Element Plus 图标组件

### Header (`HeaderView.vue`)

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
  title: string; // 工具名称
  description?: string; // 工具描述
  tagName?: string; // 标签文本（服务器名称）
  tagClass?: string; // 标签样式类
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
  modelValue: boolean; // 对话框显示状态
  serverId?: string; // 服务器 ID（用于特定服务器工具）
  toolName: string; // 工具名称
  description?: string; // 工具描述
  inputSchema?: any; // 工具参数 Schema
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
    status: string;
    version?: string;
    pid?: number | null;
    config: {
      type: string;
      command?: string;
      url?: string;
    };
    startTime?: number;
  };
  includeUptime?: boolean; // 是否包含运行时间显示
}
```

**主要功能**:

- 显示服务器状态（running/stopped/error/starting）
- 显示传输类型和相关信息（stdio/sse/streamable-http）
- 显示 PID 信息（仅 stdio 类型）
- 可选显示运行时间

**注意**: 版本号显示已移至服务器名称右侧的 Tag 组件（ServerDetailHeader 和 ServerListView）

**依赖**:

- `useI18n` - 国际化支持
- `format-utils.js` - 格式化工具函数

### ResourceCard (`ResourceCard.vue`)

**职责**: 资源卡片展示组件，用于显示 MCP 服务器提供的资源

**Props**:

```typescript
interface Props {
  uri: string; // 资源 URI
  name: string; // 资源名称
  description?: string; // 资源描述
  serverName?: string; // 所属服务器名称
  mimeType?: string; // 资源的 MIME 类型
}
```

**Emits**:

```typescript
{
  (e: 'click'): void;     // 点击卡片时触发
  (e: 'read'): void;      // 点击读取按钮时触发
}
```

**主要功能**:

- 资源信息展示（URI、名称、描述）
- 服务器来源标签
- 读取资源操作按钮

**依赖**:

- `useI18n` - 国际化支持
- `/web/resources/:uri` - 读取资源 API

## 依赖关系

```
components/
├── DashboardView.vue
│   └── depends on: useServerStore
│
├── ServerDetail.vue (协调器)
│   ├── depends on: useServerStore
│   ├── uses: ServerDetailHeader
│   ├── uses: ConfigTemplateForm
│   ├── uses: LogViewer
│   ├── uses: ToolsTab
│   ├── uses: ResourcesTab
│   ├── uses: JsonConfigEditor
│   ├── uses: InstanceSelectDialog
│   ├── uses: ToolCallDialog
│   ├── uses: ServerStatusTags
│   ├── uses: InstanceCardList
│   └── uses: InstanceConfig
│
├── ServerDetailHeader.vue
│   └── uses: ServerStatusTags
│
├── InstanceConfig.vue
│   └── uses: MergedConfigPreviewDialog
│
├── ToolCard.vue
│   └── depends on: useI18n
│
├── ToolCallDialog.vue
│   └── uses API: /web/hub-tools/*
│
├── HeaderView.vue
│   └── depends on: useI18n, useTheme
│
├── ServerStatusTags.vue
│   └── depends on: useI18n, format-utils.js
│
└── ResourceCard.vue
    └── depends on: useI18n
```

## 测试与质量

### 单元测试

**状态**: 已实现 Dashboard、ToolCard、ToolCallDialog、ServerStatusTags 组件测试

**已实现测试**:

- Dashboard 组件：服务器统计卡片、加载状态、活动日志显示
- ToolCard 组件：标题/描述渲染、标签显示、点击事件触发
- ToolCallDialog 组件：对话框显示、参数生成、执行调用
- ServerStatusTags 组件：状态显示、传输信息、运行时间（版本号已移至名称右侧）

**建议测试**:

- ServerDetail 组件测试
- ServerDetailHeader 组件测试
- ConfigTemplateForm 组件测试
- LogViewer 组件测试
- ToolsTab 组件测试
- ResourcesTab 组件测试
- JsonConfigEditor 组件测试
- InstanceSelectDialog 组件测试
- ResourceCard 组件测试
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

### Q: ServerDetail 组件重构后有什么变化？

A: ServerDetail 从一个 1300+ 行的单体组件重构为：

- ServerDetail.vue: 协调器组件（约 400 行）
- 8 个新的子组件，每个负责特定功能
- 更好的可维护性、可测试性和复用性

## 相关文件清单

| 文件路径                                   | 描述               |
| ------------------------------------------ | ------------------ |
| `components/DashboardView.vue`             | 服务器仪表板       |
| `components/ServerDetail.vue`              | 服务器详情协调器   |
| `components/ServerDetailHeader.vue`        | 服务器详情头部     |
| `components/ConfigTemplateForm.vue`        | 配置模板表单       |
| `components/LogViewer.vue`                 | 日志查看器         |
| `components/ToolsTab.vue`                  | 工具标签页         |
| `components/ResourcesTab.vue`              | 资源标签页         |
| `components/JsonConfigEditor.vue`          | JSON 配置编辑器    |
| `components/InstanceSelectDialog.vue`      | 实例选择对话框     |
| `components/MergedConfigPreviewDialog.vue` | 合并配置预览对话框 |
| `components/HeaderView.vue`                | 头部               |
| `components/AddServerModal.vue`            | 添加服务器对话框   |
| `components/ToolCard.vue`                  | 工具卡片           |
| `components/ToolCallDialog.vue`            | 工具调用对话框     |
| `components/ServerStatusTags.vue`          | 服务器状态标签组件 |
| `components/InstanceCardList.vue`          | 实例卡片列表       |
| `components/InstanceConfig.vue`            | 实例配置           |
| `components/ResourceCard.vue`              | 资源卡片组件       |
