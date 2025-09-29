import { defineConfig } from 'vitest/config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const r = (p: string) => path.resolve(__dirname, p);

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/setupTests.ts'],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
      'tests/**/*.spec.{ts,tsx}',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/*.e2e.{ts,tsx}',
      '**/__e2e__/**',
    ],
    deps: {
      optimizer: {
        web: {
          include: [
            'react',
            'react-dom',
            '@radix-ui',
            '@floating-ui',
            'react-hook-form',
            'react-remove-scroll',
            'use-sidecar',
            'react-router',
            'react-router-dom',
          ],
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['dist/**', 'tests/**', '**/*.d.ts', 'vitest.config.ts'],
    },
  },
  server: {
    deps: {
      inline: [
        'react',
        'react-dom',
        '@radix-ui',
        '@floating-ui',
        'react-hook-form',
        'react-remove-scroll',
        'use-sidecar',
        'react-router',
        'react-router-dom',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      react: r('node_modules/react'),
      'react-dom': r('node_modules/react-dom'),
      'react/jsx-runtime': r('node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': r('node_modules/react/jsx-dev-runtime'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
});
