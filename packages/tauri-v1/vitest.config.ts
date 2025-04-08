import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts{,x}'],
    environment: 'jsdom',
    coverage: {
      enabled: true,
      include: ['src/**/*'],
      exclude: ['src/types.ts'],
      thresholds: {
        lines: 15,
        functions: 15,
        branches: 15,
        statements: 15,
      },
    },
  },
});
