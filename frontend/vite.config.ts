import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  server: {
    port: 3000,
    // 端口被占时直接报错退出，禁止自动递增（曾发生 vite 抢占 3001 与执行引擎双绑，
    // 导致 /execute 请求被 vite 代理到网关 404、执行记录凭空 FAILED 的事故）
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/execute': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/reports': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
