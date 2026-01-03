import { describe, it, expect } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';

describe('MCP Protocol Contract - initialize', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return JSON-RPC 2.0 compliant initialize response', async () => {
    const requestBody = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
          mcpVersion: '2025-11-25'
        },
        capabilities: {
          tools: {
            list: true,
            execute: true
          }
        }
      },
      id: 'init-1'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: requestBody
    });

    expect(response.statusCode).toBe(200);
    const responseBody = response.json();

    // Verify JSON-RPC 2.0 compliance
    expect(responseBody).toHaveProperty('jsonrpc');
    expect(responseBody.jsonrpc).toBe('2.0');
    expect(responseBody).toHaveProperty('id');
    expect(responseBody.id).toBe('init-1');

    // Should have result (not error)
    expect(responseBody).toHaveProperty('result');
    expect(responseBody).not.toHaveProperty('error');

    // Verify result structure
    const result = responseBody.result;
    expect(result).toHaveProperty('serverInfo');
    expect(result.serverInfo).toHaveProperty('name');
    expect(result.serverInfo).toHaveProperty('version');
    expect(result.serverInfo).toHaveProperty('mcpVersion');

    expect(result).toHaveProperty('capabilities');
    expect(result.capabilities).toHaveProperty('tools');
    expect(result.capabilities.tools).toHaveProperty('list');
    expect(result.capabilities.tools).toHaveProperty('execute');
  });

  it('should handle invalid initialize request with proper JSON-RPC error', async () => {
    const invalidRequest = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {}, // Empty params should be handled gracefully
      id: 'init-2'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: invalidRequest
    });

    expect(response.statusCode).toBe(200);
    const responseBody = response.json();

    // Should have result (not error) - our implementation handles empty params
    expect(responseBody).toHaveProperty('result');
    expect(responseBody).not.toHaveProperty('error');
  });

  it('should support ping method as required by MCP spec', async () => {
    const pingRequest = {
      jsonrpc: '2.0',
      method: 'ping',
      id: 'ping-1'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      payload: pingRequest
    });

    expect(response.statusCode).toBe(200);
    const responseBody = response.json();

    expect(responseBody).toHaveProperty('jsonrpc', '2.0');
    expect(responseBody).toHaveProperty('id', 'ping-1');
    expect(responseBody).toHaveProperty('result');
    expect(responseBody.result).toHaveProperty('pong', true);
  });
});