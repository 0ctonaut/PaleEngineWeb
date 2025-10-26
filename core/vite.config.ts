import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PaleEngineCore',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['three', 'three/webgpu'],
      output: {
        globals: {
          three: 'THREE',
          'three/webgpu': 'THREE'
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: false
  }
})
