/**
 * Global test setup file for backend tests
 * Ensures test isolation by using temporary config directories
 */

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Global temporary directory for test config
let tempTestConfigDir: string;
let tempTestConfigPath: string;

/**
 * Set up test environment before all tests
 */
beforeAll(() => {
  // Create a unique temp directory for this test run (matching user's required format)
  const timestamp = Date.now();
  tempTestConfigDir = path.join(os.tmpdir(), `mcp-hub-lite-test-${timestamp}`);

  // Ensure temp directory exists
  fs.mkdirSync(tempTestConfigDir, { recursive: true });

  // Set the temp config path
  tempTestConfigPath = path.join(tempTestConfigDir, '.mcp-hub.json');

  // Force all tests to use this temp config path
  // This prevents tests from modifying user's actual config file
  process.env.MCP_HUB_CONFIG_PATH = tempTestConfigPath;

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.VITEST = 'true';

  // Clear other env vars that might affect config
  delete process.env.PORT;
  delete process.env.HOST;
  delete process.env.LOG_LEVEL;
  delete process.env.LOG_ROTATION_ENABLED;
  delete process.env.LOG_MAX_AGE;
  delete process.env.LOG_MAX_SIZE;
  delete process.env.LOG_COMPRESS;
});

/**
 * Clean up after all tests
 */
afterAll(() => {
  // Clean up temp directory
  if (tempTestConfigDir && fs.existsSync(tempTestConfigDir)) {
    try {
      fs.rmSync(tempTestConfigDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up test temp directory: ${error}`);
    }
  }
});

// Export for reference in tests if needed
export const getTestConfigPath = () => tempTestConfigPath;
export const getTestConfigDir = () => tempTestConfigDir;
