import { CMDError } from '@models/types.js';

// Define MCPError interface to match the specification
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
  'x-mcp'?: {
    details?: Record<string, unknown>;
    suggestedActions?: string[];
    moreInfoUrl?: string;
  };
}

// JSON-RPC 2.0 response interface
interface JsonRpcResponse {
  jsonrpc: string;
  id?: string | number | null;
  result?: unknown;
  error?: unknown;
}

// Helper function: check if it's a CMDError
function isCMDError(error: unknown): error is CMDError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'data' in error &&
    typeof (error as { code: unknown }).code === 'number' &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

// MCP Hub Lite's MCP protocol error code mapping (compliant with MCP standard)
export const MCPHubLiteErrorMap = {
  // Map gateway internal errors to standard MCP error codes
  6001: -32001, // Gateway internal error -> Service unavailable
  6002: -32002, // Connection timeout -> Request timeout
  6003: -32801, // Tool not found -> MCP tool not found
  6004: -32802, // Tool execution failed -> MCP execution failed
  6005: -32803 // Initialization failed -> MCP initialization failed
} as const;

// MCP error response handler
export class MCPErrorHandler {
  // Convert internal errors to standard MCP errors
  static toMCPError(error: Error | CMDError): MCPError {
    if (error instanceof Error) {
      // Generic error mapping to standard MCP error
      return {
        code: -32001, // Default to service unavailable
        message: error.message,
        data: {
          originalError: error.message,
          timestamp: new Date().toISOString()
        },
        'x-mcp': {
          details: {
            stack: error.stack,
            name: error.name
          },
          suggestedActions: ['Check server status', 'Retry request']
        }
      };
    } else if (isCMDError(error)) {
      // Map CMD errors to MCP errors
      const mcpCode = this.mapCMDToMCPErrorCode(error.code);
      return {
        code: mcpCode,
        message: error.message,
        data: error.data,
        'x-mcp': {
          details: error.error?.context,
          suggestedActions: ['Refer to error details', 'Retry or contact administrator']
        }
      };
    }

    // Default MCP error
    return {
      code: -32001,
      message: 'Unknown error',
      'x-mcp': {
        suggestedActions: ['Retry request']
      }
    };
  }

  // Mapping from CMD error codes to MCP error codes
  private static mapCMDToMCPErrorCode(cmdCode: number): number {
    // System error mapping
    if (cmdCode >= 1000 && cmdCode <= 1999) {
      return -32001; // Service unavailable
    }
    // Security error mapping
    if (cmdCode >= 2000 && cmdCode <= 2999) {
      return -32806; // Authentication failed or -32807 Authorization failed
    }
    // Business error mapping
    if (cmdCode >= 3000 && cmdCode <= 3999) {
      return -32602; // Invalid parameter (typically used for business validation errors)
    }
    // MCP protocol errors, use standard codes directly
    if (cmdCode >= 5000 && cmdCode <= 5999) {
      // If it's a standard MCP error code, return directly
      if (cmdCode >= 5800 && cmdCode <= 5815) {
        // Corresponds to -328xx range
        return -(32900 - (cmdCode - 5800));
      }
      return -32001; // Default
    }

    // Gateway-specific error code mapping
    if (cmdCode >= 6000 && cmdCode <= 6999) {
      switch (cmdCode) {
        case 6001:
          return -32001; // Service unavailable
        case 6002:
          return -32002; // Request timeout
        case 6003:
          return -32801; // Tool not found
        case 6004:
          return -32802; // Execution failed
        default:
          return -32001;
      }
    }

    return -32001; // Default MCP error code
  }
}

// MCP request error handling middleware
export class MCPErrorsMiddleware {
  // Handle error responses from backend MCP servers
  static handleBackendMCPErrors(response: unknown): unknown {
    if (typeof response === 'object' && response !== null && 'error' in response) {
      const rpcResponse = response as JsonRpcResponse;
      // If it's already in standard MCP error format, return directly
      if (this.isStandardMCPError(rpcResponse.error)) {
        return response;
      }

      // Ensure error is of type Error or CMDError
      let errorToConvert: Error | CMDError;
      if (rpcResponse.error instanceof Error) {
        errorToConvert = rpcResponse.error;
      } else if (isCMDError(rpcResponse.error)) {
        errorToConvert = rpcResponse.error;
      } else {
        // If neither, create a generic error
        errorToConvert = new Error(
          typeof rpcResponse.error === 'object' && rpcResponse.error !== null
            ? (rpcResponse.error as { message?: string }).message || 'Unknown error'
            : String(rpcResponse.error)
        );
      }

      // Otherwise convert non-standard errors to standard format
      return {
        jsonrpc: '2.0',
        error: MCPErrorHandler.toMCPError(errorToConvert),
        id: rpcResponse.id
      };
    }

    return response;
  }

  private static isStandardMCPError(error: unknown): error is MCPError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      typeof (error as { code: unknown }).code === 'number' &&
      typeof (error as { message: unknown }).message === 'string' &&
      ('data' in error ? error.data !== undefined : true)
    );
  }
}
