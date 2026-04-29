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
          // ── node_modules ──────────────────────────────────────────────
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
          // 4. Charts — only loaded on statistics page
          if (id.includes('node_modules/recharts/')) {
            return 'chart-vendor';
          }
          // 5. UI primitives
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          // 6. 나머지 node_modules는 vendor로 묶음
          if (id.includes('node_modules')) {
            return 'vendor';
          }

          // ── src (공유 소스) ───────────────────────────────────────────
          // EregiButton/EregiInput/EregiCard 등 10+ 페이지가 공유하는 컴포넌트.
          // manualChunks 미지정 시 Rolldown이 빌드마다 다른 청크에 배정해
          // "Export is not defined in module" 런타임 오류가 발생함.
          if (id.includes('/src/components/eregi/')) {
            return 'eregi-ui';
          }
          // 전역에서 공유되는 hooks / utils / contexts / store
          if (
            id.includes('/src/hooks/') ||
            id.includes('/src/utils/') ||
            id.includes('/src/contexts/') ||
            id.includes('/src/store/')
          ) {
            return 'app-shared';
          }
          // 공통 UI 컴포넌트 (여러 페이지에서 재사용)
          if (id.includes('/src/components/common/') || id.includes('/src/components/ui/')) {
            return 'app-ui';
          }
        },
      },
    },
  }
})
