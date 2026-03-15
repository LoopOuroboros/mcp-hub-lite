// Frontend-specific Vitest configuration for Vue 3 + Pinia tests
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Ensure logs directory exists
const logDir = resolve(fileURLToPath(new URL('.', import.meta.url)), 'logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // Basic aliases
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url)),

      // Frontend module specific aliases
      '@components': fileURLToPath(new URL('./frontend/src/components', import.meta.url)),
      '@views': fileURLToPath(new URL('./frontend/src/views', import.meta.url)),
      '@stores': fileURLToPath(new URL('./frontend/src/stores', import.meta.url)),
      '@router': fileURLToPath(new URL('./frontend/src/router', import.meta.url)),
      '@i18n': fileURLToPath(new URL('./frontend/src/i18n', import.meta.url)),
      '@locales': fileURLToPath(new URL('./frontend/src/locales', import.meta.url)),
      '@composables': fileURLToPath(new URL('./frontend/src/composables', import.meta.url)),
      '@utils': fileURLToPath(new URL('./frontend/src/utils', import.meta.url)),

      // @frontend/* aliases (for test files)
      '@frontend': fileURLToPath(new URL('./frontend/src', import.meta.url)),

      // Shared type aliases
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@shared-models': fileURLToPath(new URL('./shared/models', import.meta.url)),
      '@shared-types': fileURLToPath(new URL('./shared/types', import.meta.url))
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    reporters: ['default', 'json'],
    outputFile: {
      json: resolve(logDir, 'test-frontend-results.json')
    },
    setupFiles: ['./tests/unit/frontend/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: resolve(logDir, 'coverage-frontend'),
      exclude: ['node_modules/', 'dist/', 'tests/']
    },
    include: ['tests/unit/frontend/**/*.test.ts']
  }
});
