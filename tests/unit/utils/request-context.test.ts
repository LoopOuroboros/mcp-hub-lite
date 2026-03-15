import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requestContext, getSessionContext, getSessionCwd } from '@utils/request-context.js';

describe('Request Context', () => {
  beforeEach(() => {
    // Clean up any existing context
    requestContext.disable();
  });

  afterEach(() => {
    // Ensure context is cleaned up
    requestContext.disable();
  });

  it('should return undefined when no context is set', () => {
    expect(getSessionContext()).toBeUndefined();
    expect(getSessionCwd()).toBeUndefined();
  });

  it('should store and retrieve session context correctly', async () => {
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
      const context = getSessionContext();
      expect(context).toEqual(testContext);

      const cwd = getSessionCwd();
      expect(cwd).toBe('/test/cwd');
    });
  });

  it('should handle partial context correctly', async () => {
    const partialContext = {
      sessionId: 'partial-session',
      timestamp: Date.now()
    };

    await requestContext.run(partialContext, () => {
      const context = getSessionContext();
      expect(context).toEqual(partialContext);

      const cwd = getSessionCwd();
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
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10));
      result1 = getSessionCwd();
    });

    const operation2 = requestContext.run(context2, async () => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 5));
      result2 = getSessionCwd();
    });

    await Promise.all([operation1, operation2]);

    expect(result1).toBe('/path/1');
    expect(result2).toBe('/path/2');
  });

  it('should return undefined for getSessionCwd when cwd is not set', async () => {
    const contextWithoutCwd = {
      sessionId: 'no-cwd-session',
      timestamp: Date.now()
    };

    await requestContext.run(contextWithoutCwd, () => {
      const cwd = getSessionCwd();
      expect(cwd).toBeUndefined();
    });
  });
});
