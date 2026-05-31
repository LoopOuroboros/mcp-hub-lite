# MCP Hub Lite 使用指南

## 概述

MCP Hub Lite 是一个轻量级 MCP (Model Context Protocol) 网关，作为 AI 助手与多个后端 MCP 服务器之间的统一接口。

## 渐进式发现工作流

| 阶段 | 操作                                    | 目的                              |
| ---- | --------------------------------------- | --------------------------------- |
| 1    | `resources/list`                        | 发现可用资源                      |
| 2    | `resources/read` `hub://servers/{name}` | 预览服务器工具                    |
| 3    | `list_tools`                            | 获取完整工具列表                  |
| 4    | `get_tool`                              | 获取详细 schema（含 inputSchema） |
| 5    | `call_tool`                             | 执行工具调用                      |

## 快速上手

### 发现可用资源

```json
{ "jsonrpc": "2.0", "id": 1, "method": "resources/list", "params": {} }
```

响应包含 `hub://use-guide`（本指南）和 `hub://servers/{serverName}`（各服务器元数据）。

### 列出已连接服务器

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": { "name": "list_servers", "arguments": {} }
}
```

### 预览服务器工具

读取服务器元数据资源即可预览其工具：

```json
{ "jsonrpc": "2.0", "id": 3, "method": "resources/read", "params": { "uri": "hub://servers/time" } }
```

响应中的 `tools` 字段包含工具名到描述的映射。

## 服务器元数据结构

```json
{
  "name": "server-name",
  "status": "connected",
  "toolsCount": 15,
  "tools": { "read_file": "读取文件", "write_file": "写入文件" },
  "resourcesCount": 3,
  "tags": { "category": "storage" },
  "lastHeartbeat": 1739876543210,
  "uptime": 3600000,
  "description": "服务器描述"
}
```

## 系统工具参考

### 可用系统工具

| 工具                        | 说明                     | 参数                                                   |
| --------------------------- | ------------------------ | ------------------------------------------------------ |
| `list_servers`              | 列出所有已连接服务器     | 无                                                     |
| `list_tags`                 | 列出服务器的所有实例标签 | `serverName`                                           |
| `list_tools`                | 列出指定服务器的所有工具 | `serverName`, `requestOptions`                         |
| `get_tool`                  | 获取工具的完整 schema    | `serverName`, `toolName`, `requestOptions`             |
| `search_tools`              | 跨所有服务器搜索工具     | `query`                                                |
| `call_tool`                 | 调用指定服务器上的工具   | `serverName`, `toolName`, `toolArgs`, `requestOptions` |
| `update_server_description` | 更新服务器描述           | `serverName`, `description`                            |

### 工具返回类型

| 工具         | 返回类型        | 包含 inputSchema |
| ------------ | --------------- | ---------------- |
| `list_tools` | `ToolSummary[]` | 否 — 快速浏览    |
| `get_tool`   | `Tool`          | 是 — 供调用使用  |

### 资源 URI 参考

| URI 模式                                    | 说明             | MIME 类型          |
| ------------------------------------------- | ---------------- | ------------------ |
| `hub://use-guide`                           | 本使用指南       | `text/markdown`    |
| `hub://servers/{serverName}`                | 服务器元数据     | `application/json` |
| `hub://servers/{serverName}/tools`          | 服务器工具列表   | `application/json` |
| `hub://servers/{serverName}/resources`      | 服务器资源列表   | `application/json` |
| `hub://servers/{serverName}/{index}/{path}` | MCP 原生资源转发 | 因资源而异         |

## 多实例服务器：标签选择

部分服务器有多个实例，通过标签选择特定实例。

### 查看可用标签

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": { "name": "list_tags", "arguments": { "serverName": "mcp-test" } }
}
```

### 带标签调用工具

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "call_tool",
    "arguments": {
      "serverName": "mcp-test",
      "toolName": "environmentVariableTool",
      "toolArgs": {},
      "requestOptions": { "tags": { "Env": "prod" } }
    }
  }
}
```

### 标签选择规则

- **TAG_MATCH_UNIQUE**：选择标签**精确匹配**所有传入键值对的唯一实例
- 所有传入标签必须匹配，标签值区分大小写

### 错误情况

| 场景                 | 错误信息                                  |
| -------------------- | ----------------------------------------- |
| 未提供标签（多实例） | 返回可用实例列表，要求传入匹配标签        |
| 无实例匹配标签       | `No instance found matching tags: {tags}` |
| 多个实例匹配标签     | `Multiple instances match tags: {tags}`   |

## 最佳实践

1. **验证服务器存在**：调用工具前先确认服务器在 `list_servers` 结果中
2. **渐进式发现**：Resources → Servers → Tools → Schemas → Calls，不要一次加载所有内容
3. **高效工具发现**：先用 `resources/read` 预览工具列表，只在需要 inputSchema 时调用 `get_tool`
4. **错误处理**：常见错误码 -32602（无效参数），检查 `list_servers` 确认服务器状态
5. **缓存服务器信息**：服务器列表和工具 schema 不会频繁变化
6. **参数验证**：调用工具前用 `get_tool` 获取 inputSchema，确保参数类型和必填字段正确

## 故障排除

| 问题         | 解决方法                                        |
| ------------ | ----------------------------------------------- |
| 找不到服务器 | 确认名称正确（区分大小写），检查 `list_servers` |
| 工具调用失败 | 用 `get_tool` 验证 inputSchema 和必填参数       |
| 资源访问失败 | 确认 URI 格式：`hub://servers/{serverName}`     |

---

_最后更新：2026-05-30_
