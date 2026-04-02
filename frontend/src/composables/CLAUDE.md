[根目录](../../../CLAUDE.md) > [frontend](../../) > [src](../) > **composables**

# Composables 模块

## 模块职责

Composables 模块包含可复用的 Vue 3 组合式函数，用于封装和复用组件逻辑。

## 目录结构

```
composables/
├── useTheme.ts                         # 主题切换 composable
├── use-server-selection.ts            # 服务器选择和 Tab 状态管理
├── use-server-instances.ts            # 服务器实例操作管理
└── use-tool-and-resource-dialogs.ts   # 工具和资源对话框管理
```

## Composables 列表

### useTheme (`useTheme.ts`)

**职责**: 管理应用主题切换（亮色/暗色模式）

**主要功能**:

- 主题状态管理
- 主题切换逻辑
- 本地存储持久化

### useServerSelection (`use-server-selection.ts`)

**职责**: 管理服务器详情页面的 Tab 选择和实例选择状态，以及路由同步

**主要功能**:

- 顶部 Tab 状态管理（config/tools/resources）
- 实例选择状态管理
- 实例详情 Tab 管理（config/logs）
- 路由查询参数同步（instanceTab、instanceIndex、selection）
- 从路由初始化状态
- 支持 URL 书签和分享（实例标签路由同步）

**状态**:

```typescript
{
  activeTopTab: 'config' | 'tools' | 'resources';
  selectedInstanceIndex: number | null;
  activeInstanceTab: 'config' | 'logs';
}
```

**方法**:

- `getTabFromRoute()` - 从路由获取当前 Tab
- `navigateToTab(tab)` - 导航到指定 Tab
- `handleSelectTemplate()` - 选择模板
- `handleSelectInstance(index)` - 选择实例
- `parseSelectionFromRoute()` - 从路由查询参数解析选择状态
- `parseInstanceTabFromRoute()` - 从路由查询参数解析实例 Tab 状态

**支持的 URL 查询参数**:

| 参数名          | 类型                 | 说明                                 |
| --------------- | -------------------- | ------------------------------------ |
| `instanceTab`   | `'config' \| 'logs'` | 实例详情页的子 Tab（默认：'config'） |
| `instanceIndex` | number               | 选中的实例索引（0-based）            |
| `selection`     | `'template'`         | 选择模板（与 instanceIndex 互斥）    |

**实例标签路由同步功能**:

- **双向同步**: 状态变化自动反映到 URL，URL 变化自动更新状态
- **向后兼容性**: 默认 `instanceTab='config'` 保持现有行为
- **书签支持**: 用户可以书签特定实例的特定 Tab
- **分享支持**: 分享的 URL 会保留用户的查看状态
- **F5 刷新**: 页面刷新后会恢复到相同的 Tab 和实例选择

**路由查询参数示例**:

```
# 查看实例 0 的配置 Tab
/servers/my-server?instanceIndex=0&instanceTab=config

# 查看实例 1 的日志 Tab
/servers/my-server?instanceIndex=1&instanceTab=logs

# 查看模板配置（无实例选中）
/servers/my-server?selection=template
```

**依赖**:

- `vue-router` - 路由管理
- `useServerStore` - 服务器状态管理

### useServerInstances (`use-server-instances.ts`)

**职责**: 管理服务器实例的操作和状态

**主要功能**:

- 服务器实例列表计算
- 选中实例配置获取
- 单个实例操作（启动/停止/重启）
- 批量实例操作（启动全部/停止全部/重启全部）
- 实例 CRUD 操作（添加/删除/更新显示名称/重新分配索引/更新配置）
- 实例状态查询

**Computed Properties**:

- `serverInstances` - 带状态的实例列表
- `selectedInstance` - 当前选中的实例
- `selectedInstanceConfig` - 当前选中实例的配置覆盖
- `templateConfigForInstance` - 模板配置
- `allServers` - 聚合服务器列表（v1.1 格式）

**方法**:

- `getSelectedInstanceStatus()` - 获取选中实例状态
- `getSelectedInstanceServerId()` - 获取选中实例的实例 ID（原方法名保留，功能变更）
- `startSelectedInstance()` - 启动选中实例
- `stopSelectedInstance()` - 停止选中实例
- `restartSelectedInstance()` - 重启选中实例
- `startAllInstances()` - 启动全部实例
- `stopAllInstances()` - 停止全部实例
- `restartAllInstances()` - 重启全部实例
- `handleAddInstance()` - 添加新实例
- `handleUpdateDisplayName()` - 更新实例显示名称
- `handleDeleteInstance()` - 删除实例
- `handleReassignIndexes()` - 重新分配实例索引
- `handleUpdateInstanceConfig()` - 更新实例配置

**v1.1 关键改进**:

- **实例状态查找**: 在聚合服务器的 `instances[]` 数组中匹配实例ID来查找状态
- **即时UI更新**: 在调用API前先进行本地状态更新，提供更好的用户体验
  - 添加实例时创建临时ID并立即显示
  - 更新显示名称时先本地更新
  - 删除实例时先本地移除
- **ID变更**: `getSelectedInstanceServerId()` 现在返回实例ID而非服务器ID
- **状态更新**: 在实例操作中先更新本地状态再调用API

**依赖**:

- `useServerStore` - 服务器状态管理
- `useI18n` - 国际化支持
- `Element Plus` - 消息和对话框组件

### useToolAndResourceDialogs (`use-tool-and-resource-dialogs.ts`)

**职责**: 管理工具调用和资源查看的对话框状态

**主要功能**:

- 实例选择对话框状态
- 工具调用对话框状态
- 资源查看对话框状态
- 对话框确认回调处理

**状态**:

```typescript
{
  showInstanceSelectForTool: boolean;
  selectedInstanceForTool: number | null;
  showCallDialog: boolean;
  pendingTool: Tool | null;
  showInstanceSelectForResourceDialog: boolean;
  showInstanceSelectForResource: Resource | null;
  selectedInstanceForResource: number | null;
}
```

**方法**:

- `callToolWithInstance(instanceIndex)` - 使用选中实例调用工具
- `viewResourceWithInstance(instanceIndex)` - 使用选中实例查看资源

**依赖**:

- `vue-router` - 路由管理（用于资源查看导航）

## 使用指南

### 在 ServerDetail.vue 中使用

```typescript
import { useServerSelection } from '@/composables/use-server-selection';
import { useServerInstances } from '@/composables/use-server-instances';
import { useToolAndResourceDialogs } from '@/composables/use-tool-and-resource-dialogs';

const server = computed(() => store.selectedServer);

const {
  activeTopTab,
  selectedInstanceIndex,
  activeInstanceTab,
  navigateToTab,
  handleSelectTemplate,
  handleSelectInstance
} = useServerSelection(server);

const {
  serverInstances,
  selectedInstanceConfig,
  templateConfigForInstance,
  allServers,
  getSelectedInstanceStatus,
  startSelectedInstance,
  stopSelectedInstance,
  restartSelectedInstance,
  startAllInstances,
  stopAllInstances,
  restartAllInstances,
  handleAddInstance,
  handleUpdateDisplayName,
  handleDeleteInstance,
  handleReassignIndexes,
  handleUpdateInstanceConfig
} = useServerInstances(server, selectedInstanceIndex);

const {
  showInstanceSelectForTool,
  selectedInstanceForTool,
  showCallDialog,
  pendingTool,
  showInstanceSelectForResourceDialog,
  showInstanceSelectForResource,
  callToolWithInstance,
  viewResourceWithInstance
} = useToolAndResourceDialogs(server);
```

## 依赖关系

```
composables/
├── useTheme.ts
│   └── 独立使用
│
├── use-server-selection.ts
│   ├── depends on: vue-router, useServerStore
│   └── used by: ServerDetail.vue
│
├── use-server-instances.ts
│   ├── depends on: useServerStore, useI18n, Element Plus
│   └── used by: ServerDetail.vue
│
└── use-tool-and-resource-dialogs.ts
    ├── depends on: vue-router
    └── used by: ServerDetail.vue
```

## 相关文件清单

| 文件路径                                       | 描述                  |
| ---------------------------------------------- | --------------------- |
| `composables/useTheme.ts`                      | 主题切换              |
| `composables/use-server-selection.ts`          | 服务器选择和 Tab 管理 |
| `composables/use-server-instances.ts`          | 实例操作管理          |
| `composables/use-tool-and-resource-dialogs.ts` | 对话框管理            |
| `types/server-detail.ts`                       | 共享类型定义          |
| `utils/format-utils.ts`                        | 共享工具函数          |
