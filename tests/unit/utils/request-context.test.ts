import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requestContext, getSessionContext } from '@utils/request-context.js';
import type { SessionContext } from '@shared-types/session-context.types.js';

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
  });

  it('should store and retrieve session context correctly', async () => {
    const testContext = {
      sessionId: 'test-session',
      clientName: 'Test Client',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      timestamp: Date.now()
    };

    await requestContext.run(testContext, () => {
      const context = getSessionContext();
      expect(context).toEqual(testContext);
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
    });
  });

  it('should maintain context isolation between async operations', async () => {
    const context1 = {
      sessionId: 'session-1',
      timestamp: Date.now()
    };

    const context2 = {
      sessionId: 'session-2',
      timestamp: Date.now()
    };

    let result1: SessionContext | undefined;
    let result2: SessionContext | undefined;

    const operation1 = requestContext.run(context1, async () => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10));
      result1 = getSessionContext();
    });

    const operation2 = requestContext.run(context2, async () => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 5));
      result2 = getSessionContext();
    });

    await Promise.all([operation1, operation2]);

    expect(result1).toEqual(context1);
    expect(result2).toEqual(context2);
  });
});
