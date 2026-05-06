[根目录](../../../CLAUDE.md) > [src](../../) > [services](../) > **mcp-oauth**

# MCP OAuth 子模块

## 模块职责

MCP OAuth 子模块实现 OAuth 2.0 授权码流程（PKCE），用于 Streamable HTTP MCP 服务器的浏览器弹窗认证。

## 目录结构

```
mcp-oauth/
├── index.ts                # 统一导出
├── oauth-types.ts          # OAuth 类型定义
├── oauth-provider.ts       # OAuthClientProvider 实现
├── oauth-callback-server.ts # 本地 HTTP 回调服务器
└── oauth-token-storage.ts  # Token JSON 文件持久化
```

## 核心组件

### McpOAuthClientProvider (`oauth-provider.ts`)

实现 SDK 的 `OAuthClientProvider` 接口，管理完整的 OAuth 授权流程：

- Token 和 client info 的持久化存储
- 系统浏览器打开授权 URL
- PKCE code verifier 管理
- 凭证失效处理

### OAuthCallbackServer (`oauth-callback-server.ts`)

本地 HTTP 服务器，监听 127.0.0.1 随机端口：

- 接收 OAuth 回调中的 authorization code
- 返回成功 HTML 页面给浏览器
- 5 分钟超时自动关闭

### OAuthTokenStorage (`oauth-token-storage.ts`)

JSON 文件持久化：

- 存储路径: `~/.mcp-hub-lite/oauth/{server_hash}_oauth.json`
- 原子写入（tmp + rename）
- 内存缓存 + 文件同步

## 集成方式

1. TransportFactory 检测 `server.oauth.enabled`，创建 McpOAuthClientProvider
2. StreamableHttpTransport 将 authProvider 传递给 SDK 的 StreamableHTTPClientTransport
3. McpConnectionManager 捕获 UnauthorizedError，触发 OAuth 流程（启动回调服务器 → 等待授权码 → finishAuth → 重试连接）

## 验证方法

配置 Streamable HTTP 服务器时设置 `oauth: { enabled: true }`，连接时自动触发 OAuth 浏览器认证流程。
