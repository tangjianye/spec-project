/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/features/profile/components/**/*.{ts,tsx}', 'src/features/profile/hooks/**/*.{ts,tsx}', 'src/features/profile/schemas/**/*.{ts,tsx}'],
      exclude: ['**/*.stories.tsx'],
      thresholds: { lines: 60, functions: 60, statements: 60, branches: 60 }
    }
  }
});
