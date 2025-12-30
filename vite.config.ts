import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

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
  const configPath = process.env.MCP_HUB_CONFIG_PATH ||
                    path.join(process.cwd(), 'config', '.mcp-hub.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.port && typeof config.port === 'number') {
        return String(config.port);
      }
    } catch (e) {
      // 忽略读取错误，使用默认值
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

  const configPath = process.env.MCP_HUB_CONFIG_PATH ||
                    path.join(process.cwd(), 'config', '.mcp-hub.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.host && typeof config.host === 'string') {
        return config.host;
      }
    } catch (e) {
      // 忽略读取错误
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
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true
      },
      '/mcp': {
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
