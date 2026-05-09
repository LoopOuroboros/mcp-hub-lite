// Error response - using hierarchical error codes
export type CMDError = {
  code: number;
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
