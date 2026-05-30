# MCP Hub Lite Use Guide

## Overview

MCP Hub Lite is a lightweight MCP (Model Context Protocol) gateway that acts as a unified interface between AI assistants and multiple backend MCP servers.

## Progressive Discovery Workflow

| Phase | Action                                     | Purpose                              |
| ----- | ------------------------------------------ | ------------------------------------ |
| 1     | `resources/list`                           | Discover available resources         |
| 2     | `resources/read` on `hub://servers/{name}` | Preview server tools                 |
| 3     | `list_tools`                               | Get full tool list                   |
| 4     | `get_tool`                                 | Get detailed schema with inputSchema |
| 5     | `call_tool`                                | Execute the tool                     |

## Getting Started

### Discover Available Resources

```json
{ "jsonrpc": "2.0", "id": 1, "method": "resources/list", "params": {} }
```

Response includes `hub://use-guide` (this guide) and `hub://servers/{serverName}` (server metadata).

### List Connected Servers

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": { "name": "list_servers", "arguments": {} }
}
```

### Preview Server Tools

Read a server's metadata resource to preview its tools:

```json
{ "jsonrpc": "2.0", "id": 3, "method": "resources/read", "params": { "uri": "hub://servers/time" } }
```

The `tools` field in the response contains a tool-name-to-description map.

## Server Metadata Structure

```json
{
  "name": "server-name",
  "status": "connected",
  "toolsCount": 15,
  "tools": {
    "read_file": "Read a file from the filesystem",
    "write_file": "Write content to a file"
  },
  "resourcesCount": 3,
  "tags": { "category": "storage" },
  "lastHeartbeat": 1739876543210,
  "uptime": 3600000,
  "description": "Server description"
}
```

## System Tools Reference

### Available System Tools

| Tool                        | Description                                   | Parameters                                             |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| `list_servers`              | List all connected MCP servers                | None                                                   |
| `list_tags`                 | List all instance tags for a server           | `serverName`                                           |
| `list_tools`                | List all tools from a specific server         | `serverName`, `requestOptions`                         |
| `get_tool`                  | Get detailed schema for a specific tool       | `serverName`, `toolName`, `requestOptions`             |
| `search_tools`              | Search for tools across all connected servers | `query`                                                |
| `call_tool`                 | Call a tool on a specific server              | `serverName`, `toolName`, `toolArgs`, `requestOptions` |
| `update_server_description` | Update the description of a server            | `serverName`, `description`                            |

### Tool Return Data

| Tool         | Return Type     | Includes inputSchema      |
| ------------ | --------------- | ------------------------- |
| `list_tools` | `ToolSummary[]` | No — quick browse only    |
| `get_tool`   | `Tool`          | Yes — for tool invocation |

### Resource URI Reference

| URI Pattern                                 | Description                    | MIME Type          |
| ------------------------------------------- | ------------------------------ | ------------------ |
| `hub://use-guide`                           | This use guide                 | `text/markdown`    |
| `hub://servers/{serverName}`                | Server metadata                | `application/json` |
| `hub://servers/{serverName}/tools`          | Server tool list               | `application/json` |
| `hub://servers/{serverName}/resources`      | Server resource list           | `application/json` |
| `hub://servers/{serverName}/{index}/{path}` | MCP native resource forwarding | Varies             |

## Multi-Instance Server: Tag-Based Selection

Some servers have multiple instances. Use tags to select a specific instance.

### View Available Tags

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": { "name": "list_tags", "arguments": { "serverName": "mcp-test" } }
}
```

### Call Tool with Tags

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

### Tag Selection Rules

- **TAG_MATCH_UNIQUE**: Selects the single instance whose tags **exactly match** all provided key-value pairs
- All provided tags must match; tag values are case-sensitive

### Error Cases

| Scenario                          | Error Message                                     |
| --------------------------------- | ------------------------------------------------- |
| No tags provided (multi-instance) | Lists available instances, asks for matching tags |
| No instance matches tags          | `No instance found matching tags: {tags}`         |
| Multiple instances match tags     | `Multiple instances match tags: {tags}`           |

## Best Practices

1. **Validate server existence**: Verify the server is listed by `list_servers` before calling tools
2. **Progressive discovery**: Resources → Servers → Tools → Schemas → Calls — don't load everything at once
3. **Efficient tool discovery**: Use `resources/read` to preview tools; call `get_tool` only when you need inputSchema
4. **Handle errors gracefully**: Common error code -32602 (invalid params); check `list_servers` for server status
5. **Cache server information**: Server lists and tool schemas don't change frequently
6. **Validate parameters**: Use `get_tool` to retrieve inputSchema before calling, verify required fields and types

## Troubleshooting

| Issue                 | Solution                                                      |
| --------------------- | ------------------------------------------------------------- |
| Server not found      | Verify name is correct (case-sensitive), check `list_servers` |
| Tool call fails       | Use `get_tool` to verify inputSchema and required parameters  |
| Resource access fails | Confirm URI format: `hub://servers/{serverName}`              |

---

_Last updated: 2026-05-30_
