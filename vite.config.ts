import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

// Dynamically get backend port: prioritize environment variables, then look for config files
function getBackendPort(): string {
  // 1. Prioritize environment variables
  if (process.env.VITE_BACKEND_PORT) {
    return process.env.VITE_BACKEND_PORT;
  }
  if (process.env.PORT) {
    return process.env.PORT;
  }

  // 2. Try to read from config files
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
        // Compatibility with old config format
        if (config.port && typeof config.port === 'number') {
          return String(config.port);
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // 3. Default value
  return '7788';
}

// Dynamically get backend host
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
        // Compatibility with old config format
        if (config.host && typeof config.host === 'string') {
          return config.host;
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return 'localhost';
}

const backendPort = getBackendPort();
const backendHost = getBackendHost();

console.log('[Vite Config] Backend target:', `http://${backendHost}:${backendPort}`);

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia', 'vue-i18n'],
      dts: '../frontend/src/auto-imports.d.ts',
      eslintrc: {
        enabled: true,
        filepath: '../.eslintrc-auto-import.json'
      }
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: '../frontend/src/components.d.ts',
      dirs: ['src/components']
    })
  ],
  root: 'frontend',
  resolve: {
    alias: {
      // Frontend source code aliases
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),
      '@components': fileURLToPath(new URL('./frontend/src/components', import.meta.url)),
      '@views': fileURLToPath(new URL('./frontend/src/views', import.meta.url)),
      '@stores': fileURLToPath(new URL('./frontend/src/stores', import.meta.url)),
      '@router': fileURLToPath(new URL('./frontend/src/router', import.meta.url)),
      '@i18n': fileURLToPath(new URL('./frontend/src/i18n', import.meta.url)),
      '@locales': fileURLToPath(new URL('./frontend/src/locales', import.meta.url)),
      '@composables': fileURLToPath(new URL('./frontend/src/composables', import.meta.url)),
      '@utils': fileURLToPath(new URL('./frontend/src/utils', import.meta.url)),

      // Shared code aliases
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@shared-models': fileURLToPath(new URL('./shared/models', import.meta.url)),
      '@shared-types': fileURLToPath(new URL('./shared/types', import.meta.url))
    }
  },
  server: {
    host: '127.0.0.1', // Explicitly use IPv4 address
    port: 5173, // Use common port number to avoid permission issues
    strictPort: true, // Allow automatic selection of available port
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
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vue 生态核心库
          if (
            id.includes('node_modules/vue') ||
            id.includes('node_modules/vue-router') ||
            id.includes('node_modules/pinia') ||
            id.includes('node_modules/vue-i18n')
          ) {
            return 'vue-vendor';
          }
          return undefined;
        }
      }
    }
  }
});
