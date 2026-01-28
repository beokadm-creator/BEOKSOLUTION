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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor';
            }
            if (id.includes('firebase')) {
              return 'firebase';
            }
            if (id.includes('xlsx') || id.includes('jspdf') || id.includes('react-qr-code')) {
              return 'utils';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
