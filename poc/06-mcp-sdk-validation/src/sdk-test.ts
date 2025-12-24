#!/usr/bin/env tsx
/**
 * MCP TypeScript SDK 基础功能验证测试
 * 功能点：
 * 1. SDK 包导入验证
 * 2. 核心类实例化
 * 3. 基础 API 调用
 * 4. 错误处理机制
 * 5. 协议兼容性检查
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// 错误码定义（符合 MCP Hub Lite 规范）
const ERROR_CODES = {
  // 系统错误 (1000-1999)
  SDK_INITIALIZATION_FAILED: 1501,
  TRANSPORT_ERROR: 1502,
  PROTOCOL_VIOLATION: 1503,

  // MCP 协议错误 (5000-5999)
  TOOL_EXECUTION_FAILED: 5001,
  INVALID_REQUEST: 5002,
  RESPONSE_TIMEOUT: 5003,
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * 自定义错误类型
 */
class SDKValidationError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SDKValidationError';
  }
}

/**
 * 测试结果记录器
 */
interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: SDKValidationError;
  details?: string;
}

const results: TestResult[] = [];

/**
 * 记录测试结果
 */
function recordTest(
  name: string,
  status: TestResult['status'],
  duration: number,
  error?: SDKValidationError,
  details?: string
): void {
  results.push({ name, status, duration, error, details });
  const statusIcon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⊘';
  console.log(`${statusIcon} ${name} (${duration.toFixed(2)}ms) ${error ? `- ${error.message}` : details ?? ''}`);
}

/**
 * 测试 1: SDK 包导入验证
 */
async function testPackageImport(): Promise<void> {
  const start = performance.now();

  try {
    // 验证核心类是否存在
    if (typeof Client !== 'function') {
      throw new SDKValidationError(
        ERROR_CODES.SDK_INITIALIZATION_FAILED,
        'Client class not found in SDK'
      );
    }

    if (typeof Server !== 'function') {
      throw new SDKValidationError(
        ERROR_CODES.SDK_INITIALIZATION_FAILED,
        'Server class not found in SDK'
      );
    }

    // 验证传输层
    if (typeof StdioClientTransport !== 'function') {
      throw new SDKValidationError(
        ERROR_CODES.SDK_INITIALIZATION_FAILED,
        'StdioClientTransport not found'
      );
    }

    if (typeof StdioServerTransport !== 'function') {
      throw new SDKValidationError(
        ERROR_CODES.SDK_INITIALIZATION_FAILED,
        'StdioServerTransport not found'
      );
    }

    // 验证模式定义
    if (!CallToolRequestSchema || !ListToolsRequestSchema) {
      throw new SDKValidationError(
        ERROR_CODES.SDK_INITIALIZATION_FAILED,
        'Request schemas not found'
      );
    }

    recordTest(
      'SDK Package Import',
      'PASS',
      performance.now() - start,
      undefined,
      'All core classes and schemas imported successfully'
    );
  } catch (error) {
    const sdkError = error instanceof SDKValidationError
      ? error
      : new SDKValidationError(
          ERROR_CODES.SDK_INITIALIZATION_FAILED,
          `Import failed: ${error instanceof Error ? error.message : String(error)}`
        );

    recordTest(
      'SDK Package Import',
      'FAIL',
      performance.now() - start,
      sdkError
    );
  }
}

/**
 * 测试 2: 客户端实例化
 */
async function testClientInstantiation(): Promise<void> {
  const start = performance.now();

  try {
    // 测试基础客户端
    const client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    if (!client) {
      throw new SDKValidationError(
        ERROR_CODES.SDK_INITIALIZATION_FAILED,
        'Client instantiation returned null'
      );
    }

    // 客户端实例化成功，它是一个 Protocol 子类
    recordTest(
      'Client Instantiation',
      'PASS',
      performance.now() - start,
      undefined,
      `Client instance created successfully`
    );
  } catch (error) {
    const sdkError = error instanceof SDKValidationError
      ? error
      : new SDKValidationError(
          ERROR_CODES.SDK_INITIALIZATION_FAILED,
          `Client instantiation failed: ${error instanceof Error ? error.message : String(error)}`
        );

    recordTest(
      'Client Instantiation',
      'FAIL',
      performance.now() - start,
      sdkError
    );
  }
}

/**
 * 测试 3: 服务器实例化
 */
async function testServerInstantiation(): Promise<void> {
  const start = performance.now();

  try {
    // 创建服务器实现
    const server = new Server(
      {
        name: 'test-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    if (!server) {
      throw new SDKValidationError(
        ERROR_CODES.SDK_INITIALIZATION_FAILED,
        'Server instantiation returned null'
      );
    }

    // 验证服务器属性
    // 服务器实例化成功，它是一个 Protocol 子类
    recordTest(
      'Server Instantiation',
      'PASS',
      performance.now() - start,
      undefined,
      `Server instance created successfully`
    );
  } catch (error) {
    const sdkError = error instanceof SDKValidationError
      ? error
      : new SDKValidationError(
          ERROR_CODES.SDK_INITIALIZATION_FAILED,
          `Server instantiation failed: ${error instanceof Error ? error.message : String(error)}`
        );

    recordTest(
      'Server Instantiation',
      'FAIL',
      performance.now() - start,
      sdkError
    );
  }
}

/**
 * 测试 4: 协议类型验证
 */
async function testProtocolTypes(): Promise<void> {
  const start = performance.now();

  try {
    // 验证请求模式对象存在且是有效的 Schema
    if (!ListToolsRequestSchema) {
      throw new SDKValidationError(
        ERROR_CODES.PROTOCOL_VIOLATION,
        'ListToolsRequestSchema不存在'
      );
    }

    if (!CallToolRequestSchema) {
      throw new SDKValidationError(
        ERROR_CODES.PROTOCOL_VIOLATION,
        'CallToolRequestSchema不存在'
      );
    }

    // 验证 Schema 对象的结构
    if (typeof ListToolsRequestSchema.parse !== 'function') {
      throw new SDKValidationError(
        ERROR_CODES.PROTOCOL_VIOLATION,
        'ListToolsRequestSchema不是有效的Zod schema'
      );
    }

    if (typeof CallToolRequestSchema.parse !== 'function') {
      throw new SDKValidationError(
        ERROR_CODES.PROTOCOL_VIOLATION,
        'CallToolRequestSchema不是有效的Zod schema'
      );
    }

    // 测试基本的 schema 解析能力（完整的请求对象）
    const listRequest = ListToolsRequestSchema.parse({
      method: 'tools/list',
      params: {}
    });

    const callRequest = CallToolRequestSchema.parse({
      method: 'tools/call',
      params: {
        name: 'test-tool',
        arguments: {}
      }
    });

    recordTest(
      'Protocol Types',
      'PASS',
      performance.now() - start,
      undefined,
      `Schema objects are valid and functional`
    );
  } catch (error) {
    const sdkError = error instanceof SDKValidationError
      ? error
      : new SDKValidationError(
          ERROR_CODES.PROTOCOL_VIOLATION,
          `Protocol type validation failed: ${error instanceof Error ? error.message : String(error)}`
        );

    recordTest(
      'Protocol Types',
      'FAIL',
      performance.now() - start,
      sdkError
    );
  }
}

/**
 * 主测试函数
 */
async function runAllTests(): Promise<void> {
  console.log('='.repeat(60));
  console.log('MCP TypeScript SDK 基础功能验证测试');
  console.log('='.repeat(60));
  console.log('');

  const overallStart = performance.now();

  // 运行所有测试
  await testPackageImport();
  await testClientInstantiation();
  await testServerInstantiation();
  await testProtocolTypes();

  // 计算统计信息
  const totalDuration = performance.now() - overallStart;
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const skipCount = results.filter(r => r.status === 'SKIP').length;

  console.log('');
  console.log('='.repeat(60));
  console.log('测试摘要');
  console.log('='.repeat(60));
  console.log(`总计: ${results.length} 项测试`);
  console.log(`通过: ${passCount} 项`);
  console.log(`失败: ${failCount} 项`);
  console.log(`跳过: ${skipCount} 项`);
  console.log(`总耗时: ${totalDuration.toFixed(2)}ms`);
  console.log('');

  if (failCount > 0) {
    console.log('失败的测试:');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`  ✗ ${r.name}`);
        if (r.error) {
          console.log(`    错误码: ${r.error.code}`);
          console.log(`    消息: ${r.error.message}`);
          if (r.error.context) {
            console.log(`    上下文:`, r.error.context);
          }
        }
      });
    console.log('');
  }

  // 退出码
  if (failCount > 0) {
    console.log('❌ 测试失败');
    process.exit(1);
  } else {
    console.log('✅ 所有测试通过');
    process.exit(0);
  }
}

// 执行测试
runAllTests().catch(error => {
  console.error('测试执行过程中发生未捕获的错误:');
  console.error(error);
  process.exit(1);
});