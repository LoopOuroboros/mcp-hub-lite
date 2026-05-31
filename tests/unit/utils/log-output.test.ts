import { describe, it, expect } from 'vitest';
import {
  hasDataUriImage,
  simplifyDataUriImages,
  simplifyImageContent,
  isToolsListResponse,
  formatMcpMessageForLogging
} from '@utils/logger/log-output.js';
import { setJsonPrettyConfigGetter, setDevModeEnabled } from '@utils/json-utils.js';

describe('hasDataUriImage', () => {
  it('should detect data:image/png;base64 in JSON', () => {
    const json = JSON.stringify({
      icons: [{ src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' }]
    });
    expect(hasDataUriImage(json)).toBe(true);
  });

  it('should detect data:image/jpeg;base64', () => {
    const json = JSON.stringify({
      icon: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
    });
    expect(hasDataUriImage(json)).toBe(true);
  });

  it('should detect data:image/svg+xml;base64', () => {
    const json = JSON.stringify({
      icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0i'
    });
    expect(hasDataUriImage(json)).toBe(true);
  });

  it('should return false for JSON without data:image', () => {
    const json = JSON.stringify({ name: 'test', value: 123 });
    expect(hasDataUriImage(json)).toBe(false);
  });

  it('should return false for non-base64 data URIs', () => {
    const json = JSON.stringify({ icon: 'https://example.com/icon.png' });
    expect(hasDataUriImage(json)).toBe(false);
  });
});

describe('simplifyDataUriImages', () => {
  it('should replace base64 payload with [Truncated]', () => {
    const input = JSON.stringify({
      icons: [{ src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' }]
    });
    const result = simplifyDataUriImages(input);
    expect(result).toContain('data:image/png;base64,[Truncated]');
    expect(result).not.toContain('iVBORw0KGgoAAAANSUhEUg==');
  });

  it('should handle multiple data URIs in one JSON', () => {
    const input = JSON.stringify({
      icons: [{ src: 'data:image/png;base64,AAAA' }, { src: 'data:image/png;base64,BBBB' }]
    });
    const result = simplifyDataUriImages(input);
    expect(result).toContain('data:image/png;base64,[Truncated]');
    expect(result).not.toContain('AAAA');
    expect(result).not.toContain('BBBB');
  });

  it('should leave non-data-URI strings unchanged', () => {
    const input = JSON.stringify({ name: 'test', url: 'https://example.com/img.png' });
    const result = simplifyDataUriImages(input);
    expect(result).toBe(input);
  });

  it('should produce valid JSON after simplification', () => {
    const input = JSON.stringify({
      icons: [{ src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' }]
    });
    const result = simplifyDataUriImages(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

describe('simplifyImageContent', () => {
  it('should replace MCP image content data with [Truncated]', () => {
    const message = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [{ type: 'image', data: 'base64payload', mimeType: 'image/png' }]
      }
    };
    const json = JSON.stringify(message);
    const result = simplifyImageContent(json);
    expect(result).toContain('"[Truncated]"');
    expect(result).not.toContain('base64payload');
  });
});

describe('isToolsListResponse', () => {
  it('should return true for tools/list response', () => {
    const json = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [{ name: 'tool1' }] }
    });
    expect(isToolsListResponse(json)).toBe(true);
  });

  it('should return true for resources/list response', () => {
    const json = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      result: { resources: [{ uri: 'res1' }] }
    });
    expect(isToolsListResponse(json)).toBe(true);
  });

  it('should return false for initialize response with capabilities (not result.tools)', () => {
    const json = JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      result: {
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'test', version: '1.0' }
      }
    });
    expect(isToolsListResponse(json)).toBe(false);
  });
});

describe('formatMcpMessageForLogging', () => {
  beforeEach(() => {
    setJsonPrettyConfigGetter(null);
    setDevModeEnabled(false);
  });

  it('should truncate data:image URIs in initialize response with icons', () => {
    const message = {
      jsonrpc: '2.0',
      id: 0,
      result: {
        capabilities: {
          tools: {},
          resources: {}
        },
        protocolVersion: '2025-11-25',
        serverInfo: {
          name: 'github-mcp-server',
          title: 'GitHub MCP Server',
          version: 'github-mcp-server/remote-abc123',
          icons: [
            {
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABmJLR0QA/wD/AP+gvaeTAAADK0lEQVR',
              mimeType: 'image/png',
              theme: 'light'
            },
            {
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABmJLR0QA/wD/AP+gvaeTAAAB8ElEQVR',
              mimeType: 'image/png',
              theme: 'dark'
            }
          ]
        }
      }
    };

    const result = formatMcpMessageForLogging(message);

    // Must contain [Truncated] placeholder
    expect(result).toContain('[Truncated]');
    // Must NOT contain the raw base64 payload
    expect(result).not.toContain('iVBORw0KGgoAAAANSUhEUg');
    // Must still contain server info
    expect(result).toContain('github-mcp-server');
  });

  it('should handle initialize response without icons normally', () => {
    const message = {
      jsonrpc: '2.0',
      id: 0,
      result: {
        capabilities: { tools: {} },
        serverInfo: { name: 'test-server', version: '1.0' }
      }
    };

    const result = formatMcpMessageForLogging(message);
    // Should be valid JSON (since isToolsListResponse returns null for empty capabilities,
    // but now hasDataUriImage should be checked first and return false, then
    // isToolsListResponse returns true and returns null, falling to stringifyForLogging)
    expect(result).toContain('test-server');
  });

  it('should simplify tools/list response to count', () => {
    const message = {
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [{ name: 't1' }, { name: 't2' }, { name: 't3' }] }
    };

    const result = formatMcpMessageForLogging(message);
    expect(result).toBe('Returned 3 tools');
  });

  it('should simplify resources/list response to count', () => {
    const message = {
      jsonrpc: '2.0',
      id: 1,
      result: { resources: [{ uri: 'r1' }, { uri: 'r2' }] }
    };

    const result = formatMcpMessageForLogging(message);
    expect(result).toBe('Returned 2 resources');
  });

  it('should not simplify capabilities response (output full JSON)', () => {
    const message = {
      jsonrpc: '2.0',
      id: 1,
      result: {
        capabilities: {
          tools: { list: {}, call: {} },
          resources: { list: {} }
        }
      }
    };

    const result = formatMcpMessageForLogging(message);
    // Capabilities are no longer simplified; expect full JSON output
    expect(result).toContain('capabilities');
    expect(result).toContain('list');
  });
});
