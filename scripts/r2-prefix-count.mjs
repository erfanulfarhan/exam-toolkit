/**
 * Print how many objects live under a bucket prefix (capped — we only need to
 * know "any"). Used by the download pipeline to skip a subject already uploaded.
 *
 *   node scripts/r2-prefix-count.mjs "Cambridge IGCSE/Accounting/"
 */
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
import os from 'os'
import path from 'path'

function secrets() {
  const found = {}
  for (const line of readFileSync(path.join(os.homedir(), '.erfanul-secrets.env'), 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m) found[m[1]] = m[2]
  }
  return found
}

const env = secrets()
const s3 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

const prefix = process.argv[2] || ''
let token
let n = 0
do {
  const r = await s3.send(new ListObjectsV2Command({
    Bucket: env.R2_BUCKET, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000,
  }))
  n += (r.Contents || []).length
  token = r.IsTruncated ? r.NextContinuationToken : undefined
} while (token && n < 5)

process.stdout.write(String(n))
