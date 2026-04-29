import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    chunkSizeWarningLimit: 1600,
    // manualChunks를 사용하지 않음 — Rollup 자동 코드 분할에 위임.
    // manualChunks로 vendor를 수동 분리하면 React가 아직 초기화되기 전에
    // React에 의존하는 라이브러리가 실행되는 청크 초기화 순서 문제가 발생함.
    // (TypeError: Cannot read properties of undefined (reading 'forwardRef') 등)
    // React.lazy로 52+ 페이지가 분리되어 있으므로 Rollup이 알아서 최적 분할함.
  }
})
