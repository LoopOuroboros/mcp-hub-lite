[根目录](../../../CLAUDE.md) > [frontend](../../) > [src](../) > **utils**

# Utils 模块

## 模块职责

Utils 模块包含前端应用共享的工具函数，用于消除组件间的代码重复。

## 目录结构

```
utils/
├── format-utils.ts  # 格式化相关工具函数
├── http.ts          # HTTP 请求工具
└── websocket.ts     # WebSocket 连接工具
```

## 工具函数列表

### format-utils.ts

**文件路径**: `frontend/src/utils/format-utils.ts`

**函数列表**:

#### formatUptime

格式化运行时间为 HH:MM:SS 格式。

```typescript
function formatUptime(startTime?: number, status?: string): string;
```

**参数**:

- `startTime` - 开始时间戳（毫秒）
- `status` - 服务器状态（只有 'online' 状态会显示实际运行时间）

**返回值**: 格式化的运行时间字符串

**使用位置**:

- `ServerStatusTags.vue` - 服务器状态标签组件

#### getExecutableName

从命令路径中提取可执行文件名。

```typescript
function getExecutableName(cmd?: string): string;
```

**参数**:

- `cmd` - 命令路径或名称

**返回值**: 可执行文件名（路径的最后部分）

#### formatTimestamp

格式化时间戳为完整的日期时间字符串。

```typescript
function formatTimestamp(timestamp: number): string;
```

**参数**:

- `timestamp` - 时间戳（毫秒）

**返回值**: 格式化的时间字符串，格式为 `YYYY-MM-DD HH:mm:ss.SSS`

**使用位置**:

- `ServerDetail.vue` - 日志复制功能
- `LogViewer.vue` - 日志查看器组件

#### formatTimeOnly

格式化时间戳为仅时间的字符串。

```typescript
function formatTimeOnly(timestamp: number): string;
```

**参数**:

- `timestamp` - 时间戳（毫秒）

**返回值**: 格式化的时间字符串，格式为 `HH:mm:ss.SSS`

**使用位置**:

- `DashboardView.vue` - 仪表板活动日志

### http.ts

**文件路径**: `frontend/src/utils/http.ts`

HTTP 请求工具函数，用于与后端 API 交互。

### websocket.ts

**文件路径**: `frontend/src/utils/websocket.ts`

WebSocket 连接工具函数，用于实时事件通信。

**功能特性**:

- 自动重连（指数退避）
- 心跳保活（30 秒间隔）
- **待发送消息队列**: WebSocket 未 OPEN 时 `send()` 的消息自动排队，onopen 后批量发送

## 使用指南

### 导入工具函数

```typescript
import { formatUptime, formatTimestamp, formatTimeOnly } from '@/utils/format-utils';
```

### 使用示例

```typescript
// 格式化运行时间
const uptime = formatUptime(server.startTime, server.status);

// 格式化完整时间戳
const fullTime = formatTimestamp(log.timestamp);

// 仅格式化时间
const timeOnly = formatTimeOnly(log.timestamp);
```

## 重构历史

- **2026-03-26**: 添加 `formatTimestamp` 和 `formatTimeOnly` 函数，消除以下组件中的重复代码：
  - `ServerDetail.vue` (L874-884)
  - `LogViewer.vue` (L113-123)
  - `DashboardView.vue` (L217-227)

## 相关文件清单

| 文件路径                          | 描述                 |
| --------------------------------- | -------------------- |
| `utils/format-utils.ts`           | 格式化工具函数       |
| `utils/http.ts`                   | HTTP 请求工具        |
| `utils/websocket.ts`              | WebSocket 连接工具   |
| `components/ServerDetail.vue`     | 使用 formatTimestamp |
| `components/LogViewer.vue`        | 使用 formatTimestamp |
| `components/DashboardView.vue`    | 使用 formatTimeOnly  |
| `components/ServerStatusTags.vue` | 使用 formatUptime    |
