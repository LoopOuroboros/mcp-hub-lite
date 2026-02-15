// CMD error type hierarchy definition
export const CMDErrors = {
  // === System-level errors (1000-1999) ===
  // Infrastructure failures, runtime errors
  SystemErrors: {
    DATABASE_CONNECTION_FAILED: 1001,
    MEMORY_INSUFFICIENT: 1002,
    NETWORK_UNREACHABLE: 1003,
    DISK_FULL: 1004,
    SERVICE_UNAVAILABLE: 1005,
    INTERNAL_SERVER_ERROR: 1500
  } as const,

  // === Security errors (2000-2999) ===
  // Authentication, authorization, security policy related
  SecurityErrors: {
    UNAUTHORIZED: 2001,
    FORBIDDEN: 2003,
    TOKEN_EXPIRED: 2004,
    INVALID_CREDENTIALS: 2005,
    ACCESS_DENIED: 2006,
    RATE_LIMIT_EXCEEDED: 2007
  } as const,

  // === Business logic errors (3000-3999) ===
  // Business rule validation, resource status, etc.
  BusinessErrors: {
    VALIDATION_FAILED: 3001,
    RESOURCE_NOT_FOUND: 3004,
    RESOURCE_ALREADY_EXISTS: 3009,
    INVALID_OPERATION: 3009,
    GROUP_CONSTRAINT_VIOLATION: 3010,
    SERVER_STATUS_CONFLICT: 3011,
    CONFIGURATION_INVALID: 3012
  } as const,

  // === API errors (4000-4999) ===
  // Request format, parameter validation
  APIErrors: {
    INVALID_REQUEST_FORMAT: 4000,
    MISSING_REQUIRED_PARAMETER: 4001,
    INVALID_PARAMETER_VALUE: 4002,
    UNSUPPORTED_MEDIA_TYPE: 4003,
    BAD_REQUEST: 4000
  } as const,

  // === MCP protocol errors (according to MCP standard specification) ===
  // Error code definitions based on MCP protocol standard (https://modelcontextprotocol.io/specification/2025-11-25)
  MCPProtocolErrors: {
    // Standard JSON-RPC 2.0 error code range (-32099 to -32000)
    MCP_SERVER_UNREACHABLE: -32001, // Service unreachable
    MCP_REQUEST_TIMEOUT: -32002, // Request timeout
    MCP_INVALID_RESPONSE: -32003, // Invalid response

    // MCP specific error code range (-32899 to -32800)
    MCP_TOOL_NOT_FOUND: -32801, // Tool not found (corresponds to toolNotFound in MCP specification)
    MCP_EXECUTION_FAILED: -32802, // Execution failed
    MCP_INITIALIZATION_FAILED: -32803, // Initialization failed
    MCP_INVALID_CONFIGURATION: -32804, // Invalid configuration
    MCP_RATE_LIMIT_EXCEEDED: -32805, // Rate limit exceeded
    MCP_AUTHENTICATION_FAILED: -32806, // Authentication failed
    MCP_AUTHORIZATION_FAILED: -32807, // Authorization failed
    MCP_RESOURCE_EXHAUSTED: -32808, // Resource exhausted
    MCP_PRECONDITION_FAILED: -32809, // Precondition failed
    MCP_CONTENT_MODIFIED: -32810, // Content modified
    MCP_LOOP_DETECTED: -32811, // Loop detected
    MCP_NOT_IMPLEMENTED: -32812, // Not implemented
    MCP_NOT_SUPPORTED: -32813, // Not supported
    MCP_TOO_BUSY: -32814, // Overloaded
    MCP_SERVER_SHUTDOWN: -32815 // Server shutdown
  } as const
} as const;

// Merge all error codes
export type AllErrorCodes =
  | (typeof CMDErrors.SystemErrors)[keyof typeof CMDErrors.SystemErrors]
  | (typeof CMDErrors.SecurityErrors)[keyof typeof CMDErrors.SecurityErrors]
  | (typeof CMDErrors.BusinessErrors)[keyof typeof CMDErrors.BusinessErrors]
  | (typeof CMDErrors.APIErrors)[keyof typeof CMDErrors.APIErrors]
  | (typeof CMDErrors.MCPProtocolErrors)[keyof typeof CMDErrors.MCPProtocolErrors]
  | 6000 // MCP Hub Lite gateway internal error
  | 6001
  | 6002
  | 6003
  | 6004
  | 6005;

// Base response interface
export interface CMDBaseResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  timestamp: string;
  requestId?: string;
}

// Success response
export type CMDSuccess<T = unknown> = {
  code: 200 | 201 | 204;
  message: string;
  data: T;
  timestamp: string;
  requestId?: string;
};

// Error response - using hierarchical error codes
export type CMDError = {
  code: AllErrorCodes;
  message: string;
  data: null;
  timestamp: string;
  requestId?: string;
  error?: {
    // Error category identifier
    category: 'SYSTEM' | 'SECURITY' | 'BUSINESS' | 'API' | 'MCP_PROTOCOL';
    // Error severity (for frontend differentiation)
    severity: 'FATAL' | 'ERROR' | 'WARN' | 'INFO';
    // Technical stack information (development environment only)
    stack?: string;
    // Error context
    context?: Record<string, unknown>;
    // HTTP original status code (for compatibility)
    httpStatus?: number;
  };
};
