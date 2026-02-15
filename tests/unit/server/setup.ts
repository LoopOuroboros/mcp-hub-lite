// Test setup for server module tests
import { vi } from 'vitest';

// Global test setup for server tests
export function setupServerTests() {
  // Mock any global dependencies needed for server tests
  vi.mock('fs', () => ({
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
      stat: vi.fn()
    }
  }));

  vi.mock('path', () => ({
    resolve: vi.fn(),
    join: vi.fn(),
    dirname: vi.fn()
  }));
}

// Call setup function
setupServerTests();
