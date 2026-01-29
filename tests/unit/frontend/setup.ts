// Frontend test setup for Vue 3 + Pinia
import { createPinia, setActivePinia } from 'pinia'
import { config } from '@vue/test-utils'

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