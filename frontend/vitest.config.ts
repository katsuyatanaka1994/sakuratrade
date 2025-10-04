import { defineConfig } from 'vitest/config';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const r = (p: string) => path.resolve(__dirname, p);
const resolveFromConfig = (relativePath: string) =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const isVitest = Boolean(process.env.VITEST);
const isCI = ['1', 'true'].includes(String(process.env.CI).toLowerCase());

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      resolveFromConfig('./vitest.setup.ts'),
      resolveFromConfig('./src/setupTests.ts'),
    ],
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
      'tests/e2e/**',
      '**/tests/e2e/**',
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
    onConsoleLog(log, type) {
      if (isCI && type === 'warn') {
        throw new Error(`Unexpected console.${type} during tests:\n${log}`);
      }
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
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '@styles': fileURLToPath(new URL('./src/Styles', import.meta.url)),
      '@supabase': fileURLToPath(new URL('./src/supabase', import.meta.url)),
      '@utils': fileURLToPath(new URL('./src/utils', import.meta.url)),
      ...(isVitest
        ? {
            'lucide-react': fileURLToPath(new URL('./src/test-utils/stubs/lucide-react.tsx', import.meta.url)),
          }
        : {}),
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
