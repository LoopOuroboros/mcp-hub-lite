import { describe, it, expect } from 'vitest';
import { SessionState, SessionStateSchema } from '@shared-models/session.model.js';

describe('Session Model', () => {
  describe('SessionStateSchema', () => {
    it('should validate a valid session state', () => {
      const validState: SessionState = {
        sessionId: 'test-session-123',
        clientName: 'test-client',
        clientVersion: '1.0.0',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        metadata: {}
      };

      // Verify basic type checking
      expect(validState.sessionId).toBe('test-session-123');
      expect(validState.clientName).toBe('test-client');
      expect(validState.createdAt).toBeTypeOf('number');
    });

    it('should allow optional fields to be undefined', () => {
      const minimalState: SessionState = {
        sessionId: 'test-session',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        metadata: {}
      };

      expect(minimalState.sessionId).toBe('test-session');
      expect(minimalState.clientName).toBeUndefined();
    });

    it('should handle metadata with arbitrary keys', () => {
      const stateWithMetadata: SessionState = {
        sessionId: 'test-session',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        metadata: {
          customKey: 'customValue',
          numericKey: 123,
          booleanKey: true
        }
      };

      expect(stateWithMetadata.metadata.customKey).toBe('customValue');
      expect(stateWithMetadata.metadata.numericKey).toBe(123);
    });

    it('should support SessionState type with all optional fields', () => {
      // Test full version
      const fullState: SessionState = {
        sessionId: 'full-session-001',
        clientName: 'test-client',
        clientVersion: '1.0.0',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        metadata: { foo: 'bar', count: 42 }
      };
      expect(fullState.sessionId).toBe('full-session-001');
      expect(fullState.clientName).toBe('test-client');

      // Test minimal version
      const minimalState: SessionState = {
        sessionId: 'minimal-session-001',
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        metadata: {}
      };
      expect(minimalState.sessionId).toBe('minimal-session-001');
      expect(minimalState.clientName).toBeUndefined();

      // Verify Schema validation
      const fullResult = SessionStateSchema.safeParse(fullState);
      const minimalResult = SessionStateSchema.safeParse(minimalState);

      expect(fullResult.success).toBe(true);
      expect(minimalResult.success).toBe(true);
    });
  });
});
