import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/plugins/**/*.test.ts', 'tests/modules/**/*.test.ts'],
  },
});
