// vite.config.js
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts({ rollupTypes: false, insertTypesEntry: true })],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'pr-audio-stream',
      fileName: 'index'
    }
  }
})
