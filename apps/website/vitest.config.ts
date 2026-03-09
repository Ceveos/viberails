import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'website',
    coverage: {
      provider: 'v8',
      include: ['scripts/serialize-schema.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
