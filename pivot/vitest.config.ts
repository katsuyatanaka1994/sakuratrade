import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  // React の二重解決を防ぐための保険（将来のモノレポ/リンク対策）
  resolve: {
    alias: {
      // src エイリアス（@/...）を明示
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // React を pivot パッケージ配下の実体に固定（jsx ランタイムも含める）
      react: r('node_modules/react/index.js'),
      'react-dom': r('node_modules/react-dom/index.js'),
      'react/jsx-runtime': r('node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': r('node_modules/react/jsx-dev-runtime.js'),
    },
    dedupe: ['react', 'react-dom'],
  },

  server: {
    deps: {
      inline: [
        '@radix-ui',
        '@floating-ui',
        'react-hook-form',
        'react-remove-scroll',
        'use-sidecar',
      ],
    },
  },

  test: {
    globals: true,
    // React + RTL を動かすために jsdom を使用
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],

    // src 配下の UI テストも探索対象に追加
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
      'tests/**/*.spec.{ts,tsx}',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
    ],

    // e2e/Playwright はユニット実行から除外
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/*.e2e.{ts,tsx}',
      '**/__e2e__/**',
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'dist/**',
        'tests/**',
        '**/*.d.ts',
        'vitest.config.ts',
      ],
    },
  },
});
