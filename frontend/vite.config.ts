import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8001',
      '/uploads': 'http://localhost:8001'
    }
  }
})
