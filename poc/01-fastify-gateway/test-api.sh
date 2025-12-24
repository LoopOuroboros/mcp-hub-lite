#!/bin/bash
# MCP Gateway API 测试脚本

BASE_URL="http://localhost:3000"
echo "🧪 Testing MCP Gateway POC APIs..."
echo ""

# 测试1: 健康检查
echo "Test 1: Health Check"
curl -s "${BASE_URL}/health" | python3 -m json.tool
echo -e "\n---\n"

# 测试2: 服务器列表
echo "Test 2: Server List"
curl -s "${BASE_URL}/api/servers" | python3 -m json.tool
echo -e "\n---\n"

# 测试3: 单个MCP请求 (tools/list)
echo "Test 3: MCP tools/list request to server-1"
curl -s -X POST "${BASE_URL}/api/mcp/proxy" \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "server-1",
    "request": {
      "jsonrpc": "2.0",
      "method": "tools/list",
      "id": 1
    }
  }' | python3 -m json.tool
echo -e "\n---\n"

# 测试4: 工具调用 (tools/call)
echo "Test 4: MCP tools/call request"
curl -s -X POST "${BASE_URL}/api/mcp/proxy" \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "server-1",
    "request": {
      "jsonrpc": "2.0",
      "method": "tools/call",
      "params": {
        "tool": "database-query",
        "arguments": {
          "sql": "SELECT * FROM users"
        }
      },
      "id": 2
    }
  }' | python3 -m json.tool
echo -e "\n---\n"

# 测试5: Ping请求
echo "Test 5: MCP ping request"
curl -s -X POST "${BASE_URL}/api/mcp/proxy" \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "server-2",
    "request": {
      "jsonrpc": "2.0",
      "method": "ping",
      "id": 3
    }
  }' | python3 -m json.tool
echo -e "\n---\n"

# 测试6: 批量请求
echo "Test 6: Batch MCP requests"
curl -s -X POST "${BASE_URL}/api/mcp/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "serverId": "server-1",
        "request": {
          "jsonrpc": "2.0",
          "method": "ping",
          "id": 1
        }
      },
      {
        "serverId": "server-2",
        "request": {
          "jsonrpc": "2.0",
          "method": "ping",
          "id": 2
        }
      },
      {
        "serverId": "server-3",
        "request": {
          "jsonrpc": "2.0",
          "method": "ping",
          "id": 3
        }
      }
    ]
  }' | python3 -m json.tool
echo -e "\n---\n"

# 测试7: 错误处理 (无效服务器)
echo "Test 7: Error handling (invalid server)"
curl -s -X POST "${BASE_URL}/api/mcp/proxy" \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "invalid-server",
    "request": {
      "jsonrpc": "2.0",
      "method": "ping",
      "id": 1
    }
  }' | python3 -m json.tool
echo -e "\n---\n"

echo "✅ All tests completed!"