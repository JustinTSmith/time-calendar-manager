import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
<<<<<<< HEAD
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
      },
    },
  },
=======
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80 }
    }
  }
>>>>>>> origin/blocks/jus-29-test-scaffolding-vitest-unit-tests-and-playwright-e2e-smoke
})
