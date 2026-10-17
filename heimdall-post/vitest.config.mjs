import { defineConfig } from 'vitest/config'

// Hjälparens egna tester – inte appens i repots rot.
export default defineConfig({ test: { include: ['test/**/*.test.mjs'], environment: 'node' } })
