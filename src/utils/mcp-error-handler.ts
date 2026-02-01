import { CMDError } from '@models/types.js';

// Define MCPError interface to match the specification
export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
  "x-mcp"?: {
    details?: Record<string, unknown>;
    suggestedActions?: string[];
    moreInfoUrl?: string;
  };
}

// 辅助函数：判断是否为CMDError
function isCMDError(error: any): error is CMDError {
  return typeof error === 'object' &&
         error !== null &&
         typeof error.code === 'number' &&
         typeof error.message === 'string' &&
         error.hasOwnProperty('data');
}

// MCP Hub Lite的MCP协议错误码映射 (符合MCP标准)
export const MCPHubLiteErrorMap = {
  // 将网关内部错误映射到标准MCP错误码
  6001: -32001,  // 网关内部错误 -> 服务不可达
  6002: -32002,  // 连接超时 -> 请求超时
  6003: -32801,  // 工具未找到 -> MCP工具未找到
  6004: -32802,  // 工具执行失败 -> MCP执行失败
  6005: -32803,  // 初始化失败 -> MCP初始化失败
} as const;

// MCP错误响应处理器
export class MCPErrorHandler {
  // 将内部错误转换为标准MCP错误
  static toMCPError(error: Error | CMDError): MCPError {
    if (error instanceof Error) {
      // 通用错误映射到标准MCP错误
      return {
        code: -32001,  // 默认为服务不可达
        message: error.message,
        data: {
          originalError: error.message,
          timestamp: new Date().toISOString()
        },
        "x-mcp": {
          details: {
            stack: error.stack,
            name: error.name
          },
          suggestedActions: ["检查服务器状态", "重试请求"]
        }
      };
    } else if (isCMDError(error)) {
      // 将CMD错误映射到MCP错误
      const mcpCode = this.mapCMDToMCPErrorCode(error.code);
      return {
        code: mcpCode,
        message: error.message,
        data: error.data,
        "x-mcp": {
          details: error.error?.context,
          suggestedActions: ["参考错误详情", "重试或联系管理员"]
        }
      };
    }

    // 默认MCP错误
    return {
      code: -32001,
      message: "未知错误",
      "x-mcp": {
        suggestedActions: ["重试请求"]
      }
    };
  }

  // CMD错误码到MCP错误码的映射
  private static mapCMDToMCPErrorCode(cmdCode: number): number {
    // 系统错误映射
    if (cmdCode >= 1000 && cmdCode <= 1999) {
      return -32001; // 服务不可达
    }
    // 安全错误映射
    if (cmdCode >= 2000 && cmdCode <= 2999) {
      return -32806; // 认证失败 或 -32807 授权失败
    }
    // 业务错误映射
    if (cmdCode >= 3000 && cmdCode <= 3999) {
      return -32602; // 无效参数 (通常用于业务验证错误)
    }
    // MCP协议错误，直接使用标准码
    if (cmdCode >= 5000 && cmdCode <= 5999) {
      // 如果是标准MCP错误码，直接返回
      if (cmdCode >= 5800 && cmdCode <= 5815) {
        // 对应-328xx范围
        return -(32900 - (cmdCode - 5800));
      }
      return -32001; // 默认
    }

    // 网关特定错误码映射
    if (cmdCode >= 6000 && cmdCode <= 6999) {
      switch(cmdCode) {
        case 6001: return -32001; // 服务不可达
        case 6002: return -32002; // 请求超时
        case 6003: return -32801; // 工具未找到
        case 6004: return -32802; // 执行失败
        default: return -32001;
      }
    }

    return -32001; // 默认MCP错误码
  }
}

// MCP请求错误处理中间件
export class MCPErrorsMiddleware {
  // 处理来自后端MCP服务器的错误响应
  static handleBackendMCPErrors(response: any): any {
    if (response.error) {
      // 如果已经是标准MCP错误格式，直接返回
      if (this.isStandardMCPError(response.error)) {
        return response;
      }

      // 否则将非标准错误转换为标准格式
      return {
        jsonrpc: "2.0",
        error: MCPErrorHandler.toMCPError(response.error),
        id: response.id
      };
    }

    return response;
  }

  private static isStandardMCPError(error: any): error is MCPError {
    return typeof error.code === 'number' &&
           typeof error.message === 'string' &&
           (error.data === undefined || typeof error.data !== 'undefined');
  }
}