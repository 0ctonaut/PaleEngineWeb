import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/PaleEngineWeb/' : '/',
  server: {
    port: 4444,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false
  },
  resolve: {
    dedupe: [],
    alias: {}
  },
  optimizeDeps: {
    include: [],
    force: true
  }
})
