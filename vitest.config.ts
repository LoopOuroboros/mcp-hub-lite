import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/']
    },
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/contract/**/*.test.ts', 'src/**/*.test.ts', 'tests/temp/**/*.test.ts'],
    exclude: ['tests/unit/frontend/**/*']
  }
});
