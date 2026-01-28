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
    chunkSizeWarningLimit: 1600, // 경고 기준을 1600kB로 상향 (선택 사항)
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 1. React 관련 라이브러리 분리
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor';
          }
          // 2. Firebase 관련 라이브러리 분리 (덩치가 큼)
          if (id.includes('node_modules/firebase')) {
            return 'firebase-vendor';
          }
          // 3. 무거운 출력 관련 라이브러리 분리 (html2canvas, jspdf 등)
          if (id.includes('node_modules/html2canvas') || id.includes('node_modules/jspdf')) {
            return 'print-vendor';
          }
          // 4. 나머지 node_modules는 vendor로 묶음
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  }
})
