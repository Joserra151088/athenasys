import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return null
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('xlsx') || id.includes('exceljs')) return 'exports'
          if (id.includes('leaflet') || id.includes('react-leaflet')) return 'maps'
          if (id.includes('recharts')) return 'charts'
          if (id.includes('react-router')) return 'router'
          return 'vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    hmr: { clientPort: 5174 },
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
})
