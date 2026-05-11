import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/components/**/*.test.tsx',
      'tests/components/**/*.test.ts',
    ],
    exclude: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/services/**/*.ts',
        'src/routes/**/*.ts',
        'src/stores/**/*.ts',
        'src/middleware/**/*.ts',
        'src/utils/**/*.ts',
        'src/components/**/*.tsx',
        'src/components/**/*.ts',
      ],
      exclude: ['src/**/*.test.ts', 'node_modules/**', 'src/utils/pdfParser.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
