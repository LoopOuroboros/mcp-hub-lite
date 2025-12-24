/**
 * POC 客户端测试
 * 验证 Gateway 功能
 */
import { MCPGateway } from './MCPGateway.js';

// HTTP 客户端
async function testGateway() {
  console.log('🧪 Testing MCP Gateway POC...\n');

  const gateway = new MCPGateway();
  await gateway.start(3001);

  const baseUrl = 'http://localhost:3001';

  // 测试 1: 健康检查
  console.log('Test 1: Health Check');
  try {
    const response = await fetch(`${baseUrl}/health`);
    const data = await response.json();
    console.log('  ✓ Health check passed:', data);
  } catch (error) {
    console.log('  ✗ Health check failed:', error);
  }

  // 测试 2: 获取服务器列表
  console.log('\nTest 2: Server List');
  try {
    const response = await fetch(`${baseUrl}/api/servers`);
    const data = await response.json();
    console.log('  ✓ Server list retrieved:', data.servers.length, 'servers');
  } catch (error) {
    console.log('  ✗ Server list failed:', error);
  }

  // 测试 3: 单个 MCP 请求
  console.log('\nTest 3: Single MCP Request (tools/list)');
  try {
    const response = await fetch(`${baseUrl}/api/mcp/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId: 'server-1',
        request: {
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1
        }
      })
    });
    const data = await response.json();
    console.log('  ✓ MCP tools/list successful');
    console.log('  Tools found:', data.result?.tools?.length || 0);
  } catch (error) {
    console.log('  ✗ MCP request failed:', error);
  }

  // 测试 4: 批量 MCP 请求
  console.log('\nTest 4: Batch MCP Requests');
  try {
    const response = await fetch(`${baseUrl}/api/mcp/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            serverId: 'server-1',
            request: { jsonrpc: '2.0', method: 'ping', id: 1 }
          },
          {
            serverId: 'server-2',
            request: { jsonrpc: '2.0', method: 'ping', id: 2 }
          },
          {
            serverId: 'server-3',
            request: { jsonrpc: '2.0', method: 'ping', id: 3 }
          }
        ]
      })
    });
    const data = await response.json();
    console.log('  ✓ Batch requests successful');
    console.log('  Results:', data.results.length, 'requests');
    console.log('  Successful:', data.results.filter((r: any) => r.status === 'fulfilled').length);
    console.log('  Failed:', data.results.filter((r: any) => r.status === 'rejected').length);
  } catch (error) {
    console.log('  ✗ Batch requests failed:', error);
  }

  // 测试 5: 错误处理
  console.log('\nTest 5: Error Handling (invalid server)');
  try {
    const response = await fetch(`${baseUrl}/api/mcp/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId: 'invalid-server',
        request: {
          jsonrpc: '2.0',
          method: 'ping',
          id: 1
        }
      })
    });
    const data = await response.json();
    if (response.status === 404) {
      console.log('  ✓ Error handling correct (404 for unknown server)');
      console.log('  Error message:', data.error?.message);
    } else {
      console.log('  ✗ Unexpected response code:', response.status);
    }
  } catch (error) {
    console.log('  ✗ Error test failed:', error);
  }

  console.log('\n✅ All tests completed!');
  await gateway.stop();
}

testGateway().catch(console.error);