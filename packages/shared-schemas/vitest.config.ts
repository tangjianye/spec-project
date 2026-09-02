import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/index.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 }
    }
  }
});
