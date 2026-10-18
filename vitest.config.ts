import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['skill/lambda/tests/**/*.test.ts', 'vps/tests/**/*.test.ts'],
  },
});
