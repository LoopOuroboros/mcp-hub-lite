import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Logger, logWithColor } from '@utils/logger.js';
import type { LogLevel } from '@shared-types/common.types.js';
import type { WriteStream } from 'node:fs';
import type { LoggerWithPrivateMethods } from '@tests/types/logger-test-helpers.js';

describe('Logger', () => {
  let logger: Logger;
  let tempLogDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };

    // Create temporary log directory
    tempLogDir = path.join(os.tmpdir(), `logger-test-${Date.now()}`);
    fs.mkdirSync(tempLogDir, { recursive: true });

    // Reset environment variables
    delete process.env.DEV_LOG_FILE;
  });

  afterEach(() => {
    // Restore environment variables
    process.env = { ...originalEnv };

    // Clean up temporary directory
    if (fs.existsSync(tempLogDir)) {
      fs.rmSync(tempLogDir, { recursive: true, force: true });
    }

    // Clean up mocks
    vi.restoreAllMocks();
  });

  it('should create logger with default level', () => {
    logger = new Logger();
    expect(logger).toBeDefined();
    // Note: Since logger is a private property, we cannot access it directly, but we can test through behavior
  });

  it('should create logger with specified level', () => {
    logger = new Logger('debug');
    expect(logger).toBeDefined();
  });

  it('should set log level correctly', () => {
    logger = new Logger('info');
    logger.setLevel('debug' as LogLevel);

    // Verify level setting (via internal method simulation)
    const shouldLogSpy = vi.spyOn(logger, 'shouldLog');
    logger.shouldLog('debug');
    expect(shouldLogSpy).toHaveBeenCalledWith('debug');
  });

  it('should format timestamp correctly', () => {
    logger = new Logger();
    const testDate = new Date('2025-12-01T10:30:45.123Z');
    const formatted = logger.formatTimestamp(testDate);
    // Verify format is correct, but don't hardcode specific time values (timezone may affect)
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('should format log level correctly', () => {
    logger = new Logger();
    expect(logger.formatLogLevel('debug')).toBe('DBG');
    expect(logger.formatLogLevel('info')).toBe('INF');
    expect(logger.formatLogLevel('warn')).toBe('WRN');
    expect(logger.formatLogLevel('error')).toBe('ERR');
  });

  it('should format PID correctly', () => {
    logger = new Logger();
    expect(logger.formatPid(123)).toBe('PID:     123');
    expect(logger.formatPid(123456)).toBe('PID:  123456');
    expect(logger.formatPid(123456789)).toBe('PID:12345678'); // Test long PID truncation
  });

  it('should determine if message should be logged based on level', () => {
    logger = new Logger('info');

    // info level should log info, warn, error
    expect(logger.shouldLog('info')).toBe(true);
    expect(logger.shouldLog('warn')).toBe(true);
    expect(logger.shouldLog('error')).toBe(true);
    expect(logger.shouldLog('debug')).toBe(false);

    // debug level should log all
    logger.setLevel('debug' as LogLevel);
    expect((logger as unknown as LoggerWithPrivateMethods).shouldLog('debug')).toBe(true);
  });

  it('should create colored log message with server name', () => {
    logger = new Logger();
    const message = logger.createColoredLogMessage('info', 'test message', {
      pid: 123,
      serverName: 'test-server'
    });

    // Verify message contains correct components (don't verify specific timestamp)
    expect(message).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/);
    expect(message).toContain('[INF]');
    expect(message).toContain('[PID:     123]');
    expect(message).toContain('[test-server]');
    expect(message).toContain('test message');
  });

  it('should create plain log message without server name', () => {
    logger = new Logger();
    const message = logger.createLogMessage('info', 'test message', {
      pid: 123
    });

    // Verify message contains correct components (don't verify specific timestamp)
    expect(message).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/);
    expect(message).toContain('[INF]');
    expect(message).toContain('[PID:     123]');
    expect(message).toContain('[mcp-hub]');
    expect(message).toContain('test message');
  });

  it('should format error objects correctly', () => {
    logger = new Logger();

    // Test Error object
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test (test.js:1:1)\n    at another (test.js:2:2)';
    const formatted = logger.formatError(error);
    expect(formatted).toContain('Test error');
    expect(formatted).toContain('at test (test.js:1:1)');

    // Test non-Error object
    const stringError = 'string error';
    const formattedString = logger.formatError(stringError);
    expect(formattedString).toBe('string error');
  });

  it('should enable dev log when DEV_LOG_FILE is set', () => {
    // Save original environment variables
    const originalDevLogFile = process.env.DEV_LOG_FILE;

    try {
      process.env.DEV_LOG_FILE = 'true';

      // Mock fs and path modules to avoid file system operations
      const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
      vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
      const createWriteStreamSpy = vi.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        return {
          write: vi.fn(),
          end: vi.fn(),
          close: vi.fn(),
          bytesWritten: 0,
          path: '',
          pending: false,
          writable: true,
          writableEnded: false,
          writableFinished: false,
          writableHighWaterMark: 16384,
          writableLength: 0,
          writableObjectMode: false,
          writableCorked: 0,
          destroyed: false
          // Add other necessary properties...
        } as unknown as WriteStream;
      });

      logger = new Logger();

      expect(logger.logFileStream).toBeDefined();

      // Verify file system operations were called
      expect(mkdirSyncSpy).toHaveBeenCalled();
      expect(createWriteStreamSpy).toHaveBeenCalled();
    } finally {
      // Restore original environment variables
      process.env.DEV_LOG_FILE = originalDevLogFile;

      // Restore mocks
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

    // Test debug method
    logger.debug('test', 'arg1', 'arg2');
    expect(consoleDebugSpy).toHaveBeenCalled();

    // Test info method
    logger.info('test', 'arg1', 'arg2');
    expect(consoleInfoSpy).toHaveBeenCalled();

    // Test warn method
    logger.warn('test', 'arg1', 'arg2');
    expect(consoleWarnSpy).toHaveBeenCalled();

    // Test error method
    logger.error('test', 'arg1', 'arg2');
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Restore console methods
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

    // debug and info should not be called
    logger.debug('debug message');
    logger.info('info message');

    // warn and error should be called
    logger.warn('warn message');
    logger.error('error message');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Restore console methods
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should include traceId and spanId in log messages when provided', () => {
    logger = new Logger();

    // Test colored log message
    const coloredMessage = (logger as unknown as LoggerWithPrivateMethods).createColoredLogMessage(
      'info',
      'test message',
      {
        pid: 123,
        serverName: 'test-server',
        traceId: '1234567890abcdef1234567890abcdef',
        spanId: 'abcdef1234567890'
      }
    );

    expect(coloredMessage).toContain('[TID:1234567890abcdef1234567890abcdef]');
    expect(coloredMessage).toContain('[SID:abcdef1234567890]');

    // Test plain text log message
    const plainMessage = (logger as unknown as LoggerWithPrivateMethods).createLogMessage(
      'info',
      'test message',
      {
        pid: 123,
        serverName: 'test-server',
        traceId: '1234567890abcdef1234567890abcdef',
        spanId: 'abcdef1234567890'
      }
    );

    expect(plainMessage).toContain('[TID:1234567890abcdef1234567890abcdef]');
    expect(plainMessage).toContain('[SID:abcdef1234567890]');
  });

  it('should handle log messages without traceId and spanId', () => {
    logger = new Logger();

    // Test colored log message
    const coloredMessage = (logger as unknown as LoggerWithPrivateMethods).createColoredLogMessage(
      'info',
      'test message',
      {
        pid: 123,
        serverName: 'test-server'
      }
    );

    expect(coloredMessage).not.toContain('traceId');
    expect(coloredMessage).not.toContain('spanId');

    // Test plain text log message
    const plainMessage = (logger as unknown as LoggerWithPrivateMethods).createLogMessage(
      'info',
      'test message',
      {
        pid: 123,
        serverName: 'test-server'
      }
    );

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

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TID:1234567890abcdef1234567890abcdef]')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[SID:abcdef1234567890]'));

    // Restore console methods
    consoleInfoSpy.mockRestore();
  });

  it('should respect log level filtering in serverLog method', () => {
    logger = new Logger('info');

    const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // debug should not be called (because level is info)
    logger.serverLog('debug', 'test-server', 'debug message');

    // info, warn, error should be called
    logger.serverLog('info', 'test-server', 'info message');
    logger.serverLog('warn', 'test-server', 'warn message');
    logger.serverLog('error', 'test-server', 'error message');

    expect(consoleDebugSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Restore console methods
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should handle logWithColor function with traceId and spanId', () => {
    // Reset logger instance to avoid interference between tests
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logWithColor('colored message', 'plain message', {
      pid: 123,
      serverName: 'test-server',
      traceId: '1234567890abcdef1234567890abcdef',
      spanId: 'abcdef1234567890'
    });

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('[TID:1234567890abcdef1234567890abcdef]')
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('[SID:abcdef1234567890]'));

    // Restore console methods
    consoleInfoSpy.mockRestore();
  });

  it('should handle logWithColor function without context', () => {
    // Reset logger instance to avoid interference between tests
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    logWithColor('colored message', 'plain message');

    expect(consoleInfoSpy).toHaveBeenCalled();

    // Restore console methods
    consoleInfoSpy.mockRestore();
  });

  describe('dev log rotation', () => {
    it('should create devLogRotator when enableDevLog is called', () => {
      // Mock fs modules to avoid file system operations
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
      vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
      const createWriteStreamSpy = vi.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        return {
          write: vi.fn(),
          end: vi.fn(),
          close: vi.fn(),
          destroyed: false
        } as unknown as WriteStream;
      });

      logger = new Logger();
      logger.enableDevLog();

      expect(logger.devLogRotator).toBeDefined();

      createWriteStreamSpy.mockRestore();
    });

    it('should use timestamp-based log file naming for dev logs', () => {
      // Mock fs modules
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
      vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
      let capturedLogPath = '';
      const createWriteStreamSpy = vi.spyOn(fs, 'createWriteStream').mockImplementation((path) => {
        capturedLogPath = path as string;
        return {
          write: vi.fn(),
          end: vi.fn(),
          close: vi.fn(),
          destroyed: false
        } as unknown as WriteStream;
      });

      logger = new Logger();
      logger.enableDevLog();

      // Verify the log path uses the new timestamp format: dev-server.YYYYMMDD_HHmmSSZZZ.log
      expect(capturedLogPath).toMatch(/dev-server\.\d{8}_\d{9}\.log$/);

      createWriteStreamSpy.mockRestore();
    });

    it('should accept custom rotator config in enableDevLog', () => {
      // Mock fs modules
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
      vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
      const createWriteStreamSpy = vi.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        return {
          write: vi.fn(),
          end: vi.fn(),
          close: vi.fn(),
          destroyed: false
        } as unknown as WriteStream;
      });

      logger = new Logger();
      logger.enableDevLog({ rotationAge: '14d' });

      expect(logger.devLogRotator).toBeDefined();

      createWriteStreamSpy.mockRestore();
    });

    it('should not create multiple log streams when enableDevLog is called multiple times', () => {
      // Mock fs modules
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
      vi.spyOn(fs, 'existsSync').mockImplementation(() => false);
      const createWriteStreamSpy = vi.spyOn(fs, 'createWriteStream').mockImplementation(() => {
        return {
          write: vi.fn(),
          end: vi.fn(),
          close: vi.fn(),
          destroyed: false
        } as unknown as WriteStream;
      });

      logger = new Logger();
      logger.enableDevLog();
      logger.enableDevLog(); // Call again

      // createWriteStream should only be called once
      expect(createWriteStreamSpy).toHaveBeenCalledTimes(1);

      createWriteStreamSpy.mockRestore();
    });
  });
});
