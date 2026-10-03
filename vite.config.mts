import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the window (renderer/) into dist/. main.js loads dist/index.html
// from disk, so asset paths must be relative ('./').
export default defineConfig({
  root: 'renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
