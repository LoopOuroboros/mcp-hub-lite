[根目录](../../../CLAUDE.md) > [frontend](../../) > [src](../) > **stores**

# Stores 模块

## 模块职责

Stores 模块使用 Pinia 实现前端状态管理，是前端的数据中心。

## 目录结构

```
stores/
└── server.ts              # 服务器状态管理
```

## 核心 Store

### Server Store (`server.ts`)

**职责**: 管理 MCP 服务器的状态和操作

**State**:
```typescript
{
  servers: Server[]              // 服务器列表
  loading: boolean               // 加载状态
  error: string | null          // 错误信息
  selectedServerId: string | null  // 选中的服务器 ID
}
```

**Computed**:
- `selectedServer` - 当前选中的服务器
- `stats` - 统计信息（总数、运行数、错误数）

**Actions**:
- `fetchServers()` - 获取所有服务器
- `addServer(serverData)` - 添加新服务器
- `updateServer(id, serverData)` - 更新服务器
- `startServer(id)` - 启动服务器
- `stopServer(id)` - 停止服务器
- `deleteServer(id)` - 删除服务器
- `selectServer(id)` - 选择服务器
- `fetchTools(serverId)` - 获取服务器工具
- `fetchResources(serverId)` - 获取服务器资源
- `fetchLogs(serverId)` - 获取服务器日志
- `clearLogs(serverId)` - 清除日志

## 数据模型

### Server Config
```typescript
export interface ServerConfig {
  transport: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
  timeout?: number
  enabled?: boolean
}
```

### Log Entry
```typescript
export interface LogEntry {
  timestamp: number
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}
```

### Server
```typescript
export interface Server {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error'
  type: 'local' | 'remote'
  config: ServerConfig
  logs: LogEntry[]
  uptime?: string
  startTime?: number
  pid?: number
  tools?: any[]
  resources?: any[]
  toolsCount?: number
  resourcesCount?: number
  version?: string
}
```

## 依赖关系

```
stores/
└── server.ts
    └── depends on: utils/http.ts
```

## 测试与质量

### 单元测试

**状态**: 待添加

**建议测试**:
- Store 初始化测试
- Action 功能测试
- 计算属性测试

## 常见问题 (FAQ)

### Q: 如何添加新的 Store？

A: 使用 Pinia 的 `defineStore` 创建新的状态管理文件。

### Q: 如何在组件中使用 Store？

A: 使用 `useServerStore()` 获取 store 实例。

## 相关文件清单

| 文件路径 | 描述 |
|---------|------|
| `stores/server.ts` | 服务器状态管理 |

## 变更记录 (Changelog)

### 2026-01-19
- 初始化 Stores 模块文档
