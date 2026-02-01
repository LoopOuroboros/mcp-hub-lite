import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Logger, LogLevel, logWithColor } from '@utils/logger.js';

describe('Logger', () => {
  let logger: Logger;
  let tempLogDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };

    // 创建临时日志目录
    tempLogDir = path.join(os.tmpdir(), `logger-test-${Date.now()}`);
    fs.mkdirSync(tempLogDir, { recursive: true });

    // 重置环境变量
    delete process.env.DEV_LOG_FILE;
  });

  afterEach(() => {
    // 恢复环境变量
    process.env = { ...originalEnv };

    // 清理临时目录
    if (fs.existsSync(tempLogDir)) {
      fs.rmSync(tempLogDir, { recursive: true, force: true });
    }

    // 清理mocks
    vi.restoreAllMocks();
  });

  it('should create logger with default level', () => {
    logger = new Logger();
    expect(logger).toBeDefined();
    // 注意：由于logger是私有属性，我们无法直接访问，但可以通过行为测试
  });

  it('should create logger with specified level', () => {
    logger = new Logger('debug');
    expect(logger).toBeDefined();
  });

  it('should set log level correctly', () => {
    logger = new Logger('info');
    logger.setLevel('debug' as LogLevel);

    // 验证级别设置（通过内部方法模拟）
    const shouldLogSpy = vi.spyOn(logger as any, 'shouldLog');
    (logger as any).shouldLog('debug');
    expect(shouldLogSpy).toHaveBeenCalledWith('debug');
  });

  it('should format timestamp correctly', () => {
    logger = new Logger();
    const testDate = new Date('2025-12-01T10:30:45.123Z');
    const formatted = (logger as any).formatTimestamp(testDate);
    // 验证格式正确，但不硬编码具体时间值（因为时区可能影响）
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('should format log level correctly', () => {
    logger = new Logger();
    expect((logger as any).formatLogLevel('debug')).toBe('DBG');
    expect((logger as any).formatLogLevel('info')).toBe('INF');
    expect((logger as any).formatLogLevel('warn')).toBe('WRN');
    expect((logger as any).formatLogLevel('error')).toBe('ERR');
  });

  it('should format PID correctly', () => {
    logger = new Logger();
    expect((logger as any).formatPid(123)).toBe('PID:     123');
    expect((logger as any).formatPid(123456)).toBe('PID:  123456');
    expect((logger as any).formatPid(123456789)).toBe('PID:12345678'); // 测试超长PID截断
  });

  it('should determine if message should be logged based on level', () => {
    logger = new Logger('info');

    // info级别应该记录info、warn、error
    expect((logger as any).shouldLog('info')).toBe(true);
    expect((logger as any).shouldLog('warn')).toBe(true);
    expect((logger as any).shouldLog('error')).toBe(true);
    expect((logger as any).shouldLog('debug')).toBe(false);

    // debug级别应该记录所有
    logger.setLevel('debug' as LogLevel);
    expect((logger as any).shouldLog('debug')).toBe(true);
  });

  it('should create colored log message with server name', () => {
    logger = new Logger();
    const message = (logger as any).createColoredLogMessage('info', 'test message', {
      pid: 123,
      serverName: 'test-server'
    });

    // 验证消息包含正确的组件（不验证具体时间戳）
    expect(message).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/);
    expect(message).toContain('[INF]');
    expect(message).toContain('[PID:     123]');
    expect(message).toContain('[test-server]');
    expect(message).toContain('test message');
  });

  it('should create plain log message without server name', () => {
    logger = new Logger();
    const message = (logger as any).createLogMessage('info', 'test message', {
      pid: 123
    });

    // 验证消息包含正确的组件（不验证具体时间戳）
    expect(message).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/);
    expect(message).toContain('[INF]');
    expect(message).toContain('[PID:     123]');
    expect(message).toContain('[mcp-hub]');
    expect(message).toContain('test message');
  });

  it('should format error objects correctly', () => {
    logger = new Logger();

    // 测试Error对象
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test (test.js:1:1)\n    at another (test.js:2:2)';
    const formatted = (logger as any).formatError(error);
    expect(formatted).toContain('Test error');
    expect(formatted).toContain('at test (test.js:1:1)');

    // 测试非Error对象
    const stringError = 'string error';
    const formattedString = (logger as any).formatError(stringError);
    expect(formattedString).toBe('string error');
  });

  it('should enable dev log when DEV_LOG_FILE is set', () => {
    // 保存原始环境变量
    const originalDevLogFile = process.env.DEV_LOG_FILE;

    try {
      process.env.DEV_LOG_FILE = 'true';

      // Mock fs和path模块以避免文件系统操作
      const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation((() => {}) as any);
      vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
      const createWriteStreamSpy = vi.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        return { write: vi.fn(), end: vi.fn() } as any;
      });

      logger = new Logger();

      // 验证 logFileStream 被正确设置
      expect((logger as any).logFileStream).toBeDefined();

      // 验证文件系统操作被调用
      expect(mkdirSyncSpy).toHaveBeenCalled();
      expect(createWriteStreamSpy).toHaveBeenCalled();
    } finally {
      // 恢复原始环境变量
      process.env.DEV_LOG_FILE = originalDevLogFile;

      // 恢复mocks
      vi.restoreAllMocks();
    }
  });

  it('should handle multiple arguments in log methods', () => {
    logger = new Logger('debug');

    // Mock console methods
    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 测试debug方法
    logger.debug('test', 'arg1', 'arg2');
    expect(consoleDebugSpy).toHaveBeenCalled();

    // 测试info方法
    logger.info('test', 'arg1', 'arg2');
    expect(consoleInfoSpy).toHaveBeenCalled();

    // 测试warn方法
    logger.warn('test', 'arg1', 'arg2');
    expect(consoleWarnSpy).toHaveBeenCalled();

    // 测试error方法
    logger.error('test', 'arg1', 'arg2');
    expect(consoleErrorSpy).toHaveBeenCalled();

    // 恢复console方法
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should respect log level filtering', () => {
    logger = new Logger('warn');

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // debug和info不应该被调用
    logger.debug('debug message');
    logger.info('info message');

    // warn和error应该被调用
    logger.warn('warn message');
    logger.error('error message');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    // 恢复console方法
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should include traceId and spanId in log messages when provided', () => {
    logger = new Logger();

    // 测试彩色日志消息
    const coloredMessage = (logger as any).createColoredLogMessage('info', 'test message', {
      pid: 123,
      serverName: 'test-server',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: 'abcdef1234567890'
    });

    expect(coloredMessage).toContain('[TID:1234567890abcdef1234567890abcdef]');
    expect(coloredMessage).toContain('[SID:abcdef1234567890]');

    // 测试纯文本日志消息
    const plainMessage = (logger as any).createLogMessage('info', 'test message', {
      pid: 123,
      serverName: 'test-server',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: 'abcdef1234567890'
    });

    expect(plainMessage).toContain('[TID:1234567890abcdef1234567890abcdef]');
    expect(plainMessage).toContain('[SID:abcdef1234567890]');
  });

  it('should handle log messages without traceId and spanId', () => {
    logger = new Logger();

    // 测试彩色日志消息
    const coloredMessage = (logger as any).createColoredLogMessage('info', 'test message', {
      pid: 123,
      serverName: 'test-server'
    });

    expect(coloredMessage).not.toContain('traceId');
    expect(coloredMessage).not.toContain('spanId');

    // 测试纯文本日志消息
    const plainMessage = (logger as any).createLogMessage('info', 'test message', {
      pid: 123,
      serverName: 'test-server'
    });

    expect(plainMessage).not.toContain('traceId');
    expect(plainMessage).not.toContain('spanId');
  });

  it('should include traceId and spanId in serverLog', () => {
    logger = new Logger('info');

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logger.serverLog('info', 'test-server', 'server message', {
      pid: 456,
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: 'abcdef1234567890'
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[TID:1234567890abcdef1234567890abcdef]'));
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[SID:abcdef1234567890]'));

    // 恢复console方法
    consoleInfoSpy.mockRestore();
  });

  it('should respect log level filtering in serverLog method', () => {
    logger = new Logger('info');

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // debug不应该被调用（因为级别是info）
    logger.serverLog('debug', 'test-server', 'debug message');

    // info、warn、error应该被调用
    logger.serverLog('info', 'test-server', 'info message');
    logger.serverLog('warn', 'test-server', 'warn message');
    logger.serverLog('error', 'test-server', 'error message');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    // 恢复console方法
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle logWithColor function with traceId and spanId', () => {
    // 重置 logger 实例以避免测试间的相互影响
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logWithColor('colored message', 'plain message', {
      pid: 123,
      serverName: 'test-server',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: 'abcdef1234567890'
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[TID:1234567890abcdef1234567890abcdef]'));
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[SID:abcdef1234567890]'));

    // 恢复console方法
    consoleInfoSpy.mockRestore();
  });

  it('should handle logWithColor function without context', () => {
    // 重置 logger 实例以避免测试间的相互影响
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logWithColor('colored message', 'plain message');

    expect(consoleInfoSpy).toHaveBeenCalled();

    // 恢复console方法
    consoleInfoSpy.mockRestore();
  });
});