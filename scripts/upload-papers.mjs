/**
 * Push a folder of papers into the library bucket.
 *
 * Keys mirror the folder structure, so <root>/IAL/Physics/6PH01_01_que_20090113.pdf
 * becomes IAL/Physics/6PH01_01_que_20090113.pdf and the catalog groups on it.
 *
 * Credentials come from ~/.erfanul-secrets.env rather than the environment, so
 * nothing sensitive lands in shell history or in this repo.
 *
 *   node scripts/upload-papers.mjs ~/edexcel-past-papers
 */
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { readFileSync, readdirSync, statSync } from 'fs'
import os from 'os'
import path from 'path'

const CONCURRENCY = 8

function secrets() {
  const file = path.join(os.homedir(), '.erfanul-secrets.env')
  const found = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match) found[match[1]] = match[2]
  }
  return found
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.pdf$/i.test(entry)) out.push(full)
  }
  return out
}

// Keep only question papers and mark schemes. Examiner reports and
// large-print/modified versions aren't used by the practice tool, so they're
// skipped at upload rather than shipped and later deleted.
function readType(base) {
  const compact = base.toLowerCase().replace(/\s+/g, '')
  const toks = base.toLowerCase().split(/[_\s-]+/).filter(Boolean)
  const has = (s) => toks.some((t) => s.has(t))
  const MS = new Set(['ms', 'rms', 'msc', 'mark', 'markscheme'])
  const QP = new Set(['que', 'qp', 'qus', 'qup'])
  const RP = new Set(['rep', 'pef'])
  if (/markscheme|markingscheme/.test(compact) || has(MS)) return 'ms'
  if (/questionpaper|sourcebooklet/.test(compact) || has(QP)) return 'qp'
  if (/examiner/.test(compact) || has(RP)) return 'report'
  return null
}
const isModified = (key) => /modified|braille|large[\s_-]?print|\b\d{2}pt\b/i.test(key)
// Cambridge codes non-paper files as _er_ (examiner report), _gt_ (grade
// thresholds) and _ci_ (confidential instructions) — none used for practice.
const isCambridgeExtra = (base) => /_(er|gt|ci)(_|\d|$)/i.test(base)
function wanted(file) {
  const base = path.basename(file).replace(/\.pdf$/i, '')
  return !isModified(file) && !isCambridgeExtra(base) && readType(base) !== 'report'
}

const root = path.resolve(process.argv[2] || path.join(os.homedir(), 'edexcel-past-papers'))
const env = secrets()

const s3 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})
const Bucket = env.R2_BUCKET

const allPdfs = walk(root)
const files = allPdfs.filter(wanted)
console.log(`${files.length} papers to upload (${allPdfs.length - files.length} reports/large-print skipped) under ${root}`)

let done = 0
let skipped = 0
let failed = 0

async function send(file) {
  const Key = path.relative(root, file).split(path.sep).join('/')
  try {
    // Re-running should be cheap, so anything already up is left alone.
    await s3.send(new HeadObjectCommand({ Bucket, Key }))
    skipped++
    return
  } catch {
    // Not there yet, which is the normal path.
  }

  try {
    await s3.send(new PutObjectCommand({
      Bucket,
      Key,
      Body: readFileSync(file),
      ContentType: 'application/pdf',
    }))
    done++
  } catch (err) {
    failed++
    console.error(`failed ${Key}: ${err.message}`)
  }

  const seen = done + skipped + failed
  if (seen % 50 === 0) console.log(`  ${seen}/${files.length} (${done} up, ${skipped} already there)`)
}

const queue = [...files]
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await send(queue.pop())
  }),
)

console.log(`uploaded ${done}, skipped ${skipped}, failed ${failed}`)
