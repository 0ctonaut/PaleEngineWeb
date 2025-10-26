import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/PaleEngineWeb/' : '/',
  server: {
    port: 4444,
    open: true
  },
  build: {
    outDir: 'dist'
  },
  resolve: {
    dedupe: ['three', 'three/webgpu'],
    alias: {
      'three/webgpu': 'three/webgpu'
    }
  },
  optimizeDeps: {
    include: ['three/webgpu'],
    force: true
  }
})
