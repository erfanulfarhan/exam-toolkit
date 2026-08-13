import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { BUCKET, client, configured, safeKey, splitKey } from './_storage'
import { requireAuth } from './_auth'
import { json } from './_shared'

/**
 * The paper catalog.
 *
 * GET with no query returns just the level → subject structure, found with a
 * delimiter listing so it never enumerates the (tens of thousands of) files —
 * that keeps the library instant to open. GET with ?prefix=IAL/Physics/ returns
 * the files under one subject, fetched only when that subject is opened. POST
 * accepts a new paper. Everything is behind the deployment's protection; the
 * bucket itself stays private.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return

  if (!configured()) {
    return json(res, { configured: false, subjects: [], files: [] })
  }

  if (req.method === 'GET') {
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : ''
    return prefix ? listFiles(res, prefix) : listSubjects(res)
  }
  if (req.method === 'POST') return upload(req, res)

  res.setHeader('Allow', 'GET, POST')
  res.status(405).send('Method Not Allowed')
}

/**
 * The level → subject tree, via delimiter listings. Listing "" then each level
 * with Delimiter "/" returns folder prefixes (IAL/, then IAL/Physics/, …)
 * without ever reading the files inside — a handful of calls regardless of how
 * many papers the bucket holds.
 */
/**
 * Split a top-level folder into board + level. Cambridge folders are named
 * "Cambridge <level>"; everything else is Edexcel, whose folders are the bare
 * level (IAL/IGCSE). Keeps the storage layout untouched while presenting a
 * board → level tree.
 */
function boardLevel(top: string): { board: string; level: string } {
  const m = /^cambridge\s+(.+)$/i.exec(top)
  if (m) {
    const lvl = m[1].trim()
    return { board: 'Cambridge', level: /^ial$/i.test(lvl) ? 'A-Level' : lvl }
  }
  return { board: 'Edexcel', level: top }
}

async function listSubjects(res: VercelResponse) {
  const s3 = client()
  const top = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Delimiter: '/' }))
  const folders = (top.CommonPrefixes || []).map((p) => p.Prefix).filter(Boolean) as string[]

  const subjects: { board: string; level: string; subject: string; prefix: string }[] = []
  for (const folder of folders) {
    let token: string | undefined
    do {
      const page = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET, Delimiter: '/', Prefix: folder, ContinuationToken: token,
      }))
      for (const cp of page.CommonPrefixes || []) {
        if (!cp.Prefix) continue
        const parts = cp.Prefix.split('/').filter(Boolean)
        const { board, level } = boardLevel(parts[0])
        subjects.push({ board, level, subject: parts[1] ?? parts[0], prefix: cp.Prefix })
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined
    } while (token)
  }

  return json(res, { configured: true, subjects })
}

/** The .pdf files under one subject prefix (e.g. IAL/Physics/). */
async function listFiles(res: VercelResponse, prefix: string) {
  if (prefix.includes('..')) {
    res.status(400).send('Bad prefix.')
    return
  }
  const s3 = client()
  const files: { key: string; name: string; subject: string; level: string }[] = []
  let token: string | undefined
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, Prefix: prefix, ContinuationToken: token,
    }))
    for (const object of page.Contents || []) {
      if (!object.Key || !/\.pdf$/i.test(object.Key)) continue
      files.push({ key: object.Key, ...splitKey(object.Key) })
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)

  return json(res, { configured: true, files })
}

async function upload(req: VercelRequest, res: VercelResponse) {
  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body as Record<string, unknown>)
  const key = safeKey(body?.key)
  const data = body?.data

  if (!key || typeof data !== 'string') {
    res.status(400).send('Expected a .pdf key and base64 data.')
    return
  }

  const bytes = Buffer.from(data, 'base64')
  if (!bytes.length) {
    res.status(400).send('Empty upload.')
    return
  }

  await client().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: bytes,
    ContentType: 'application/pdf',
  }))

  return json(res, { ok: true, key, size: bytes.length })
}

function safeParse(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { return {} }
}
