import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';

// 确保 logs 目录存在
const logDir = resolve(__dirname, 'logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    reporters: ['default', 'json'],
    outputFile: {
      json: resolve(logDir, 'test-backend-results.json')
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: resolve(logDir, 'coverage-backend'),
      exclude: ['node_modules/', 'dist/']
    },
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/contract/**/*.test.ts', 'src/**/*.test.ts', 'tests/temp/**/*.test.ts'],
    exclude: ['tests/unit/frontend/**/*']
  }
});
