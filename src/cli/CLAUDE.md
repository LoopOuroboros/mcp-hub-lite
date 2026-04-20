[根目录](../../CLAUDE.md) > [src](../) > **cli**

# CLI 模块

## 模块职责

CLI 模块提供命令行接口，是应用的入口点，负责处理用户命令和参数解析。

## 目录结构

```
cli/
├── index.ts                 # CLI 主入口
└── commands/               # 命令实现
    ├── start.ts            # 启动命令
    ├── stop.ts             # 停止命令
    ├── status.ts           # 状态命令
    ├── ui.ts               # UI 命令
    ├── list.ts             # 列表命令
    ├── restart.ts          # 重启命令
    ├── tool-use.ts         # MCP 工具操作命令
    ├── install.ts          # 添加服务器命令
    └── use-guide.ts        # CLI 使用指南命令
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
- `tool-use` - 通过 API 操作 MCP 服务器工具
- `install` - 添加新的 MCP 服务器
- `use-guide` - 输出 CLI 使用指南（Markdown 格式）

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
- 列出所有管理服务器的状态（包括 disabled 服务器）
- 按连接状态分组显示：Connected（绿色）和 Disconnected（红色）

**输出示例**:

```
MCP Hub Lite - System Status
============================
Process ID: 12345
Port: 7788
Host: localhost
Status: Running

MCP Servers (Connected):
════════════════════════
Server Name  Type   Status        Tools  Resources
──────────────────────────────────────────────────
bingcn       stdio  Connected         2          0
...

MCP Servers (Disconnected):
═══════════════════════════
Server Name            Type   Status        Tools  Resources
──────────────────────────────────────────────────────
desktop-commander      stdio  Disconnected      0          0
...

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

### Tool Use 命令 (`commands/tool-use.ts`)

**用法**:

```bash
mcp-hub-lite tool-use <action> [--server <serverName>] [--tool <toolName>] [--args <json>] [--tags <json>]
```

或通过 npm 运行：

```bash
npm run tool-use -- <action> [--server <serverName>] [--tool <toolName>] [--args <json>] [--tags <json>]
```

**支持的 Action**:

- `list-servers` - 列出所有已连接的 MCP 服务器
- `list-tools` - 列出指定服务器的所有工具
- `get-tool` - 获取特定工具的完整 schema（需要 --tool）
- `call-tool` - 调用指定服务器上的工具（需要 --tool）

**选项**:

- `--server <serverName>` - 目标服务器名称（省略时默认为 mcp-hub-lite 系统工具）
- `--tool <toolName>` - 工具名称（get-tool 和 call-tool 必须提供）
- `--args <json>` - 工具参数的 JSON 字符串，或包含 server/tool/args 字段的合并 JSON
- `--tags <json>` - 实例选择标签的 JSON 对象（仅用于多实例服务器）

**JSON 合并逻辑**:

当 `--args` 包含 `server`、`tool` 或 `args` 字段时，会被提取并合并：

- `server` 字段 → 目标服务器名称
- `tool` 字段 → 工具名称
- `args` 字段 → 工具参数
- 其他字段 → 作为工具参数处理

**使用示例**:

#### 分散参数形式:

```bash
# 列出所有已连接服务器
npm run tool-use -- list-servers

# 列出 mcp-hub-lite 系统工具（默认）
npm run tool-use -- list-tools

# 列出第三方服务器工具
npm run tool-use -- list-tools --server baidu-search

# 获取系统工具 schema
npm run tool-use -- get-tool --tool list_tools

# 调用第三方服务器工具
npm run tool-use -- call-tool --tool search --server baidu-search --args '{"query":"天气"}'

# 多实例服务器带标签调用
npm run tool-use -- call-tool --tool search --server baidu-search --args '{"query":"test"}' --tags '{"env":"production"}'
```

#### JSON 合并形式:

```bash
# 全部参数在一个 JSON 中
npm run tool-use -- call-tool --args '{"server":"baidu-search","tool":"search","query":"天气"}'

# 等同于
npm run tool-use -- call-tool --server baidu-search --tool search --args '{"query":"天气"}'
```

#### 本地安装验证:

```bash
# 安装到本地（项目根目录下执行）
npm link

# 通过 mcp-hub-lite 命令验证
mcp-hub-lite tool-use list-tools                    # 列出系统工具（默认）
mcp-hub-lite tool-use list-tools --server baidu-search  # 列出第三方服务器工具
mcp-hub-lite tool-use get-tool --tool list_tools    # 获取系统工具 schema
mcp-hub-lite tool-use call-tool --tool list_tools --args '{}'  # 调用系统工具

# 验证完成后卸载
npm unlink
```

**功能**:

- 通过 HTTP API 封装 MCP 服务器工具操作
- 支持四种操作：list-servers、list-tools、get-tool、call-tool
- 需要 MCP Hub Lite 服务运行
- 支持多实例服务器的标签选择
- 支持通过 JSON 合并方式传递全部参数
- `--server` 省略时默认为 `mcp-hub-lite` 系统工具

### Install 命令 (`commands/install.ts`)

**用法**:

```bash
# 参数模式（默认）
mcp-hub-lite install <name> <commandOrUrl> [args...]

# JSON 模式
mcp-hub-lite install --json '<config>'
```

**位置参数** (参数模式):

- `name` - 服务器名称（必填）
- `commandOrUrl` - stdio: 可执行命令; SSE/HTTP: 服务器 URL
- `args` - 命令参数（仅 stdio）

**选项**:

- `-j, --json <config>` - 服务器配置 JSON
- `-t, --transport <type>` - 传输类型: stdio, sse, streamable-http (默认: stdio)
- `-e, --env <env...>` - 环境变量 (格式: KEY=VALUE)
- `-H, --header <header...>` - HTTP 请求头 (格式: "Key: Value")
- `--timeout <seconds>` - 超时时间秒 (默认: 60)
- `--strategy <strategy>` - 实例选择策略: random, round-robin, tag-match-unique (默认: random)
- `-a, --auto-start` - 自动启动服务器 (默认: true)
- `--no-auto-start` - 禁用自动启动
- `-d, --description <desc>` - 服务器描述

**JSON 模式配置字段**:

| 字段                        | 必填                            | 说明                                                |
| --------------------------- | ------------------------------- | --------------------------------------------------- |
| `name`                      | 是                              | 服务器名称                                          |
| `type`                      | 否                              | 传输类型: stdio, sse, streamable-http (默认: stdio) |
| `command`                   | type=stdio 时必填               | 命令                                                |
| `url`                       | type=sse/streamable-http 时必填 | 服务器 URL                                          |
| `args`                      | 否                              | 命令参数                                            |
| `env`                       | 否                              | 环境变量对象                                        |
| `headers`                   | 否                              | HTTP 请求头对象                                     |
| `timeout`                   | 否                              | 超时秒数 (默认: 60)                                 |
| `enabled`                   | 否                              | 自动启动 (默认: true)                               |
| `description`               | 否                              | 服务器描述                                          |
| `instanceSelectionStrategy` | 否                              | 实例选择策略                                        |

**使用示例**:

#### 参数模式:

```bash
# stdio 服务器
mcp-hub-lite install github-mcp "npx github-mcp" --env API_KEY=xxx

# HTTP 服务器
mcp-hub-lite install api-server https://api.example.com/mcp -t streamable-http -H "Authorization: Bearer xxx"
```

#### JSON 模式:

```bash
# stdio 服务器
mcp-hub-lite install --json '{"name":"github-mcp","type":"stdio","command":"npx github-mcp","env":{"API_KEY":"xxx"}}'

# HTTP 服务器
mcp-hub-lite install --json '{"name":"api-server","type":"streamable-http","url":"https://api.example.com/mcp","headers":{"Authorization":"Bearer xxx"}}'
```

**功能**:

- 支持参数模式和 JSON 模式两种用法
- 通过 HTTP API 添加新服务器到 MCP Hub Lite
- 支持 stdio、sse、streamable-http 三种传输类型
- JSON 模式可直接写入完整配置

### Use Guide 命令 (`commands/use-guide.ts`)

**用法**:

```bash
mcp-hub-lite use-guide
```

**功能**:

- 输出 CLI 使用指南（Markdown 格式）
- 包含所有 CLI 命令的用法和选项说明
- 不包含 MCP 协议相关说明，仅提供 CLI 使用方式
- 内容内联在 `use-guide.ts` 中，作为常量提供

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
    ├── restart.ts
    │   └── depends on: src/pid/manager.ts
    │
    ├── tool-use.ts
    │   ├── depends on: src/cli/server.ts
    │   └── depends on: src/config/config-manager.ts
    │
    ├── install.ts
    │   ├── depends on: src/cli/server.ts
    │   └── depends on: src/config/config-manager.ts
    │
    └── use-guide.ts
        └── (standalone command, no dependencies)
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

| 文件路径                    | 描述               |
| --------------------------- | ------------------ |
| `cli/index.ts`              | CLI 主入口         |
| `cli/commands/start.ts`     | 启动命令           |
| `cli/commands/stop.ts`      | 停止命令           |
| `cli/commands/status.ts`    | 状态命令           |
| `cli/commands/ui.ts`        | UI 命令            |
| `cli/commands/list.ts`      | 列表命令           |
| `cli/commands/restart.ts`   | 重启命令           |
| `cli/commands/tool-use.ts`  | MCP 工具操作命令   |
| `cli/commands/install.ts`   | 添加服务器命令     |
| `cli/commands/use-guide.ts` | CLI 使用指南命令   |
| `cli/server.ts`             | CLI 服务器管理函数 |
