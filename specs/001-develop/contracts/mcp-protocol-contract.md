# MCP Protocol Contract: MCP-HUB-LITE Gateway

## Overview
This document defines the MCP JSON RPC 2.0 protocol contract for MCP-HUB-LITE as a gateway/proxy server. MCP-HUB-LITE implements the MCP protocol specification and acts as a unified interface to multiple backend MCP servers.

## Protocol Specification
- Protocol: JSON RPC 2.0 over HttpStream
- Content-Type: application/json
- Encoding: UTF-8

## Core Methods

### `tools/list`
Lists all available tools across all connected backend MCP servers, optionally filtered by search query and group.

**Description**:
- Supports filtering and searching for tools across all backend servers
- When no search parameter is provided, returns all available tools
- Supports both human-readable and machine-optimized responses based on request headers
- Supports real-time updates to available tools based on backend server status

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "tools/list",
  "params": {
    "search": "optional search query for name/description filtering",
    "tags": "optional tag filter (e.g., env:prod, category:db)",
    "limit": 20,
    "offset": 0,
    "includeSchema": true
  }
}
```

**Response (Success)**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "tools": [
      {
        "id": "unique-tool-id",
        "name": "tool name",
        "description": "tool description",
        "serverId": "backend-server-id",
        "serverName": "backend server name",
        "inputSchema": {},
        "outputSchema": {},
        "capabilities": ["capability1", "capability2"],
        "status": "available"
      }
    ],
    "total": 100,
    "limit": 10,
    "offset": 0
  }
}
```

**Response (Error)**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": "detailed error message in selected language"
  }
}
```

### `tool/call`
Executes a specific tool on the appropriate backend server.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "tool/call",
  "params": {
    "toolId": "target-tool-id",
    "arguments": {}
  }
}
```

**Response (Success)**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "output": {},
    "executionTimeMs": 123
  }
}
```

### `servers/list`
Lists all registered backend MCP servers.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "servers/list",
  "params": {
    "tags": "optional tag filter (e.g., env:prod, category:db)"
  }
}
```

**Response (Success)**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "servers": [
      {
        "id": "server-id",
        "name": "server name",
        "description": "server description",
        "status": "online|offline|error|starting|stopping",
        "tags": {
          "env": "production",
          "category": "database"
        },
        "toolCount": 10,
        "pid": 12345,
        "cpuUsage": 5.2,
        "memoryUsage": 100.5,
        "uptime": 3600
      }
    ]
  }
}
```

### `server/status`
Gets detailed status of a specific backend server.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "server/status",
  "params": {
    "serverId": "target-server-id"
  }
}
```

**Response (Success)**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "server": {
      "id": "server-id",
      "name": "server name",
      "status": "online|offline|error|starting|stopping",
      "endpoint": "server endpoint",
      "tools": [
        // Tool objects as defined in tools/list
      ],
      "pid": 12345,
      "cpuUsage": 5.2,
      "memoryUsage": 100.5,
      "uptime": 3600,
      "lastHeartbeat": "2025-12-08T10:00:00Z"
    }
  }
}
```

## Gateway-Specific Methods

### `gateway/configure`
Configure gateway-specific settings.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "gateway/configure",
  "params": {
    "timeout": 30000,
    "rateLimit": {
      "requests": 100,
      "windowMs": 60000
    }
  }
}
```

**Response (Success)**:
```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "result": {
    "success": true
  }
}
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON received |
| -32600 | Invalid Request | Request structure is invalid |
| -32601 | Method not found | Requested MCP method doesn't exist |
| -32602 | Invalid params | Parameters provided for the method are invalid |
| -32603 | Internal error | Internal server processing error |
| -32001 | Gateway error | Error in MCP-HUB-LITE gateway processing |
| -32002 | Backend server error | Error from backend MCP server |
| -32003 | Rate limit exceeded | Request rate exceeded limit (default: 100/min per connection) |

## Enhanced Error Response Format

Error responses are localized based on the client's language preference, with the language being determined by user selection > Accept-Language header > default language (zh-CN).

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "error": {
    "code": -32001,
    "message": "Gateway error",
    "data": "本系统未检测到任何可用的MCP服务器",
    "lang": "zh-CN",
    "timestamp": "2025-12-08T10:00:00Z"
  }
}
```

The `data` field contains localized error details based on the selected language. The response includes the language of the error message for transparency, and UTC timestamp for debugging purposes.

## Authentication
No authentication required (single-user developer scenario per spec).

## Internationalization

### Error Message Localization

All error messages and responses in MCP-HUB-LITE are localized according to the client's language preference, determined by this priority:

1. User's language setting in system configuration
2. Accept-Language HTTP header
3. Default fallback language (zh-CN)

### Supported Languages

- **zh-CN**: Simplified Chinese (default)
- **en-US**: English (US)

### Error Message Coverage

The following table demonstrates the localization of error messages:

| English | Chinese | Error Code |
|---------|---------|------------|
| Parse error | 解析错误 | -32700 |
| Invalid Request | 无效请求 | -32600 |
| Method not found | 方法未找到 | -32601 |
| Invalid params | 参数无效 | -32602 |
| Internal error | 内部错误 | -32603 |
| Gateway error | 网关错误 | -32001 |
| Backend server error | 后端服务器错误 | -32002 |
| Rate limit exceeded | 超出速率限制 | -32003 |

## Headers
When using HttpStream transport, the following headers are recognized and processed:

- **Accept-Language**: en-US, zh-CN (for locale-specific error messages)
- **Accept**: application/json (required for JSON RPC 2.0 over HttpStream)
- **Content-Type**: application/json (for requests with bodies)
- **MCP-Client-Version**: version string (for compatibility tracking)

### Recommended Client Headers

For optimal experience with MCP-HUB-LITE:

```json
{
  "Accept-Language": "zh-CN,en-US;q=0.9",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```
---

## 错误码简化设计 *(2025-12-15)*

### 优化说明

基于Kaizen分析和YAGNI原则，原设计的6层错误码系统已简化为**JSON-RPC 2.0标准+2个Hub扩展**的错误码设计，大幅降低了系统复杂性和开发者学习成本。

###  原6层错误码系统（❌已移除）

#### 移除的复杂错误码分类：

| 错误类别 | 错误码范围 | 复杂性问题 |
|----------|------------|------------|
| 系统级错误 | 1000-1999 | 基础设施故障、运行时错误 |
| 安全错误 | 2000-2999 | 认证、授权、安全策略 |
| 业务错误 | 3000-3999 | 业务规则验证、资源状态 |
| API错误 | 4000-4999 | 请求格式、参数验证 |
| MCP协议错误 | -32000 to -32700 | MCP标准协议错误 |
| MCP Hub特定错误 | 6000-6999 | 内部网关错误 |

**移除原因**：
- 学习成本高：开发者需要记住100+错误码
- 过度设计：对小系统来说过分的精细化管理
- 维护复杂：不同层次的错误码追踪和分类

### 新的简化错误码设计（✅当前方案）

#### JSON-RPC 2.0标准错误码：

| English | Chinese | Error Code | 用途 |
|---------|---------|------------|------|
| Parse error | 解析错误 | -32700 | JSON解析失败 |
| Invalid Request | 无效请求 | -32600 | 请求格式错误 |
| Method not found | 方法未找到 | -32601 | MCP方法不存在 |
| Invalid params | 参数无效 | -32602 | 参数验证失败 |
| Internal error | 内部错误 | -32603 | 内部服务器错误 |

#### MCP-HUB-LITE扩展错误码：

| English | Chinese | Error Code | 用途 |
|---------|---------|------------|------|
| Gateway error | 网关错误 | -32001 | Gateway内部错误 |
| Server unreachable | 服务器不可达 | -32002 | 后端MCP Server连接失败 |

**设计特点**：
- **简洁性**：仅保留2个扩展码，其余使用标准错误码
- **兼容性**：完全兼容JSON-RPC 2.0规范
- **清晰性**：每个错误码都有明确、唯一的含义
- **可维护性**：无需复杂的错误分类和归属逻辑

### 错误码映射策略

#### 原复杂错误 → 简化错误映射：

```typescript
const errorMapping = {
  // 系统错误 → Gateway error
  DATABASE_CONNECTION_FAILED: -32001,
  MEMORY_INSUFFICIENT: -32001,
  SERVICE_UNAVAILABLE: -32001,
  
  // 安全错误 → Gateway error
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32001,
  TOKEN_EXPIRED: -32001,
  
  // 业务错误 → Invalid params
  VALIDATION_FAILED: -32602,
  RESOURCE_NOT_FOUND: -32601,
  INVALID_OPERATION: -32602,
  
  // API错误 → Invalid Request
  INVALID_REQUEST_FORMAT: -32600,
  MISSING_REQUIRED_PARAMETER: -32600,
  BAD_REQUEST: -32600
  
  // MCP Server错误 → Server unreachable
  MCP_TOOL_NOT_FOUND: -32002,
  MCP_EXECUTION_FAILED: -32002,
  MCP_SERVER_SHUTDOWN: -32002
};
```

### 错误响应格式

#### 标准错误响应：

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {
      "method": "tools/call",
      "availableMethods": ["tools/list", "initialize"]
    }
  },
  "id": "req-123"
}
```

#### 简化错误响应（保持标准格式）：

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Gateway error",
    "data": {
      "details": "Backend server connection failed",
      "serverId": "mysql-server-001"
    }
  },
  "id": "req-456"
}
```

### 实施建议

#### 1. 错误码使用规范

- **优先使用标准错误码**：所有可映射到JSON-RPC 2.0标准的错误，应直接使用标准码
- **谨慎使用扩展码**：仅在标准码无法准确描述错误时，才使用扩展码
- **详细错误信息放在data字段**：code和message保持简洁，详细信息放在data中

#### 2. 错误处理最佳实践

```typescript
class SimpleErrorHandler {
  static handleError(error: Error): MCPError {
    // 已知错误映射到标准码
    if (error.name === 'ValidationError') {
      return this.createError(-32602, 'Invalid params', error);
    }
    if (error.name === 'ServiceUnavailableError') {
      return this.createError(-32001, 'Gateway error', error);
    }
    
    // 未知错误默认映射
    return this.createError(-32603, 'Internal error', error);
  }
  
  private static createError(code: number, message: string, originalError: Error): MCPError {
    return {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        data: {
          details: process.env.NODE_ENV === 'development' ? originalError.message : undefined,
          timestamp: new Date().toISOString()
        }
      }
    };
  }
}
```

### 下一步

随着系统的发展，如果需要更细粒度的错误分类，可以考虑：
1. 在`error.data`中添加`category`字段进行内部分类
2. 使用统一的错误ID（如UUID）进行错误跟踪
3. 保持错误码不变，通过日志系统进行详细分析

**总结**：通过错误码系统简化，MCP-HUB-LITE大幅降低了系统复杂性，提升了开发体验，同时保持了对JSON-RPC 2.0标准协议的完全兼容。
