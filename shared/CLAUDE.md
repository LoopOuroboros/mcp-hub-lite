[根目录](../CLAUDE.md) > **shared**

# Shared 模块

## 模块职责

Shared 模块包含前后端共享的代码和类型定义，确保前后端使用一致的数据模型和类型。

## 目录结构

```
shared/
├── models/              # 共享数据模型
│   ├── index.ts         # 统一导出
│   ├── server.model.ts  # 服务器数据模型
│   ├── tool.model.ts    # 工具数据模型
│   ├── resource.model.ts # 资源数据模型
│   └── session.model.ts # 会话数据模型
└── types/               # 共享类型定义
    ├── index.ts         # 统一导出
    ├── session.types.ts # 会话相关类型
    ├── session-context.types.ts # 会话上下文类型
    ├── common.types.ts  # 通用类型
    └── websocket.types.ts # WebSocket 类型
```

## 核心文件

### Server Model (`models/server.model.ts`)

**职责**: 定义服务器配置和状态的数据模型

**主要接口**:

- `ServerConfig` - 服务器配置接口
- `ServerInstance` - 服务器实例接口
- `ServerStatus` - 服务器状态类型
- `ServerTemplateV11` - v1.1 服务器模板配置接口
- `ServerInstanceV11` - v1.1 服务器实例配置接口
- `ServerConfigV11` - v1.1 完整服务器配置接口

### Tool Model (`models/tool.model.ts`)

**职责**: 定义工具相关的数据模型

**主要接口**:

- `Tool` - 工具基本信息接口
- `ToolInputSchema` - 工具输入参数 Schema
- `ToolList` - 工具列表类型

### Resource Model (`models/resource.model.ts`)

**职责**: 定义资源相关的数据模型

**主要接口**:

- `Resource` - 资源基本信息接口
- `ResourceContent` - 资源内容类型
- `ResourceList` - 资源列表类型

### Session Model (`models/session.model.ts`)

**职责**: 定义会话状态和存储的数据模型

**主要接口**:

- `SessionState` - 会话状态接口
- `SessionStore` - 会话存储接口

**主要函数**:

- `createEmptySessionStore()` - 创建空的会话存储
- `validateSessionStore()` - 验证和规范化会话存储数据

**依赖**:

- `zod` - 数据验证库

### Session Types (`types/session.types.ts`)

**职责**: 定义前端使用的会话相关类型

**主要接口**:

- `SessionInfo` - 用于前端显示的会话信息接口

**依赖**:

- `models/session.model.ts` - 会话数据模型

### Session Context Types (`types/session-context.types.ts`)

**职责**: 定义会话上下文相关类型

**主要接口**:

- `ClientContext` - 客户端上下文信息（注意：已移除 cwd 和 project 字段）
- `SessionContext` - 会话上下文类型

### Common Types (`types/common.types.ts`)

**职责**: 定义通用类型定义

**主要类型**:

- 通用工具类型
- 响应包装类型
- 错误类型

### WebSocket Types (`types/websocket.types.ts`)

**职责**: 定义 WebSocket 事件和消息类型

**主要类型**:

- `WebSocketEventType` - WebSocket 事件类型枚举
- `ServerStatusEvent` - 服务器状态事件
- `LogEvent` - 日志事件
- `ToolsEvent` - 工具更新事件
- `ResourcesEvent` - 资源更新事件
- `ServerAddedEvent` - 服务器添加事件
- `ServerUpdatedEvent` - 服务器更新事件
- `ServerDeletedEvent` - 服务器删除事件
- `ServerConnectedEvent` - 服务器连接事件
- `ServerDisconnectedEvent` - 服务器断开事件
- `ToolCallStartedEvent` - 工具调用开始事件
- `ToolCallCompletedEvent` - 工具调用完成事件
- `ToolCallErrorEvent` - 工具调用错误事件
- `ConfigurationUpdatedEvent` - 配置更新事件
- `ClientConnectedEvent` - 客户端连接事件
- `ClientDisconnectedEvent` - 客户端断开事件

**常量**:

- `WEB_SOCKET_EVENT_TYPES` - WebSocket 事件类型常量对象

## 依赖关系

```
shared/
├── models/
│   ├── index.ts
│   │   ├── exports: server.model.ts
│   │   ├── exports: tool.model.ts
│   │   ├── exports: resource.model.ts
│   │   └── exports: session.model.ts
│   ├── server.model.ts
│   │   └── depends on: zod
│   ├── tool.model.ts
│   │   └── depends on: zod
│   ├── resource.model.ts
│   │   └── depends on: zod
│   └── session.model.ts
│       └── depends on: zod
└── types/
    ├── index.ts
    │   ├── exports: session.types.ts
    │   ├── exports: session-context.types.ts
    │   ├── exports: common.types.ts
    │   └── exports: websocket.types.ts
    ├── session.types.ts
    │   └── depends on: ../models/session.model.ts
    ├── session-context.types.ts
    │   └── depends on: ../models/session.model.ts
    ├── common.types.ts
    │   └── no dependencies
    └── websocket.types.ts
        ├── depends on: ../models/server.model.ts
        ├── depends on: ../models/tool.model.ts
        └── depends on: ../models/resource.model.ts
```

## 使用方式

### 后端导入

```typescript
import { SessionState, SessionStore } from '@shared-models/session.model.js';
import { ServerConfig } from '@shared-models/server.model.js';
import { WebSocketEventType } from '@shared-types/websocket.types.js';
```

### 前端导入

```typescript
import type { SessionState } from '@shared-types/session.types';
import type { ServerConfig } from '@shared-models/server.model';
import { WEB_SOCKET_EVENT_TYPES } from '@shared-types/websocket.types';
```

## 测试与质量

### 单元测试

**状态**: 已实现

**测试覆盖**:

- 会话模型 Zod Schema 验证
- 会话存储验证
- 类型定义验证

**测试文件**:

- `tests/unit/services/session-manager.test.ts` - 包含会话模型相关测试

## 相关文件清单

| 文件路径                                | 描述           |
| --------------------------------------- | -------------- |
| `shared/models/index.ts`                | 模型统一导出   |
| `shared/models/server.model.ts`         | 服务器数据模型 |
| `shared/models/tool.model.ts`           | 工具数据模型   |
| `shared/models/resource.model.ts`       | 资源数据模型   |
| `shared/models/session.model.ts`        | 会话数据模型   |
| `shared/types/index.ts`                 | 类型统一导出   |
| `shared/types/session.types.ts`         | 会话相关类型   |
| `shared/types/session-context.types.ts` | 会话上下文类型 |
| `shared/types/common.types.ts`          | 通用类型       |
| `shared/types/websocket.types.ts`       | WebSocket 类型 |
