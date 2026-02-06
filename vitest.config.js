import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.js', 'test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/test-setup.js'],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
