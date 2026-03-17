[根目录](../../CLAUDE.md) > [src](../) > **cli**

# CLI 模块

## 模块职责

CLI 模块提供命令行接口，是应用的入口点，负责处理用户命令和参数解析。

## 目录结构

```
cli/
├── index.ts                 # CLI 主入口
└── commands/                # 命令实现
    ├── start.ts             # 启动命令
    ├── stop.ts              # 停止命令
    ├── status.ts            # 状态命令
    ├── ui.ts                # UI 命令
    ├── list.ts              # 列表命令
    └── restart.ts           # 重启命令
```

## 主入口 (`index.ts`)

**描述**: 使用 Commander.js 实现的 CLI 主程序

**可用命令**:

- `start` - 启动 MCP Hub Lite 服务
- `stop` - 停止 MCP Hub Lite 服务
- `status` - 查看服务状态
- `ui` - 打开 Web UI
- `list` - 列出所有 MCP 服务器
- `restart` - 重启 MCP Hub Lite 服务

## 命令详解

### Start 命令 (`commands/start.ts`)

**用法**:

```bash
mcp-hub-lite start [options]
```

**选项**:

- `--stdio` - 以 stdio 模式运行（用于 MCP 协议）
- `-p, --port <number>` - 指定端口
- `-h, --host <string>` - 指定主机
- `-f, --foreground` - 前台运行（不使用守护进程）

**功能**:

- 默认使用守护进程模式启动
- 创建 PID 文件记录进程 ID
- 日志输出到 `logs/` 目录
- 启动 Fastify HTTP 服务器和 MCP Gateway

### Stop 命令 (`commands/stop.ts`)

**用法**:

```bash
mcp-hub-lite stop
```

**功能**:

- 读取 PID 文件获取进程 ID
- 发送 SIGTERM 信号停止服务
- 清理 PID 文件

### Status 命令 (`commands/status.ts`)

**用法**:

```bash
mcp-hub-lite status
```

**功能**:

- 显示进程 ID 和运行状态
- 显示配置的端口和主机
- 显示 MCP 集成配置
- 列出所有管理服务器的状态

**输出示例**:

```
MCP Hub Lite - System Status
============================
Process ID: 12345
Port: 7788
Host: localhost
Status: Running

MCP Integration:
================
Endpoint: http://localhost:7788/mcp
Transport: StreamableHttp

{
  "mcpServers": {
    "mcp-hub-lite": {
      "type": "http",
      "url": "http://localhost:7788/mcp"
    }
  }
}
```

### UI 命令 (`commands/ui.ts`)

**用法**:

```bash
mcp-hub-lite ui
```

**功能**:

- 使用系统默认浏览器打开 Web UI
- 根据 `--host` 和 `--port` 选项打开对应地址

### List 命令 (`commands/list.ts`)

**用法**:

```bash
mcp-hub-lite list
```

**功能**:

- 获取所有配置的服务器列表
- 以表格形式显示

### Restart 命令 (`commands/restart.ts`)

**用法**:

```bash
mcp-hub-lite restart
```

**功能**:

- 停止当前运行的服务
- 重新启动服务
- 保持相同的配置

## 依赖关系

```
cli/
├── index.ts
│   ├── depends on: src/server/runner.ts
│   ├── depends on: src/config/config-manager.ts
│   ├── depends on: src/pid/manager.ts
│   └── depends on: commander
│
└── commands/
    ├── start.ts
    │   ├── depends on: src/server/runner.ts
    │   └── depends on: src/pid/manager.ts
    │
    ├── stop.ts
    │   └── depends on: src/pid/manager.ts
    │
    ├── status.ts
    │   ├── depends on: src/config/config-manager.ts
    │   └── depends on: src/pid/manager.ts
    │
    ├── ui.ts
    │   └── depends on: src/config/config-manager.ts
    │
    ├── list.ts
    │   └── depends on: src/config/config-manager.ts
    │
    └── restart.ts
        └── depends on: src/pid/manager.ts
```

## 数据模型

无特定数据模型，使用配置管理器的配置结构。

## 测试与质量

### 单元测试

**状态**: 待添加

**建议测试**:

- 命令参数解析测试
- 错误处理测试
- 边界条件测试

## 常见问题 (FAQ)

### Q: 如何在后台模式下查看日志？

A: 日志文件存储在 `logs/` 目录，文件名包含日期戳。

### Q: 前台模式和守护进程模式的区别？

A: 前台模式 (`--foreground`) 直接在终端运行，守护进程模式在后台运行并输出到日志文件。

## 相关文件清单

| 文件路径                  | 描述       |
| ------------------------- | ---------- |
| `cli/index.ts`            | CLI 主入口 |
| `cli/commands/start.ts`   | 启动命令   |
| `cli/commands/stop.ts`    | 停止命令   |
| `cli/commands/status.ts`  | 状态命令   |
| `cli/commands/ui.ts`      | UI 命令    |
| `cli/commands/list.ts`    | 列表命令   |
| `cli/commands/restart.ts` | 重启命令   |
