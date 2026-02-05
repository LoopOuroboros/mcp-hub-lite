import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requestContext, getClientContext, getClientCwd } from '@utils/request-context.js';

describe('Request Context', () => {
  beforeEach(() => {
    // 清理任何现有的上下文
    requestContext.disable();
  });

  afterEach(() => {
    // 确保上下文被清理
    requestContext.disable();
  });

  it('should return undefined when no context is set', () => {
    expect(getClientContext()).toBeUndefined();
    expect(getClientCwd()).toBeUndefined();
  });

  it('should store and retrieve client context correctly', async () => {
    const testContext = {
      sessionId: 'test-session',
      clientName: 'Test Client',
      cwd: '/test/cwd',
      project: 'test-project',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      timestamp: Date.now()
    };

    await requestContext.run(testContext, () => {
      const context = getClientContext();
      expect(context).toEqual(testContext);

      const cwd = getClientCwd();
      expect(cwd).toBe('/test/cwd');
    });
  });

  it('should handle partial context correctly', async () => {
    const partialContext = {
      sessionId: 'partial-session',
      timestamp: Date.now()
    };

    await requestContext.run(partialContext, () => {
      const context = getClientContext();
      expect(context).toEqual(partialContext);

      const cwd = getClientCwd();
      expect(cwd).toBeUndefined();
    });
  });

  it('should maintain context isolation between async operations', async () => {
    const context1 = {
      sessionId: 'session-1',
      cwd: '/path/1',
      timestamp: Date.now()
    };

    const context2 = {
      sessionId: 'session-2',
      cwd: '/path/2',
      timestamp: Date.now()
    };

    let result1: string | undefined;
    let result2: string | undefined;

    const operation1 = requestContext.run(context1, async () => {
      // 模拟异步操作
      await new Promise(resolve => setTimeout(resolve, 10));
      result1 = getClientCwd();
    });

    const operation2 = requestContext.run(context2, async () => {
      // 模拟异步操作
      await new Promise(resolve => setTimeout(resolve, 5));
      result2 = getClientCwd();
    });

    await Promise.all([operation1, operation2]);

    expect(result1).toBe('/path/1');
    expect(result2).toBe('/path/2');
  });

  it('should return undefined for getClientCwd when cwd is not set', async () => {
    const contextWithoutCwd = {
      sessionId: 'no-cwd-session',
      timestamp: Date.now()
    };

    await requestContext.run(contextWithoutCwd, () => {
      const cwd = getClientCwd();
      expect(cwd).toBeUndefined();
    });
  });
});