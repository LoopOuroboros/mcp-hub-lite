import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SESSION_MODE_STATEFUL, SESSION_MODE_STATELESS } from '@shared-models/constants.js';

// Mock configManager before importing the module under test
const mockGetConfig = vi.fn();
vi.mock('@config/config-manager.js', () => ({
  configManager: {
    getConfig: () => mockGetConfig()
  }
}));

// We need to import resolveSessionMode from gateway.ts
// It's exported from the module, but the module has side-effects (Fastify routes)
// Use dynamic import after mocks are set up
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resolveSessionMode: any;

beforeEach(async () => {
  vi.resetModules();
  mockGetConfig.mockReset();
  const mod = await import('@api/mcp/gateway.js');
  resolveSessionMode = mod.resolveSessionMode;
});

function makeRequest(headers: Record<string, string> = {}) {
  return { headers } as unknown as Parameters<typeof resolveSessionMode>[0];
}

describe('resolveSessionMode', () => {
  describe('request header override (highest priority)', () => {
    test('x-mcp-session-mode: stateless overrides UA match', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: ['claude-code'], stateless: [] },
            defaultSessionMode: SESSION_MODE_STATEFUL
          }
        }
      });
      const request = makeRequest({
        'x-mcp-session-mode': SESSION_MODE_STATELESS,
        'user-agent': 'claude-code/2.1.140 (cli)'
      });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATELESS);
    });

    test('x-mcp-session-mode: stateful overrides UA match', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: [], stateless: ['cherrystudio'] },
            defaultSessionMode: SESSION_MODE_STATELESS
          }
        }
      });
      const request = makeRequest({
        'x-mcp-session-mode': SESSION_MODE_STATEFUL,
        'user-agent': 'CherryStudio/1.9.7'
      });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATEFUL);
    });
  });

  describe('UA keyword matching', () => {
    test('matches stateless pattern (case-insensitive)', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: [], stateless: ['cherrystudio'] },
            defaultSessionMode: SESSION_MODE_STATEFUL
          }
        }
      });
      const request = makeRequest({
        'user-agent': 'Mozilla/5.0 ... CherryStudio/1.9.7 Chrome/146.0.7680.188 Electron/41.2.1'
      });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATELESS);
    });

    test('matches stateless pattern with different casing in UA', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: [], stateless: ['cherrystudio'] },
            defaultSessionMode: SESSION_MODE_STATEFUL
          }
        }
      });
      const request = makeRequest({ 'user-agent': 'CHERRYSTUDIO/1.9.7' });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATELESS);
    });

    test('matches stateless pattern with different casing in rule', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: [], stateless: ['CherryStudio'] },
            defaultSessionMode: SESSION_MODE_STATEFUL
          }
        }
      });
      const request = makeRequest({ 'user-agent': 'cherrystudio/1.9.7' });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATELESS);
    });

    test('matches stateful pattern', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: ['claude-code'], stateless: [] },
            defaultSessionMode: SESSION_MODE_STATELESS
          }
        }
      });
      const request = makeRequest({ 'user-agent': 'claude-code/2.1.140 (cli)' });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATEFUL);
    });

    test('stateless rules checked before stateful (stateless wins on conflict)', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: ['claude'], stateless: ['claude-code'] },
            defaultSessionMode: SESSION_MODE_STATEFUL
          }
        }
      });
      // "claude-code" matches both "claude" and "claude-code", but stateless checked first
      const request = makeRequest({ 'user-agent': 'claude-code/2.1.140' });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATELESS);
    });
  });

  describe('default fallback', () => {
    test('no matching UA falls back to defaultSessionMode', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: ['claude-code'], stateless: ['cherrystudio'] },
            defaultSessionMode: SESSION_MODE_STATEFUL
          }
        }
      });
      const request = makeRequest({ 'user-agent': 'SomeUnknownClient/1.0' });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATEFUL);
    });

    test('empty UA falls back to defaultSessionMode', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: ['claude-code'], stateless: [] },
            defaultSessionMode: SESSION_MODE_STATEFUL
          }
        }
      });
      const request = makeRequest({});
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATEFUL);
    });

    test('no gateway config falls back to stateful (hardcoded default)', () => {
      mockGetConfig.mockReturnValue({
        system: {}
      });
      const request = makeRequest({ 'user-agent': 'SomeClient/1.0' });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATEFUL);
    });

    test('no config at all falls back to stateful', () => {
      mockGetConfig.mockReturnValue(null);
      const request = makeRequest({ 'user-agent': 'SomeClient/1.0' });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATEFUL);
    });
  });

  describe('empty rules arrays', () => {
    test('empty stateful and stateless arrays use default', () => {
      mockGetConfig.mockReturnValue({
        system: {
          session: {
            sessionModeRules: { stateful: [], stateless: [] },
            defaultSessionMode: SESSION_MODE_STATELESS
          }
        }
      });
      const request = makeRequest({ 'user-agent': 'SomeClient/1.0' });
      expect(resolveSessionMode(request)).toBe(SESSION_MODE_STATELESS);
    });
  });
});
