/**
 * Transpile the pdf.js worker for older phones.
 *
 * pdf.js 6 ships a "legacy" build that is byte-for-byte as modern as the normal
 * one: class static blocks (Safari 16.4+), private class fields (Safari 14.1+)
 * and optional chaining throughout. The worker is loaded as a standalone asset,
 * so neither Vite's target nor @vitejs/plugin-legacy ever touches it, and on an
 * older iOS Safari the file fails to parse. That surfaced as "that paper could
 * not be opened" on mobile while everything worked on desktop.
 *
 * Lowering it to ES2019 here removes the syntax those browsers choke on. The
 * output goes to public/, so it ships as a plain static file and paper.ts can
 * point GlobalWorkerOptions.workerSrc straight at it.
 */
import { build } from 'esbuild'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)))

const entry = require.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
const outfile = path.join(root, 'public', 'pdf.worker.mjs')

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'esm',
  // ES2019 predates every construct the older Safari builds reject, while
  // staying new enough that esbuild's output remains compact.
  target: ['es2019'],
  legalComments: 'none',
  logLevel: 'error',
})

console.log(`pdf worker transpiled to ES2019 -> ${path.relative(root, outfile)}`)
