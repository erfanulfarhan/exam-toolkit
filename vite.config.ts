import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import path from 'path'

const NOTICE = `/*! Edexcel Grade Calculator. Copyright ${new Date().getFullYear()}. All rights reserved.
 * Unofficial tool. Grade boundary data is Pearson's, republished from their public documents. */`

export default defineConfig({
  plugins: [
    react(),
    // Older phones (iOS Safari in particular) are missing a string of modern
    // built-ins that pdf.js and the app rely on, which made opening a paper fail
    // on mobile while working on desktop. Rather than polyfill them one at a
    // time as each surfaces, this ships the whole set: `modernPolyfills` patches
    // browsers new enough for ES modules but missing recent APIs, and the legacy
    // bundle covers the genuinely old ones.
    legacy({
      targets: ['defaults', 'ios_saf >= 12', 'safari >= 12'],
      modernPolyfills: true,
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    // No source maps in production: shipping them hands over the readable source.
    sourcemap: false,
    rollupOptions: { output: { banner: NOTICE } },
  },
})
