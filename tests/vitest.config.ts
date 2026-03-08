import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['integration/**/*.test.ts'],
    testTimeout: 30000,
  },
});
