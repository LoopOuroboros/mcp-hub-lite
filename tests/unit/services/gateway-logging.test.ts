import { describe, test, expect } from 'vitest';
import { GatewayService } from '@services/gateway.service.js';

describe('GatewayService Logging Helpers', () => {
  // Access private methods using type assertion for testing
  const gateway = new GatewayService();

  test('formatToolArgs should handle simple objects', () => {
    const args = { foo: 'bar', num: 42 };
    const result = gateway.formatToolArgs(args);
    expect(result).toContain('foo');
    expect(result).toContain('bar');
    expect(result).toContain('42');
  });

  test('formatToolArgs should truncate long strings', () => {
    const args = { data: 'a'.repeat(1000) };
    const result = gateway.formatToolArgs(args);
    expect(result).toContain('... [truncated]');
    expect(result.length).toBeLessThan(1000);
  });

  test('formatToolArgs should handle circular references', () => {
    // Create object with circular reference for testing
    const obj = { name: 'test' } as unknown as { name: string; self?: unknown };
    obj.self = obj;
    const result = gateway.formatToolArgs(obj);
    expect(result).toContain('[Circular Reference]');
  });

  test('formatToolArgs should handle formatting errors gracefully', () => {
    // Create an object with custom toJSON that throws
    const args = {
      get bad() {
        throw new Error('test error');
      }
    };
    const result = gateway.formatToolArgs(args);
    expect(result).toContain('[Error formatting args:');
  });

  test('formatToolResponse should handle valid responses', () => {
    const response = { content: [{ type: 'text', text: 'Hello' }] };
    const result = gateway.formatToolResponse(response);
    expect(result).toContain('Hello');
  });

  test('formatToolResponse should truncate large responses', () => {
    const response = { content: 'a'.repeat(3000) };
    const result = gateway.formatToolResponse(response);
    expect(result).toContain('... [truncated]');
    expect(result.length).toBeLessThan(2500);
  });
});
