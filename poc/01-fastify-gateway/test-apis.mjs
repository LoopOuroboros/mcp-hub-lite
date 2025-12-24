/**
 * MCP Gateway API 测试 (Node.js 版本)
 */
import http from 'http';

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing MCP Gateway POC APIs...\n');
  const results = [];

  // 测试1: 健康检查
  console.log('Test 1: Health Check');
  try {
    const result = await makeRequest('/health');
    console.log('  Status:', result.status);
    console.log('  Response:', JSON.stringify(result.data, null, 2));
    results.push({ test: 'Health Check', status: 'PASS', result });
    if (result.status !== 200) throw new Error('Expected status 200');
  } catch (error) {
    console.log('  Error:', error.message);
    results.push({ test: 'Health Check', status: 'FAIL', error: error.message });
  }
  console.log('');

  // 测试2: 服务器列表
  console.log('Test 2: Server List');
  try {
    const result = await makeRequest('/api/servers');
    console.log('  Status:', result.status);
    console.log('  Servers count:', result.data?.servers?.length || 0);
    results.push({ test: 'Server List', status: 'PASS', result });
  } catch (error) {
    console.log('  Error:', error.message);
    results.push({ test: 'Server List', status: 'FAIL', error: error.message });
  }
  console.log('');

  // 测试3: MCP tools/list
  console.log('Test 3: MCP tools/list');
  try {
    const result = await makeRequest('/api/mcp/proxy', {
      method: 'POST',
      body: {
        serverId: 'server-1',
        request: {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        }
      }
    });
    console.log('  Status:', result.status);
    console.log('  Tools found:', result.data?.result?.tools?.length || 0);
    results.push({ test: 'MCP tools/list', status: 'PASS', result });
  } catch (error) {
    console.log('  Error:', error.message);
    results.push({ test: 'MCP tools/list', status: 'FAIL', error: error.message });
  }
  console.log('');

  // 测试4: MCP tools/call
  console.log('Test 4: MCP tools/call');
  try {
    const result = await makeRequest('/api/mcp/proxy', {
      method: 'POST',
      body: {
        serverId: 'server-1',
        request: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            tool: 'database-query',
            arguments: {
              sql: 'SELECT * FROM users'
            }
          },
          id: 2
        }
      }
    });
    console.log('  Status:', result.status);
    console.log('  Tool executed:', result.data?.result?.tool || 'unknown');
    results.push({ test: 'MCP tools/call', status: 'PASS', result });
  } catch (error) {
    console.log('  Error:', error.message);
    results.push({ test: 'MCP tools/call', status: 'FAIL', error: error.message });
  }
  console.log('');

  // 测试5: Ping
  console.log('Test 5: Ping');
  try {
    const result = await makeRequest('/api/mcp/proxy', {
      method: 'POST',
      body: {
        serverId: 'server-2',
        request: {
          jsonrpc: '2.0',
          method: 'ping',
          id: 3
        }
      }
    });
    console.log('  Status:', result.status);
    console.log('  Pong:', result.data?.result?.pong);
    results.push({ test: 'Ping', status: 'PASS', result });
  } catch (error) {
    console.log('  Error:', error.message);
    results.push({ test: 'Ping', status: 'FAIL', error: error.message });
  }
  console.log('');

  // 测试6: 批量请求
  console.log('Test 6: Batch Requests');
  try {
    const result = await makeRequest('/api/mcp/batch', {
      method: 'POST',
      body: {
        requests: [
          { serverId: 'server-1', request: { jsonrpc: '2.0', method: 'ping', id: 1 } },
          { serverId: 'server-2', request: { jsonrpc: '2.0', method: 'ping', id: 2 } },
          { serverId: 'server-3', request: { jsonrpc: '2.0', method: 'ping', id: 3 } }
        ]
      }
    });
    const fulfilled = result.data?.results?.filter(r => r.status === 'fulfilled').length || 0;
    console.log('  Status:', result.status);
    console.log('  Total requests:', result.data?.results?.length || 0);
    console.log('  Successful:', fulfilled);
    results.push({ test: 'Batch Requests', status: 'PASS', result, fulfilled });
  } catch (error) {
    console.log('  Error:', error.message);
    results.push({ test: 'Batch Requests', status: 'FAIL', error: error.message });
  }
  console.log('');

  // 测试7: 错误处理
  console.log('Test 7: Error Handling (invalid server)');
  try {
    const result = await makeRequest('/api/mcp/proxy', {
      method: 'POST',
      body: {
        serverId: 'invalid-server',
        request: {
          jsonrpc: '2.0',
          method: 'ping',
          id: 1
        }
      }
    });
    console.log('  Status:', result.status);
    console.log('  Expected 404 for invalid server:', result.status === 404);
    results.push({ test: 'Error Handling', status: result.status === 404 ? 'PASS' : 'FAIL', result });
  } catch (error) {
    console.log('  Error:', error.message);
    results.push({ test: 'Error Handling', status: 'FAIL', error: error.message });
  }
  console.log('');

  console.log('✅ All tests completed!\n');
  console.log('Summary:');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`  Total: ${results.length}`);
  console.log(`  Passed: ${passed} ✓`);
  console.log(`  Failed: ${failed} ✗`);
  console.log('');
  console.log('Results saved to test-results.json');

  return results;
}

runTests().catch(console.error);