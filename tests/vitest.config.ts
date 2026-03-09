import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    setupFiles: ['tests/integration/setup.ts'],
  },
});
