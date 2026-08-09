/**
 * Bundles each serverless handler into a single self-contained file.
 *
 * Vercel's Node runtime only transpiles `api/*.ts`; it leaves relative imports
 * extensionless, which Node's ESM loader rejects in a `"type": "module"`
 * package. Bundling first means each function has no relative imports at all,
 * and the boundary JSON is inlined rather than shipped as a separate asset.
 */
import { build } from 'esbuild'
import { mkdirSync, rmSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'api')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const handlers = ['ial', 'igcse', 'forecast']

await Promise.all(handlers.map((name) =>
  build({
    entryPoints: [path.join(root, 'api-src', `${name}.ts`)],
    outfile: path.join(out, `${name}.js`),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    minify: true,
    legalComments: 'none',
    logLevel: 'error',
  })))

console.log(`bundled ${handlers.length} api functions`)
