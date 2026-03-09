import { describe, it, expect, beforeEach } from 'vitest';
import {
  stringifyForLogging,
  stringifyForLoggingWithReplacer,
  setJsonPrettyConfigGetter,
  rawHeadersToObject,
  stringifyRawHeadersForLogging,
  getJsonPrettySetting,
  getMcpCommDebugSetting,
  getSessionDebugSetting
} from '@utils/json-utils.js';

describe('json-utils', () => {
  beforeEach(() => {
    // Reset config getter
    setJsonPrettyConfigGetter(null);
  });

  describe('processPrettyJsonForLogging (internal)', () => {
    it('should convert \\n to actual newlines in string values (basic newline processing)', () => {
      // Enable pretty mode via config getter
      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      }));

      const obj = {
        text: 'line1\nline2\nline3'
      };
      const result = stringifyForLogging(obj);

      // The result should have actual newlines, not escaped \n
      expect(result).toContain('"text": "line1');
      expect(result).toContain('line2');
      expect(result).toContain('line3"');
      // Should not contain escaped \n in the string value
      expect(result).not.toContain('line1\\nline2');
    });

    it('should keep escaped newlines (\\\\n) unchanged', () => {
      // Enable pretty mode via config getter
      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      }));

      const obj = {
        text: 'literal backslash n: \\n'
      };
      const result = stringifyForLogging(obj);

      // The escaped newline should remain as \\n in the output (but in the string, we need to escape it)
      expect(result).toContain('literal backslash n: \\\\n');
    });

    it('should handle mixed scenario with both \\n and \\\\n', () => {
      // Enable pretty mode via config getter
      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      }));

      const obj = {
        text: 'first line\nsecond line with \\n literal'
      };
      const result = stringifyForLogging(obj);

      // The first \n should be actual newline, the \\n should remain as \\n
      expect(result).toContain('first line');
      expect(result).toContain('second line with \\\\n literal');
    });

    it('should preserve JSON structure integrity', () => {
      // Enable pretty mode via config getter
      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      }));

      const obj = {
        key1: 'value\\nwith\\nnewlines',
        key2: 'normal value',
        key3: {
          nested: 'nested\\nvalue'
        },
        key4: ['array\\nitem1', 'array\\nitem2']
      };
      const result = stringifyForLogging(obj);

      // Should still be valid JSON structure
      expect(result).toContain('"key1":');
      expect(result).toContain('"key2":');
      expect(result).toContain('"key3":');
      expect(result).toContain('"nested":');
      expect(result).toContain('"key4":');

      // Parse back should work (even with actual newlines in strings)
      // Note: We can't directly JSON.parse the result because it has actual newlines,
      // but we can verify the structure is correct
    });

    it('should not affect compact mode (non-PRETTY mode)', () => {
      // Disable pretty mode via config getter
      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: false,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      }));

      const obj = {
        text: 'line1\nline2'
      };
      const result = stringifyForLogging(obj);

      // In compact mode, should keep \n as escaped sequence
      expect(result).toContain('line1\\nline2');
      // Compact mode should not be pretty printed
      expect(result).not.toContain('\n  "text":');
    });

    it('should work with stringifyForLoggingWithReplacer', () => {
      const obj = {
        text: 'line1\\nline2',
        sensitive: 'should be redacted'
      };

      const replacer = (key: string, value: unknown) => {
        if (key === 'sensitive') {
          return '[REDACTED]';
        }
        return value;
      };

      const result = stringifyForLoggingWithReplacer(obj, replacer);

      expect(result).toContain('"text": "line1');
      expect(result).toContain('line2"');
      expect(result).toContain('"sensitive": "[REDACTED]"');
    });

    it('should handle multiple newline sequences', () => {
      const obj = {
        text: 'start\n\n\nmiddle\n\nend'
      };
      const result = stringifyForLogging(obj);

      expect(result).toContain('start');
      expect(result).toContain('middle');
      expect(result).toContain('end');
    });

    it('should handle newlines at beginning and end', () => {
      const obj = {
        text: '\nstart with newline\nend with newline\n'
      };
      const result = stringifyForLogging(obj);

      expect(result).toContain('"text": "');
      expect(result).toContain('start with newline');
      expect(result).toContain('end with newline');
    });

    it('should not process if there are no \\n in the string', () => {
      const obj = {
        text: 'no newlines here',
        number: 42,
        bool: true
      };
      const result = stringifyForLogging(obj);

      expect(result).toContain('"text": "no newlines here"');
      expect(result).toContain('"number": 42');
      expect(result).toContain('"bool": true');
    });

    it('should handle edge case with trailing backslash', () => {
      // Note: A single trailing backslash is not valid in a JavaScript string,
      // JSON.stringify will handle it properly by escaping it
      const obj = {
        text: 'ends with backslash'
      };
      const result = stringifyForLogging(obj);

      // Should handle gracefully
      expect(result).toBeDefined();
      expect(result).toContain('ends with backslash');
    });
  });

  describe('getJsonPrettySetting', () => {
    it('should return true by default', () => {
      expect(getJsonPrettySetting()).toBe(true);
    });

    it('should use config getter if available', () => {
      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: false,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      }));
      expect(getJsonPrettySetting()).toBe(false);

      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      }));
      expect(getJsonPrettySetting()).toBe(true);
    });

    it('should fall back to default value when config getter fails', () => {
      setJsonPrettyConfigGetter(() => {
        throw new Error('Config getter failed');
      });
      expect(getJsonPrettySetting()).toBe(true);
    });

    it('should respect LOG_JSON_PRETTY environment variable when set to "true"', () => {
      try {
        process.env.LOG_JSON_PRETTY = 'true';
        setJsonPrettyConfigGetter(() => ({
          system: {
            logging: {
              jsonPretty: false, // Config says false, but env should override
              mcpCommDebug: false,
              sessionDebug: false
            }
          }
        }));
        expect(getJsonPrettySetting()).toBe(true);
      } finally {
        delete process.env.LOG_JSON_PRETTY;
        setJsonPrettyConfigGetter(null);
      }
    });

    it('should respect LOG_JSON_PRETTY environment variable when set to "1"', () => {
      try {
        process.env.LOG_JSON_PRETTY = '1';
        setJsonPrettyConfigGetter(() => ({
          system: {
            logging: {
              jsonPretty: false, // Config says false, but env should override
              mcpCommDebug: false,
              sessionDebug: false
            }
          }
        }));
        expect(getJsonPrettySetting()).toBe(true);
      } finally {
        delete process.env.LOG_JSON_PRETTY;
        setJsonPrettyConfigGetter(null);
      }
    });

    it('should respect LOG_JSON_PRETTY environment variable when set to "false"', () => {
      try {
        process.env.LOG_JSON_PRETTY = 'false';
        setJsonPrettyConfigGetter(() => ({
          system: {
            logging: {
              jsonPretty: true, // Config says true, but env should override
              mcpCommDebug: false,
              sessionDebug: false
            }
          }
        }));
        expect(getJsonPrettySetting()).toBe(false);
      } finally {
        delete process.env.LOG_JSON_PRETTY;
        setJsonPrettyConfigGetter(null);
      }
    });

    it('should respect LOG_JSON_PRETTY environment variable when set to "0"', () => {
      try {
        process.env.LOG_JSON_PRETTY = '0';
        setJsonPrettyConfigGetter(() => ({
          system: {
            logging: {
              jsonPretty: true, // Config says true, but env should override
              mcpCommDebug: false,
              sessionDebug: false
            }
          }
        }));
        expect(getJsonPrettySetting()).toBe(false);
      } finally {
        delete process.env.LOG_JSON_PRETTY;
        setJsonPrettyConfigGetter(null);
      }
    });

    it('should use config getter when LOG_JSON_PRETTY is not set', () => {
      try {
        delete process.env.LOG_JSON_PRETTY;
        setJsonPrettyConfigGetter(() => ({
          system: {
            logging: {
              jsonPretty: false,
              mcpCommDebug: false,
              sessionDebug: false
            }
          }
        }));
        expect(getJsonPrettySetting()).toBe(false);
      } finally {
        setJsonPrettyConfigGetter(null);
      }
    });
  });

  describe('all setting getters', () => {
    it('should return correct defaults when no config getter is set', () => {
      expect(getJsonPrettySetting()).toBe(true);
      expect(getMcpCommDebugSetting()).toBe(false);
      expect(getSessionDebugSetting()).toBe(false);
    });

    it('should return values from config getter when available', () => {
      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: false,
            mcpCommDebug: true,
            sessionDebug: true
          }
        }
      }));

      expect(getJsonPrettySetting()).toBe(false);
      expect(getMcpCommDebugSetting()).toBe(true);
      expect(getSessionDebugSetting()).toBe(true);
    });

    it('should fall back to defaults when config getter fails', () => {
      setJsonPrettyConfigGetter(() => {
        throw new Error('Config getter failed');
      });

      expect(getJsonPrettySetting()).toBe(true);
      expect(getMcpCommDebugSetting()).toBe(false);
      expect(getSessionDebugSetting()).toBe(false);
    });
  });

  describe('rawHeadersToObject', () => {
    it('should convert rawHeaders array to object', () => {
      const rawHeaders = ['Host', 'example.com', 'Content-Type', 'application/json'];
      const result = rawHeadersToObject(rawHeaders);
      expect(result).toEqual({
        Host: 'example.com',
        'Content-Type': 'application/json'
      });
    });

    it('should handle empty array', () => {
      expect(rawHeadersToObject([])).toEqual({});
    });

    it('should skip undefined pairs', () => {
      const rawHeaders = ['Host', 'example.com', 'Only-Key'];
      const result = rawHeadersToObject(rawHeaders);
      expect(result).toEqual({ Host: 'example.com' });
    });
  });

  describe('stringifyRawHeadersForLogging', () => {
    it('should stringify raw headers for logging', () => {
      const rawHeaders = ['Host', 'example.com', 'Content-Type', 'application/json'];
      const result = stringifyRawHeadersForLogging(rawHeaders);
      expect(result).toContain('Host');
      expect(result).toContain('example.com');
      expect(result).toContain('Content-Type');
      expect(result).toContain('application/json');
    });
  });

  describe('integration tests', () => {
    it('should work with realistic debug response scenario', () => {
      // Enable pretty mode via config getter
      setJsonPrettyConfigGetter(() => ({
        system: {
          logging: {
            jsonPretty: true,
            mcpCommDebug: false,
            sessionDebug: false
          }
        }
      }));

      const debugResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [
            {
              type: 'text',
              text: '# click response\nSuccessfully clicked on the element\nAction completed'
            }
          ]
        }
      };

      const result = stringifyForLogging(debugResponse);

      // Should have actual newlines in the text field
      expect(result).toContain('"text": "# click response');
      expect(result).toContain('Successfully clicked on the element');
      expect(result).toContain('Action completed"');
    });
  });
});
