import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    } as Record<string, unknown>,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@ckeditor')) {
            return 'vendor-ckeditor';
          }

          if (id.includes('antd') || id.includes('@ant-design')) {
            return 'vendor-antd';
          }

          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'vendor-react';
          }

          if (id.includes('@tanstack')) {
            return 'vendor-query';
          }

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['blackscity.app', 'www.blackscity.app'],
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/dist/**', '**/git/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:5678',
        changeOrigin: true,
      },
      '/webhook-test': {
        target: 'http://localhost:5678',
        changeOrigin: true,
      },
    },
  },
})
