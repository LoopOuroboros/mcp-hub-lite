// CMD 错误类型层级定义
namespace CMDErrors {
  // === 系统级错误 (1000-1999) ===
  // 基础设施故障、运行时错误
  export const SystemErrors = {
    DATABASE_CONNECTION_FAILED: 1001,
    MEMORY_INSUFFICIENT: 1002,
    NETWORK_UNREACHABLE: 1003,
    DISK_FULL: 1004,
    SERVICE_UNAVAILABLE: 1005,
    INTERNAL_SERVER_ERROR: 1500
  } as const;

  // === 安全错误 (2000-2999) ===
  // 认证、授权、安全策略相关
  export const SecurityErrors = {
    UNAUTHORIZED: 2001,
    FORBIDDEN: 2003,
    TOKEN_EXPIRED: 2004,
    INVALID_CREDENTIALS: 2005,
    ACCESS_DENIED: 2006,
    RATE_LIMIT_EXCEEDED: 2007
  } as const;

  // === 业务逻辑错误 (3000-3999) ===
  // 业务规则验证、资源状态等
  export const BusinessErrors = {
    VALIDATION_FAILED: 3001,
    RESOURCE_NOT_FOUND: 3004,
    RESOURCE_ALREADY_EXISTS: 3009,
    INVALID_OPERATION: 3009,
    GROUP_CONSTRAINT_VIOLATION: 3010,
    SERVER_STATUS_CONFLICT: 3011,
    CONFIGURATION_INVALID: 3012
  } as const;

  // === API错误 (4000-4999) ===
  // 请求格式、参数验证
  export const APIErrors = {
    INVALID_REQUEST_FORMAT: 4000,
    MISSING_REQUIRED_PARAMETER: 4001,
    INVALID_PARAMETER_VALUE: 4002,
    UNSUPPORTED_MEDIA_TYPE: 4003,
    BAD_REQUEST: 4000
  } as const;

  // === MCP协议错误 (根据MCP标准规范) ===
  // 基于MCP协议标准的错误码定义 (https://modelcontextprotocol.io/specification/2025-11-25)
  export const MCPProtocolErrors = {
    // 标准JSON-RPC 2.0错误码范围 (-32099 to -32000)
    MCP_SERVER_UNREACHABLE: -32001,  // 服务不可达
    MCP_REQUEST_TIMEOUT: -32002,     // 请求超时
    MCP_INVALID_RESPONSE: -32003,    // 无效响应

    // MCP特定错误码范围 (-32899 to -32800)
    MCP_TOOL_NOT_FOUND: -32801,      // 工具未找到 (对应MCP规范中的toolNotFound)
    MCP_EXECUTION_FAILED: -32802,    // 执行失败
    MCP_INITIALIZATION_FAILED: -32803, // 初始化失败
    MCP_INVALID_CONFIGURATION: -32804, // 无效配置
    MCP_RATE_LIMIT_EXCEEDED: -32805, // 速率限制超限
    MCP_AUTHENTICATION_FAILED: -32806, // 认证失败
    MCP_AUTHORIZATION_FAILED: -32807, // 授权失败
    MCP_RESOURCE_EXHAUSTED: -32808,  // 资源耗尽
    MCP_PRECONDITION_FAILED: -32809, // 前置条件失败
    MCP_CONTENT_MODIFIED: -32810,    // 内容已修改
    MCP_LOOP_DETECTED: -32811,       // 检测到循环
    MCP_NOT_IMPLEMENTED: -32812,     // 未实现
    MCP_NOT_SUPPORTED: -32813,       // 不支持
    MCP_TOO_BUSY: -32814,            // 过载
    MCP_SERVER_SHUTDOWN: -32815      // 服务器关闭
  } as const;
}

// 合并所有错误码
export type AllErrorCodes =
  | typeof CMDErrors.SystemErrors[keyof typeof CMDErrors.SystemErrors]
  | typeof CMDErrors.SecurityErrors[keyof typeof CMDErrors.SecurityErrors]
  | typeof CMDErrors.BusinessErrors[keyof typeof CMDErrors.BusinessErrors]
  | typeof CMDErrors.APIErrors[keyof typeof CMDErrors.APIErrors]
  | typeof CMDErrors.MCPProtocolErrors[keyof typeof CMDErrors.MCPProtocolErrors]
  | 6000  // MCP Hub Lite网关内部错误
  | 6001
  | 6002
  | 6003
  | 6004
  | 6005;

// 基础响应接口
export interface CMDBaseResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  timestamp: string;
  requestId?: string;
}

// 成功响应
export type CMDSuccess<T = unknown> = {
  code: 200 | 201 | 204;
  message: string;
  data: T;
  timestamp: string;
  requestId?: string;
};

// 错误响应 - 使用错误层级码
export type CMDError<T = null> = {
  code: AllErrorCodes;
  message: string;
  data: null;
  timestamp: string;
  requestId?: string;
  error?: {
    // 错误分类标识
    category: "SYSTEM" | "SECURITY" | "BUSINESS" | "API" | "MCP_PROTOCOL";
    // 错误层级（用于前端区分处理）
    severity: "FATAL" | "ERROR" | "WARN" | "INFO";
    // 技术栈信息（仅开发环境）
    stack?: string;
    // 错误上下文
    context?: Record<string, unknown>;
    // HTTP 原始状态码（用于兼容性）
    httpStatus?: number;
  };
};