import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 4444,
    open: true
  },
  build: {
    outDir: 'dist'
  }
})
