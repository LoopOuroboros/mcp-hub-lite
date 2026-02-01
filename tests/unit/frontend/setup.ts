// Frontend test setup for Vue 3 + Pinia
import { createPinia, setActivePinia } from 'pinia'
import { config } from '@vue/test-utils'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

// Set up isolated test environment for config
beforeAll(() => {
  // Create a unique temp directory for frontend tests
  const testRunId = `frontend-test-${process.pid}-${Date.now()}`
  const tempTestConfigDir = path.join(os.tmpdir(), `mcp-hub-${testRunId}`)
  const tempTestConfigPath = path.join(tempTestConfigDir, '.mcp-hub.json')

  // Ensure temp directory exists
  fs.mkdirSync(tempTestConfigDir, { recursive: true })

  // Force frontend tests to use this temp config path
  process.env.MCP_HUB_CONFIG_PATH = tempTestConfigPath

  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.VITEST = 'true'

  // Store for cleanup
  ;(globalThis as any).__frontendTestConfigDir = tempTestConfigDir
})

// Clean up after all frontend tests
afterAll(() => {
  const tempTestConfigDir = (globalThis as any).__frontendTestConfigDir
  if (tempTestConfigDir && fs.existsSync(tempTestConfigDir)) {
    try {
      fs.rmSync(tempTestConfigDir, { recursive: true, force: true })
    } catch (error) {
      console.warn(`Failed to clean up frontend test temp directory: ${error}`)
    }
  }
})

// Configure global mocks for Vue Test Utils
config.global.mocks = {
  $t: (key: string) => key
}

// Set up Pinia for tests
beforeEach(() => {
  const pinia = createPinia()
  setActivePinia(pinia)
})

// Clean up after each test
afterEach(() => {
  // Reset any mocks or global state
})