import { CMDError } from '@models/types.js';

/**
 * Represents a standard MCP (Model Context Protocol) error response.
 * This interface follows the MCP specification for error responses,
 * including optional extended metadata in the 'x-mcp' field.
 */
export interface MCPError {
  /** The numeric error code following JSON-RPC 2.0 and MCP standards */
  code: number;
  /** Human-readable error message describing the issue */
  message: string;
  /** Optional additional error data or context */
  data?: unknown;
  /** Extended MCP-specific metadata (optional) */
  'x-mcp'?: {
    /** Detailed error context and debugging information */
    details?: Record<string, unknown>;
    /** Suggested actions for the client to resolve the error */
    suggestedActions?: string[];
    /** URL to additional documentation or help resources */
    moreInfoUrl?: string;
  };
}

/**
 * Represents a standard JSON-RPC 2.0 response structure.
 * Used internally for handling MCP protocol responses that follow JSON-RPC 2.0 format.
 */
interface JsonRpcResponse {
  /** JSON-RPC version identifier, always "2.0" */
  jsonrpc: string;
  /** Request ID for correlation (can be null for notifications) */
  id?: string | number | null;
  /** Successful response result (mutually exclusive with error) */
  result?: unknown;
  /** Error object if the request failed (mutually exclusive with result) */
  error?: unknown;
}

/**
 * Type guard function to check if an unknown error object is a CMDError.
 * Validates that the object has the required properties of a CMDError.
 *
 * @param error - The error object to validate
 * @returns True if the error is a CMDError, false otherwise
 */
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

/**
 * MCP Hub Lite's error code mapping from internal gateway error codes
 * to standard MCP protocol error codes. This mapping ensures compliance
 * with the MCP specification while maintaining internal error categorization.
 *
 * The mapping follows these conventions:
 * - 6001: Gateway internal error → Service unavailable (-32001)
 * - 6002: Connection timeout → Request timeout (-32002)
 * - 6003: Tool not found → MCP tool not found (-32801)
 * - 6004: Tool execution failed → MCP execution failed (-32802)
 * - 6005: Initialization failed → MCP initialization failed (-32803)
 */
export const MCPHubLiteErrorMap = {
  // Map gateway internal errors to standard MCP error codes
  6001: -32001, // Gateway internal error -> Service unavailable
  6002: -32002, // Connection timeout -> Request timeout
  6003: -32801, // Tool not found -> MCP tool not found
  6004: -32802, // Tool execution failed -> MCP execution failed
  6005: -32803 // Initialization failed -> MCP initialization failed
} as const;

/**
 * MCPErrorHandler provides standardized error handling and conversion for the MCP Hub Lite system.
 * This class is responsible for converting internal application errors (both native JavaScript Error
 * objects and custom CMDError objects) into standardized MCP protocol error responses that comply
 * with the Model Context Protocol specification.
 *
 * The handler ensures consistent error formatting across the entire system, providing appropriate
 * error codes, messages, and extended metadata that clients can use for proper error handling
 * and user feedback. It supports both generic JavaScript errors and structured CMDError objects
 * with categorized error codes.
 *
 * Usage scenarios include:
 * - Converting backend server errors to MCP-compliant responses
 * - Standardizing error responses from different MCP server implementations
 * - Providing consistent error metadata for client-side error handling
 * - Maintaining compatibility with the MCP protocol specification
 */
export class MCPErrorHandler {
  /**
   * Converts internal errors to standardized MCP error responses.
   * This method handles both native JavaScript Error objects and custom CMDError objects,
   * mapping them to appropriate MCP error codes and formatting them according to the
   * MCP protocol specification.
   *
   * For native Error objects, it creates a standard MCP error with service unavailable
   * code (-32001) and includes debugging information like stack trace and error name.
   * For CMDError objects, it maps the internal error code ranges to appropriate MCP
   * standard error codes based on error categories (system, security, business, etc.).
   *
   * @param error - The error to convert, either a native Error or CMDError object
   * @returns A standardized MCPError object compliant with the MCP protocol
   *
   * @example
   * ```typescript
   * // Converting a native Error
   * const mcpError = MCPErrorHandler.toMCPError(new Error('Connection failed'));
   *
   * // Converting a CMDError
   * const cmdError: CMDError = { code: 6003, message: 'Tool not found', data: {} };
   * const mcpError = MCPErrorHandler.toMCPError(cmdError);
   * ```
   */
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

  /**
   * Maps internal CMD error codes to standardized MCP error codes.
   * This private method implements the core logic for converting categorized
   * internal error codes to appropriate MCP standard error codes based on
   * error type ranges:
   *
   * - 1000-1999: System errors → Service unavailable (-32001)
   * - 2000-2999: Security errors → Authentication/Authorization failed (-32806/-32807)
   * - 3000-3999: Business errors → Invalid parameter (-32602)
   * - 5000-5999: MCP protocol errors → Direct mapping or service unavailable
   * - 6000-6999: Gateway-specific errors → Specific MCP error codes via switch
   *
   * The mapping ensures that internal error categorization is preserved while
   * maintaining compliance with the external MCP protocol standard.
   *
   * @param cmdCode - The internal CMD error code to map
   * @returns The corresponding standardized MCP error code
   *
   * @private
   */
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

/**
 * MCPErrorsMiddleware provides middleware functionality for handling and normalizing
 * error responses from backend MCP servers. This class acts as an intermediary layer
 * that ensures all error responses conform to the standard MCP protocol format,
 * regardless of how the backend server originally formatted its errors.
 *
 * The middleware intercepts JSON-RPC responses containing errors and validates
 * whether they already comply with the MCP error standard. If they don't, it
 * converts them using the MCPErrorHandler to ensure consistent error formatting
 * across all connected MCP servers.
 *
 * This is particularly useful when integrating with various MCP server implementations
 * that may have different error handling conventions, ensuring that clients receive
 * standardized error responses regardless of the underlying server implementation.
 */
export class MCPErrorsMiddleware {
  /**
   * Handles and normalizes error responses from backend MCP servers.
   * This method processes JSON-RPC responses and ensures that any error objects
   * are converted to the standard MCP error format if they aren't already compliant.
   *
   * The method performs the following steps:
   * 1. Checks if the response contains an error field
   * 2. Validates if the error is already in standard MCP format
   * 3. If not standard, converts the error to MCP format using MCPErrorHandler
   * 4. Returns the normalized response with standardized error formatting
   *
   * Non-error responses are returned unchanged to maintain performance.
   *
   * @param response - The raw response from a backend MCP server
   * @returns The response with standardized error formatting if applicable, otherwise the original response
   *
   * @example
   * ```typescript
   * // Handle a response with a non-standard error
   * const rawResponse = { jsonrpc: '2.0', id: 1, error: new Error('Connection failed') };
   * const normalizedResponse = MCPErrorsMiddleware.handleBackendMCPErrors(rawResponse);
   * // normalizedResponse.error will be in standard MCP format
   * ```
   */
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

  /**
   * Type guard function to check if an error object conforms to the standard MCP error format.
   * This private method validates that the error object has the required properties
   * (code as number, message as string) and optional data property according to
   * the MCP specification.
   *
   * @param error - The error object to validate
   * @returns True if the error conforms to MCP standard format, false otherwise
   *
   * @private
   */
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
