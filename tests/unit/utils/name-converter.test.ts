import { describe, it, expect } from 'vitest';
import { normalizeToolName } from '@utils/name-converter.js';

describe('name-converter', () => {
  describe('normalizeToolName', () => {
    it('should convert kebab-case to snake_case', () => {
      expect(normalizeToolName('list-servers')).toBe('list_servers');
      expect(normalizeToolName('get-tool')).toBe('get_tool');
      expect(normalizeToolName('call-tool')).toBe('call_tool');
    });

    it('should convert uppercase to lowercase', () => {
      expect(normalizeToolName('LIST_SERVERS')).toBe('list_servers');
      expect(normalizeToolName('GET_TOOL')).toBe('get_tool');
      expect(normalizeToolName('LIST_SERVERS_TOOL')).toBe('list_servers_tool');
    });

    it('should convert mixed case to lowercase with underscores', () => {
      expect(normalizeToolName('ListServers')).toBe('list_servers');
      expect(normalizeToolName('GetTool')).toBe('get_tool');
      expect(normalizeToolName('chatCompletions')).toBe('chat_completions');
    });

    it('should convert space-separated to underscores', () => {
      expect(normalizeToolName('list servers')).toBe('list_servers');
      expect(normalizeToolName('get tool info')).toBe('get_tool_info');
    });

    it('should handle already normalized names', () => {
      expect(normalizeToolName('list_servers')).toBe('list_servers');
      expect(normalizeToolName('get_tool')).toBe('get_tool');
      expect(normalizeToolName('chat_completions')).toBe('chat_completions');
    });

    it('should remove leading and trailing underscores', () => {
      expect(normalizeToolName('_list_servers_')).toBe('list_servers');
      expect(normalizeToolName('__get_tool__')).toBe('get_tool');
    });

    it('should handle multiple consecutive separators', () => {
      expect(normalizeToolName('list--servers')).toBe('list_servers');
      expect(normalizeToolName('list__servers')).toBe('list_servers');
      expect(normalizeToolName('list   servers')).toBe('list_servers');
      expect(normalizeToolName('list-_-servers')).toBe('list_servers');
    });

    it('should handle empty string', () => {
      expect(normalizeToolName('')).toBe('');
    });

    it('should handle single character', () => {
      expect(normalizeToolName('a')).toBe('a');
      expect(normalizeToolName('A')).toBe('a');
    });

    it('should handle names with numbers', () => {
      expect(normalizeToolName('tool123')).toBe('tool123');
      expect(normalizeToolName('tool_123')).toBe('tool_123');
      expect(normalizeToolName('tool-123')).toBe('tool_123');
    });
  });

  describe('normalization consistency', () => {
    it('should normalize different formats to the same value for same base name', () => {
      // All these should normalize to the same value
      const normalized = normalizeToolName('list_servers');
      expect(normalizeToolName('list-servers')).toBe(normalized);
      expect(normalizeToolName('LIST_SERVERS')).toBe(normalized);
      expect(normalizeToolName('list_servers')).toBe(normalized);
      expect(normalizeToolName('List_Servers')).toBe(normalized);
    });

    it('should convert camelCase to snake_case', () => {
      // Note: camelCase normalization properly handles uppercase boundaries
      // e.g., 'chatCompletions' -> 'chat_Completions' -> 'chat_completions'
      expect(normalizeToolName('chatCompletions')).toBe('chat_completions');
      expect(normalizeToolName('getTool')).toBe('get_tool');
      expect(normalizeToolName('listServers')).toBe('list_servers');
    });
  });
});
