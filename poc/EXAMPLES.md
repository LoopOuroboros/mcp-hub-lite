# MCP Hub Lite 使用示例

本文档提供了 MCP Hub Lite 的常见使用场景和配置示例。

## 目录

1. [基本配置](#基本配置)
2. [CLI 命令使用](#cli-命令使用)
3. [连接不同类型的 MCP 服务器](#连接不同类型的-mcp-服务器)
4. [通过 HTTP API 交互](#通过-http-api-交互)
5. [常见问题排查](#常见问题排查)

---

## 基本配置

在项目根目录或 `config/` 目录下创建 `.mcp-hub.json` 文件。

```json
{
  "version": "1.0.0",
  "port": 7788,
  "host": "localhost",
  "servers": [
    {
      "id": "filesystem-server",
      "name": "Filesystem Server",
      "description": "Access local files",
      "endpoint": "http://localhost:8080",
      "transport": "http-stream",
      "enabled": true
    }
  ],
  "settings": {
    "logging": {
      "level": "info"
    }
  }
}
```

---

## CLI 命令使用

确保你已经构建了项目 (`npm run build`)，或者直接使用 `npm start`。

### 1. 启动服务器

```bash
# 默认启动 (使用配置文件中的端口)
npm start

# 指定端口启动
node dist/index.js start --port 8888

# 以 MCP Stdio 模式启动 (作为其他 MCP 客户端的子进程)
node dist/index.js start --stdio
```

### 2. 查看服务器状态

```bash
node dist/index.js status
```

输出示例：
```text
┌───────────────────┬────────────┬───────────┐
│        ID         │    Name    │  Status   │
├───────────────────┼────────────┼───────────┤
│ filesystem-server │ Filesystem │ Connected │
└───────────────────┴────────────┴───────────┘
```

### 3. 列出可用工具

```bash
node dist/index.js list
```

### 4. 停止/重启服务器

```bash
# 停止
node dist/index.js stop

# 重启
node dist/index.js restart
```

### 5. 打开 Web 界面

```bash
node dist/index.js ui
```

---

## 连接不同类型的 MCP 服务器

### 连接本地运行的 MCP 服务器 (Stdio)

虽然 MCP Hub Lite 目前主要作为 HTTP 网关，但你可以配置它来管理通过命令启动的子进程服务器（需确保 ConfigManager 支持 `managedProcess` 配置，目前 MVP 版本主要支持 HTTP 连接）。

如果目标服务器已经通过 HTTP 暴露：

```json
{
  "id": "weather-server",
  "name": "Weather Service",
  "endpoint": "http://localhost:3001/mcp",
  "transport": "sse" 
}
```
*(注意：目前 `transport` 字段主要用于标识，实际连接逻辑取决于实现)*

---

## 通过 HTTP API 交互

你可以使用 `curl` 或 Postman 与 MCP Hub Lite 交互。

### 获取服务器列表

```bash
curl http://localhost:3000/api/servers
```

### 检查健康状态

```bash
curl http://localhost:3000/health
```

### 连接/断开服务器

```bash
# 连接
curl -X POST http://localhost:3000/api/connections/filesystem-server/connect

# 断开
curl -X POST http://localhost:3000/api/connections/filesystem-server/disconnect
```

---

## 常见问题排查

### 1. 端口被占用

**错误信息**: `EADDRINUSE: address already in use`

**解决方法**:
- 使用 `node dist/index.js stop` 停止旧进程。
- 或者在启动时指定新端口: `node dist/index.js start --port 3001`。

### 2. 无法连接到子服务器

**现象**: `status` 显示 Disconnected。

**排查**:
- 检查子服务器是否已启动并监听正确端口。
- 检查 `.mcp-hub.json` 中的 `endpoint` URL 是否正确。
- 查看日志输出 (`npm start` 的控制台输出) 获取详细错误信息。

### 3. CLI 命令报错 "No running server found"

**原因**: 找不到 `.mcp-hub.pid` 文件。

**解决方法**:
- 确认服务器是否正在运行。
- 如果服务器确实在运行但 PID 文件丢失，你需要手动查找进程并关闭 (Task Manager 或 `kill`)。
