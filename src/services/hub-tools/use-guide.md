# MCP Hub Lite Use Guide

## Overview

MCP Hub Lite is a lightweight MCP (Model Context Protocol) gateway that acts as a unified interface between AI assistants and multiple backend MCP servers. This guide explains how to interact with the gateway using the MCP protocol.

## Getting Started

### Step 1: Discover Available Resources

Use `resources/list` to discover all available resources:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {}
}
```

Response includes:

- `hub://use-guide` - This guide
- `hub://servers/{serverName}` - Server metadata for each connected server

### Step 2: List Connected Servers

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_servers",
    "arguments": {}
  }
}
```

**Response Example:**

```json
[
  {
    "type": "text",
    "text": "{\"filesystem\":\"File system operations\",\"time\":\"Time and timezone utilities\"}"
  }
]
```

### Step 3: Read Server Metadata

Read a server's metadata resource to preview available tools:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "hub://servers/time"
  }
}
```

**Response includes a `tools` field for quick preview:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "contents": [
      {
        "uri": "hub://servers/time",
        "mimeType": "application/json",
        "text": "{\"name\":\"time\",\"status\":\"connected\",\"tools\":{\"get_current_time\":\"Get current time\",\"convert_time\":\"Convert time between timezones\"}}"
      }
    ]
  }
}
```

## Core Concepts

### Progressive Discovery Workflow

| Phase | Action                                     | Purpose                              |
| ----- | ------------------------------------------ | ------------------------------------ |
| 1     | `resources/list`                           | Discover available resources         |
| 2     | `resources/read` on `hub://servers/{name}` | Preview server tools                 |
| 3     | `list_tools`                               | Get full tool list                   |
| 4     | `get_tool`                                 | Get detailed schema with inputSchema |
| 5     | `call_tool`                                | Execute the tool                     |

### Server Metadata Structure

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
  "tags": {
    "category": "storage"
  },
  "lastHeartbeat": 1739876543210,
  "uptime": 3600000,
  "description": "Server description"
}
```

## System Tools Reference

### Available System Tools

| Tool Name      | Description                             | Parameters                                             |
| -------------- | --------------------------------------- | ------------------------------------------------------ |
| `list_servers` | List all connected MCP servers          | None                                                   |
| `list_tools`   | List all tools from a specific server   | `serverName`, `requestOptions`                         |
| `get_tool`     | Get detailed schema for a specific tool | `serverName`, `toolName`, `requestOptions`             |
| `call_tool`    | Call a tool on a specific server        | `serverName`, `toolName`, `toolArgs`, `requestOptions` |

### Tool Return Data

| Tool         | Return Type     | Includes inputSchema      |
| ------------ | --------------- | ------------------------- |
| `list_tools` | `ToolSummary[]` | No - quick browse only    |
| `get_tool`   | `Tool`          | Yes - for tool invocation |

### Resource URI Reference

| URI Pattern                                 | Description                    | MIME Type          | Discovery Method   |
| ------------------------------------------- | ------------------------------ | ------------------ | ------------------ |
| `hub://use-guide`                           | This use guide                 | `text/markdown`    | `resources/list`   |
| `hub://servers/{serverName}`                | Server metadata and status     | `application/json` | `resources/list`   |
| `hub://servers/{serverName}/tools`          | List all tools from server     | `application/json` | Direct access only |
| `hub://servers/{serverName}/resources`      | List all resources from server | `application/json` | Direct access only |
| `hub://servers/{serverName}/{index}/{path}` | MCP native resource forwarding | Varies by resource | `resources/list`   |

## Best Practices

### 1. Validate Server Existence

Before calling tools on a server, verify it's listed by `list_servers`.

### 2. Use Progressive Discovery

Don't try to load everything at once:

- Resources → Servers → Tools → Schemas → Calls

### 3. Efficient Tool Discovery

**Recommended workflow:**

1. **Quick Preview**: Read `hub://servers/{name}` to see tool names and descriptions
2. **Detailed Schema**: Call `get_tool` only when you need the `inputSchema`

**Example:**

```json
// Step 1: Preview tools (no additional calls needed)
{
  "method": "resources/read",
  "params": { "uri": "hub://servers/time" }
}
// Response has tools: { "get_current_time": "...", "convert_time": "..." }

// Step 2: Get schema when needed
{
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": { "serverName": "time", "toolName": "get_current_time" }
  }
}
```

### 4. Handle Errors Gracefully

```json
{
  "jsonrpc": "2.0",
  "id": 99,
  "error": {
    "code": -32602,
    "message": "Server not found: filesystem"
  }
}
```

### 5. Cache Server Information

Server lists and tool schemas don't change frequently. Cache them when appropriate.

### 6. Parameter Validation Best Practices

Always validate your tool parameters before making calls:

1. **Get the tool schema first**: Use `get_tool` to retrieve the complete input schema
2. **Validate required parameters**: Ensure all required fields are present
3. **Check parameter types**: Verify that parameter types match the schema expectations

**Example workflow for safe tool calling:**

```json
// Step 1: Get tool schema
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": {
      "serverName": "filesystem",
      "toolName": "read_file"
    }
  }
}

// Step 2: Validate your parameters against the returned schema
// Step 3: Make the actual tool call with validated parameters
```

If you receive a parameter validation error, the error message will include a ready-to-use `get_tool` example to help you retrieve the correct schema.

## Complete Example: Get Current Time

### Step 1: List Servers

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": { "name": "list_servers", "arguments": {} }
}
```

### Step 2: Get Tool Schema

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": { "serverName": "time", "toolName": "get_current_time" }
  }
}
```

**Response:**

```json
{
  "name": "get_current_time",
  "description": "Get current time in a specific timezones",
  "inputSchema": {
    "type": "object",
    "properties": {
      "timezone": {
        "type": "string",
        "description": "IANA timezone name (e.g., 'Asia/Shanghai')"
      }
    },
    "required": ["timezone"]
  },
  "serverName": "time"
}
```

### Step 3: Call the Tool

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "call_tool",
    "arguments": {
      "serverName": "time",
      "toolName": "get_current_time",
      "toolArgs": { "timezone": "Asia/Shanghai" }
    }
  }
}
```

**Response:**

```json
{
  "timezone": "Asia/Shanghai",
  "datetime": "2026-03-16T20:46:53+08:00",
  "day_of_week": "Monday",
  "is_dst": false
}
```

## Troubleshooting

| Issue                 | Solution                                                      |
| --------------------- | ------------------------------------------------------------- |
| Server not found      | Verify name is correct (case-sensitive), check `list_servers` |
| Tool call fails       | Use `get_tool` to verify input schema and required parameters |
| Resource access fails | Confirm URI format: `hub://servers/{serverName}`              |

---

_Last updated: 2026-04-12_
