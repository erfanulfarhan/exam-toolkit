import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const NOTICE = `/*! Edexcel Grade Calculator. Copyright ${new Date().getFullYear()}. All rights reserved.
 * Unofficial tool. Grade boundary data is Pearson's, republished from their public documents. */`

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    // No source maps in production: shipping them hands over the readable source.
    sourcemap: false,
    rollupOptions: { output: { banner: NOTICE } },
  },
})
