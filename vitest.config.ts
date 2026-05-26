import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'crawlbrulee-mcp',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
  },
})
