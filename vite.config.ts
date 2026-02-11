import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// 动态获取后端端口：优先使用环境变量，其次查找配置文件
function getBackendPort(): string {
  // 1. 优先使用环境变量
  if (process.env.VITE_BACKEND_PORT) {
    return process.env.VITE_BACKEND_PORT;
  }
  if (process.env.PORT) {
    return process.env.PORT;
  }

  // 2. 尝试从配置文件读取
  const configPaths = [
    process.env.MCP_HUB_CONFIG_PATH,
    path.join(process.cwd(), 'config', '.mcp-hub.json'),
    path.join(os.homedir(), '.mcp-hub-lite', 'config', '.mcp-hub.json')
  ].filter(Boolean) as string[];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.system?.port && typeof config.system.port === 'number') {
          return String(config.system.port);
        }
        // 兼容旧配置格式
        if (config.port && typeof config.port === 'number') {
          return String(config.port);
        }
      } catch {
        // 忽略读取错误
      }
    }
  }

  // 3. 默认值
  return '7788';
}

// 动态获取后端主机
function getBackendHost(): string {
  if (process.env.VITE_BACKEND_HOST) {
    return process.env.VITE_BACKEND_HOST;
  }
  if (process.env.HOST) {
    return process.env.HOST;
  }

  const configPaths = [
    process.env.MCP_HUB_CONFIG_PATH,
    path.join(process.cwd(), 'config', '.mcp-hub.json'),
    path.join(os.homedir(), '.mcp-hub-lite', 'config', '.mcp-hub.json')
  ].filter(Boolean) as string[];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.system?.host && typeof config.system.host === 'string') {
          return config.system.host;
        }
        // 兼容旧配置格式
        if (config.host && typeof config.host === 'string') {
          return config.host;
        }
      } catch {
        // 忽略读取错误
      }
    }
  }

  return 'localhost';
}

const backendPort = getBackendPort();
const backendHost = getBackendHost();

console.log('[Vite Config] Backend target:', `http://${backendHost}:${backendPort}`);

export default defineConfig({
  plugins: [vue()],
  root: 'frontend',
  resolve: {
    alias: {
      // 基础别名
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),

      // 前端模块专用别名
      '@components': fileURLToPath(new URL('./frontend/src/components', import.meta.url)),
      '@views': fileURLToPath(new URL('./frontend/src/views', import.meta.url)),
      '@stores': fileURLToPath(new URL('./frontend/src/stores', import.meta.url)),
      '@router': fileURLToPath(new URL('./frontend/src/router', import.meta.url)),
      '@i18n': fileURLToPath(new URL('./frontend/src/i18n', import.meta.url)),
      '@locales': fileURLToPath(new URL('./frontend/src/locales', import.meta.url)),
      '@composables': fileURLToPath(new URL('./frontend/src/composables', import.meta.url)),
      '@utils': fileURLToPath(new URL('./frontend/src/utils', import.meta.url)),

      // 共享类型别名
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@shared-models': fileURLToPath(new URL('./shared/models', import.meta.url)),
      '@shared-types': fileURLToPath(new URL('./shared/types', import.meta.url))
    }
  },
  server: {
    host: '127.0.0.1', // 明确使用 IPv4 地址
    port: 5173, // 使用常用的端口号避免权限问题
    strictPort: true, // 允许自动选择可用端口
    proxy: {
      '/api': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true
      },
      '/web': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true
      },
      '/mcp': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
        ws: true
      },
      '/ws': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true
  }
});
