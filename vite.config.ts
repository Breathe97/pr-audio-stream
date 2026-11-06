// vite.config.js
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'pr-audio-stream',
      fileName: 'index'
    },
    // public 里的资源已全部内联进产物，不再复制，避免 dist 里多一份死重量
    copyPublicDir: false
  }
})
