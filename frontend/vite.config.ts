import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 前端构建配置：代理 /api 到后端，路由懒加载在路由文件内配置
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'axios', 'zustand']
        }
      }
    }
  }
});
