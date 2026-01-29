import { describe, it, expect } from 'vitest';
import { MCPErrorHandler, MCPError, MCPHubLiteErrorMap, MCPErrorsMiddleware } from '../../../src/utils/mcp-error-handler.js';
import { CMDError } from '../../../src/models/types.js';

describe('MCPErrorHandler', () => {
  describe('toMCPError', () => {
    it('should convert Error instance to MCPError', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test (test.js:1:1)';
      error.name = 'TestError';

      const mcpError = MCPErrorHandler.toMCPError(error);

      expect(mcpError).toMatchObject({
        code: -32001,
        message: 'Test error',
        data: {
          originalError: 'Test error',
          timestamp: expect.any(String)
        }
      });

      expect(mcpError['x-mcp']).toMatchObject({
        details: {
          stack: 'Error: Test error\n    at test (test.js:1:1)',
          name: 'TestError'
        },
        suggestedActions: ["检查服务器状态", "重试请求"]
      });
    });

    it('should convert CMDError to MCPError with proper mapping', () => {
      const cmdError: CMDError = {
        code: 6001,
        message: 'Gateway internal error',
        data: null,
        timestamp: '2025-12-01T10:30:00.000Z',
        requestId: 'req-123',
        error: {
          category: 'SYSTEM',
          severity: 'ERROR',
          context: { serverId: 'server-1' }
        }
      };

      const mcpError = MCPErrorHandler.toMCPError(cmdError);

      expect(mcpError.code).toBe(-32001); // mapped from 6001
      expect(mcpError.message).toBe('Gateway internal error');
      expect(mcpError.data).toBeNull();
      expect(mcpError['x-mcp']).toMatchObject({
        details: { serverId: 'server-1' },
        suggestedActions: ["参考错误详情", "重试或联系管理员"]
      });
    });

    it('should handle unknown error type', () => {
      const unknownError = 'unknown error' as any;

      const mcpError = MCPErrorHandler.toMCPError(unknownError);

      expect(mcpError).toMatchObject({
        code: -32001,
        message: '未知错误'
      });

      expect(mcpError['x-mcp']).toMatchObject({
        suggestedActions: ["重试请求"]
      });
    });
  });

  describe('mapCMDToMCPErrorCode', () => {
    it('should map system errors (1000-1999) to -32001', () => {
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](1001)).toBe(-32001);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](1500)).toBe(-32001);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](1999)).toBe(-32001);
    });

    it('should map security errors (2000-2999) to -32806', () => {
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](2001)).toBe(-32806);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](2500)).toBe(-32806);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](2999)).toBe(-32806);
    });

    it('should map business errors (3000-3999) to -32602', () => {
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](3001)).toBe(-32602);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](3500)).toBe(-32602);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](3999)).toBe(-32602);
    });

    it('should map MCP Hub Lite gateway errors (6000-6999)', () => {
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](6001)).toBe(-32001);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](6002)).toBe(-32002);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](6003)).toBe(-32801);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](6004)).toBe(-32802);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](6005)).toBe(-32001); // default for unmapped codes
    });

    it('should return default -32001 for unknown error codes', () => {
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](9999)).toBe(-32001);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](0)).toBe(-32001);
      expect(MCPErrorHandler['mapCMDToMCPErrorCode'](-1)).toBe(-32001);
    });
  });

  describe('MCPHubLiteErrorMap', () => {
    it('should have correct error code mappings', () => {
      expect(MCPHubLiteErrorMap[6001]).toBe(-32001);
      expect(MCPHubLiteErrorMap[6002]).toBe(-32002);
      expect(MCPHubLiteErrorMap[6003]).toBe(-32801);
      expect(MCPHubLiteErrorMap[6004]).toBe(-32802);
      expect(MCPHubLiteErrorMap[6005]).toBe(-32803);
    });
  });

  describe('MCPErrorsMiddleware', () => {
    it('should handle backend MCP errors and convert non-standard errors', () => {
      const response = {
        jsonrpc: '2.0',
        id: 'test-id',
        error: new Error('Backend error')
      };

      const result = MCPErrorsMiddleware.handleBackendMCPErrors(response);

      expect(result.jsonrpc).toBe('2.0');
      expect(result.id).toBe('test-id');
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe(-32001);
      expect(result.error.message).toBe('Backend error');
    });

    it('should return standard MCP errors unchanged', () => {
      const standardMCPError: MCPError = {
        code: -32801,
        message: 'Tool not found',
        data: { toolName: 'non-existent-tool' }
      };

      const response = {
        jsonrpc: '2.0',
        id: 'test-id',
        error: standardMCPError
      };

      const result = MCPErrorsMiddleware.handleBackendMCPErrors(response);

      expect(result).toBe(response); // should be the same object
    });

    it('should return response unchanged when no error', () => {
      const response = {
        jsonrpc: '2.0',
        id: 'test-id',
        result: { success: true }
      };

      const result = MCPErrorsMiddleware.handleBackendMCPErrors(response);

      expect(result).toBe(response); // should be the same object
    });
  });

  describe('isStandardMCPError', () => {
    it('should identify standard MCP errors', () => {
      const standardError: MCPError = {
        code: -32801,
        message: 'Tool not found'
      };

      const isStandard = (MCPErrorsMiddleware as any)['isStandardMCPError'](standardError);
      expect(isStandard).toBe(true);
    });

    it('should reject non-standard errors', () => {
      const nonStandardError = {
        code: 'invalid-code', // not a number
        message: 'Invalid error'
      };

      const isStandard = (MCPErrorsMiddleware as any)['isStandardMCPError'](nonStandardError);
      expect(isStandard).toBe(false);
    });

    it('should reject errors without message', () => {
      const invalidError = {
        code: -32801
        // missing message
      };

      const isStandard = (MCPErrorsMiddleware as any)['isStandardMCPError'](invalidError);
      expect(isStandard).toBe(false);
    });
  });
});