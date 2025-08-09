import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Docker環境でのアクセスを許可
    port: 3000,
    watch: {
      usePolling: true, // Docker環境でのホットリロード有効化
      interval: 1000
    },
    hmr: {
      port: 3000,
      clientPort: 3001, // Docker外部からのアクセス用ポート
      overlay: false // エラーオーバーレイを無効化
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@styles': path.resolve(__dirname, './src/Styles'),
      '@supabase': path.resolve(__dirname, './src/supabase'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  esbuild: {
    target: 'es2020',
  }
})
