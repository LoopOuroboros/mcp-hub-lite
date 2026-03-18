# MCP Hub Lite Use Guide

## Overview

MCP Hub Lite is a lightweight MCP (Model Context Protocol) gateway that acts as a unified interface between AI assistants and multiple backend MCP servers. This guide explains how to interact with the gateway using the MCP protocol.

## Getting Started

### Step 1: Discover All Resources

First, use `resources/list` to discover all available resources:

```json
// MCP JSON-RPC Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {}
}
```

You'll receive a list of resources including:

- `hub://use-guide` - This guide (you're reading it!)
- `hub://servers/{serverName}` - Server metadata and status for each connected server

### Step 2: Read This Guide

Read the use guide to understand how to interact with the gateway:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "resources/read",
  "params": {
    "uri": "hub://use-guide"
  }
}
```

## Progressive Discovery Workflow

### Phase 1: Server Discovery

#### List All Connected Servers

Use the `list_servers` system tool to see what servers are available:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_servers",
    "arguments": {}
  }
}
```

**Response Example:**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"filesystem\":\"File system operations\",\"time\":\"Time and timezone utilities\",\"server2\":\"Connected MCP server: server2\"}"
      }
    ]
  }
}
```

#### Read Server Metadata

Get detailed information about a specific server by reading its resource:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "resources/read",
  "params": {
    "uri": "hub://servers/filesystem"
  }
}
```

**Response Example:**

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "contents": [
      {
        "uri": "hub://servers/filesystem",
        "mimeType": "application/json",
        "text": "{\"name\":\"filesystem\",\"status\":\"connected\",\"toolsCount\":15,\"tools\":{\"read_file\":\"Read a file from the filesystem\",\"write_file\":\"Write content to a file\",\"list_files\":\"List files in a directory\"},\"resourcesCount\":3,\"tags\":{\"category\":\"storage\"},\"lastHeartbeat\":1739876543210,\"uptime\":3600000,\"description\":\"File system operations\"}"
      }
    ]
  }
}
```

### Phase 2: Tool Discovery

#### Read Server Metadata for Quick Tool Preview

First, read the server metadata resource to see available tools and their descriptions without making additional tool calls:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "resources/read",
  "params": {
    "uri": "hub://servers/time"
  }
}
```

The response includes a `tools` field with tool names mapped to their descriptions:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "result": {
    "contents": [
      {
        "uri": "hub://servers/time",
        "mimeType": "application/json",
        "text": "{\"name\":\"time\",\"status\":\"connected\",\"toolsCount\":2,\"tools\":{\"get_current_time\":\"Get current time in a specific timezones\",\"convert_time\":\"Convert time between timezones\"},\"resourcesCount\":0,\"tags\":{},\"lastHeartbeat\":1739876543210,\"uptime\":3600000,\"description\":\"Connected MCP server: time\"}"
      }
    ]
  }
}
```

#### List Tools from a Specific Server

Once you've identified a server you're interested in, get its tools with `list_tools_in_server`:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "list_tools_in_server",
    "arguments": {
      "serverName": "filesystem"
    }
  }
}
```

**Note:** This returns tool summaries (name and description only). Use `get_tool` to get the complete schema including `inputSchema`.

**Parameters:**

- `serverName` (string, required): The name of the server
- `requestOptions` (object, optional): Session and tag options for instance selection

### Phase 3: Tool Schema Discovery

#### Get Detailed Tool Schema

Before calling a tool, get its complete schema to understand required parameters:

```json
{
  "jsonrpc": "2.0",
  "id": 10,
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": {
      "serverName": "filesystem",
      "toolName": "read_file"
    }
  }
}
```

**Parameters:**

- `serverName` (string, required): The name of the server
- `toolName` (string, required): The name of the tool
- `requestOptions` (object, optional): Session and tag options for instance selection

**Response Example:**

```json
{
  "name": "read_file",
  "description": "Read a file from the filesystem",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "Path to the file"
      },
      "encoding": {
        "type": "string",
        "description": "File encoding",
        "default": "utf-8"
      }
    },
    "required": ["path"]
  },
  "serverName": "filesystem"
}
```

### Phase 4: Tool Calling

#### Call a Tool on a Specific Server

Once you understand the tool schema, call it using `call_tool`:

```json
{
  "jsonrpc": "2.0",
  "id": 11,
  "method": "tools/call",
  "params": {
    "name": "call_tool",
    "arguments": {
      "serverName": "filesystem",
      "toolName": "read_file",
      "toolArgs": {
        "path": "/home/user/document.txt",
        "encoding": "utf-8"
      }
    }
  }
}
```

**Parameters:**

- `serverName` (string, required): The name of the server
- `toolName` (string, required): The name of the tool to call
- `toolArgs` (object, required): Arguments to pass to the tool
- `requestOptions` (object, optional): Session and tag options for instance selection

## System Tools Reference

### Available System Tools

| Tool Name              | Description                             | Parameters                                             |
| ---------------------- | --------------------------------------- | ------------------------------------------------------ |
| `list_servers`         | List all connected MCP servers          | None                                                   |
| `list_tools_in_server` | List all tools from a specific server   | `serverName`, `requestOptions`                         |
| `get_tool`             | Get detailed schema for a specific tool | `serverName`, `toolName`, `requestOptions`             |
| `call_tool`            | Call a tool on a specific server        | `serverName`, `toolName`, `toolArgs`, `requestOptions` |

### Tool Return Data Summary

| Tool                   | Return Type     | Includes inputSchema | Use Case                                |
| ---------------------- | --------------- | -------------------- | --------------------------------------- |
| `list_tools_in_server` | `ToolSummary[]` | ❌ No                | Quick browse of server tools            |
| `get_tool`             | `Tool`          | ✅ Yes               | Get complete schema for tool invocation |

## Progressive Learning Path

### Level 1: Discovery

1. Start with `resources/list` to see what's available
2. Read this guide with `resources/read` on `hub://use-guide`
3. Use `list_servers` to see connected servers

### Level 2: Exploration

1. Pick one server and explore its metadata resource
2. Use `list_tools_in_server` to see its tools

### Level 3: Deep Dive

1. Use `get_tool` to understand tool schemas
2. Practice calling tools with `call_tool`
3. Explore server resources and tools lists

### Level 4: Integration

1. Combine tools from multiple servers
2. Build workflows that chain tool calls
3. Use resource metadata to make smart routing decisions

## Resource URI Reference

### Available Resources

| URI Pattern                  | Description                | MIME Type          |
| ---------------------------- | -------------------------- | ------------------ |
| `hub://use-guide`            | This use guide             | `text/markdown`    |
| `hub://servers/{serverName}` | Server metadata and status | `application/json` |

### Server Metadata Structure

When reading `hub://servers/{serverName}`, you get:

```json
{
  "name": "server-name",
  "status": "connected",
  "toolsCount": 15,
  "tools": {
    "read_file": "Read a file from the filesystem",
    "write_file": "Write content to a file",
    "list_files": "List files in a directory"
  },
  "resourcesCount": 3,
  "tags": {
    "category": "storage",
    "environment": "production"
  },
  "lastHeartbeat": 1739876543210,
  "uptime": 3600000,
  "description": "Server description"
}
```

**Key Fields:**

- `tools`: A map of tool names to their descriptions. Use this to quickly understand what tools are available without additional calls.

## Best Practices

### 1. Always Validate Server Existence

Before calling tools on a server, verify it's listed by `list_servers`.

### 2. Use Progressive Discovery

Don't try to load everything at once. Follow the discovery workflow:

- Resources → Servers → Tools → Schemas → Calls

### 3. Efficient Tool Discovery Workflow

To minimize unnecessary data transfer and improve performance:

1. **Quick Preview**: First read the server metadata resource and check the `tools` field to see available tools and their descriptions
2. **Targeted Query**: For tools you're interested in, use `get_tool` to get the detailed schema including `inputSchema`

**Advantages:**

- The `tools` Record provides quick access to tool names and descriptions, helping LLMs select appropriate tools
- Avoids transferring unnecessary `inputSchema` data that can be large
- More efficient - call `get_tool` only when you need detailed information

**Example Workflow:**

```json
// Step 1: Read server metadata for quick tool preview
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/read",
  "params": {
    "uri": "hub://servers/time"
  }
}

// Response includes tools: {
//   "get_current_time": "Get current time in a specific timezones",
//   "convert_time": "Convert time between timezones"
// }

// Step 2: Get detailed schema for tools of interest (includes inputSchema)
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": {
      "serverName": "time",
      "toolName": "get_current_time"
    }
  }
}
```

### 4. Handle Errors Gracefully

Servers may disconnect or tools may fail. Always handle errors:

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

## Troubleshooting

### Server Not Found

- Verify the server name is correct (case-sensitive!)
- Check `list_servers` to confirm the server is connected
- Ensure the server is enabled in configuration

### Tool Call Fails

- Use `get_tool` to verify the input schema
- Check that all required parameters are provided
- Ensure parameter types match the schema
- Check server logs for error details

### Resource Access Issues

- Ensure the URI format is correct: `hub://servers/{serverName}`
- Confirm the server is connected
- Verify you have the right server name (case-sensitive)

## Complete Example: Get Current Time

This is a complete, real-world example showing how to discover and use the `get_current_time` tool from start to finish.

### Step 1: List All Connected Servers

First, see what servers are available:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_servers",
    "arguments": {}
  }
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"bingcn\":\"Connected MCP server: bingcn\",\"time\":\"Time and timezone utilities\",\"searxng\":\"Connected MCP server: searxng\",\"deepwiki\":\"Connected MCP server: deepwiki\"}"
      }
    ]
  }
}
```

We can see the `time` server is available!

### Step 2: List Tools from the Time Server

Now let's see what tools the `time` server provides:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_tools_in_server",
    "arguments": {
      "serverName": "time"
    }
  }
}
```

**Response:**

```json
{
  "serverName": "time",
  "tools": [
    {
      "name": "get_current_time",
      "description": "Get current time in a specific timezones",
      "serverName": "time"
    },
    {
      "name": "convert_time",
      "description": "Convert time between timezones",
      "serverName": "time"
    }
  ]
}
```

Perfect! We found `get_current_time`.

### Step 3: Get Tool Schema (Input Parameters)

Before calling the tool, let's understand what parameters it requires:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_tool",
    "arguments": {
      "serverName": "time",
      "toolName": "get_current_time"
    }
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
        "description": "IANA timezone name (e.g., 'America/New_York', 'Europe/London'). Use 'Asia/Shanghai' as local timezone if no timezone provided by the user."
      }
    },
    "required": ["timezone"]
  },
  "serverName": "time"
}
```

Great! We need to provide a `timezone` parameter. Let's use `Asia/Shanghai`.

### Step 4: Call the Tool

Now let's call `get_current_time` with the timezone parameter:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "call_tool",
    "arguments": {
      "serverName": "time",
      "toolName": "get_current_time",
      "toolArgs": {
        "timezone": "Asia/Shanghai"
      }
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

Success! We got the current time in Shanghai.

### Alternative: Use Server Metadata for Quick Preview

For even faster discovery, you can read the server metadata resource first to see available tools without additional tool calls:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "resources/read",
  "params": {
    "uri": "hub://servers/time"
  }
}
```

The response includes a `tools` field with tool names and descriptions, perfect for quick browsing!

## Next Steps

Now that you understand the basics:

1. Try the progressive discovery workflow
2. Explore connected servers and their tools
3. Practice calling tools with appropriate parameters
4. Build useful workflows combining multiple tools

---

_Last updated: 2026-03-16_
