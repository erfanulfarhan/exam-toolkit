/**
 * Bundles each serverless handler into a single self-contained file.
 *
 * Vercel's Node runtime only transpiles `api/*.ts`; it leaves relative imports
 * extensionless, which Node's ESM loader rejects in a `"type": "module"`
 * package. Bundling first means each function has no relative imports at all,
 * and the boundary JSON is inlined rather than shipped as a separate asset.
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync, rmSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * esbuild inlines JSON as an object literal, which V8 parses far more slowly
 * than the equivalent `JSON.parse` of a string. On a 684 KB dataset that is the
 * difference between a sluggish cold start and a quick one.
 */
const fastJson = {
  name: 'json-as-parse',
  setup(b) {
    b.onLoad({ filter: /\.json$/ }, (args) => {
      const raw = JSON.stringify(readFileSync(args.path, 'utf8'))
      return { contents: `export default JSON.parse(${raw})`, loader: 'js' }
    })
  },
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'api')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const handlers = ['ial', 'igcse', 'forecast', 'refresh', 'routine', 'exams', 'papers', 'paper', 'unlock']

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
    // The S3 client is a bare package import, which Vercel resolves from
    // node_modules on its own. Inlining it would add a megabyte to every
    // function that touches storage for no benefit.
    external: ['@aws-sdk/*'],
    plugins: [fastJson],
  })))

console.log(`bundled ${handlers.length} api functions`)
