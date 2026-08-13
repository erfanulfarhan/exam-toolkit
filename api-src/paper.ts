import type { VercelRequest, VercelResponse } from '@vercel/node'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { BUCKET, client, configured, safeKey } from './_storage'
import { libraryOpen, requireAuth } from './_auth'

/**
 * Serve one paper.
 *
 * The object is streamed through the function rather than handed over as a
 * presigned URL. That keeps the bucket entirely private, avoids configuring a
 * CORS policy on it, and costs nothing extra because papers are a few hundred
 * kilobytes each.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireAuth(req, res)) return

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).send('Method Not Allowed')
    return
  }

  if (!configured()) {
    res.status(503).send('Storage is not configured.')
    return
  }

  const key = safeKey(req.query.key)
  if (!key) {
    res.status(400).send('Expected a .pdf key.')
    return
  }

  try {
    const object = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const body = object.Body as NodeJS.ReadableStream | undefined
    if (!body) {
      res.status(404).send('Not found.')
      return
    }

    res.setHeader('Content-Type', 'application/pdf')
    // Papers never change once uploaded. When the library is open the file is
    // public anyway, so let Vercel's edge cache it (s-maxage): the first request
    // warms the edge and every later one skips both this function and R2, which
    // is the difference between a cold fetch and an instant one. When a password
    // is set the response is per-user, so it stays private to the browser only.
    res.setHeader('Cache-Control', libraryOpen()
      ? 'public, max-age=31536000, s-maxage=31536000, immutable'
      : 'private, max-age=31536000, immutable')
    if (object.ContentLength) res.setHeader('Content-Length', String(object.ContentLength))

    body.pipe(res)
  } catch (err) {
    const name = (err as { name?: string })?.name
    if (name === 'NoSuchKey' || name === 'NotFound') {
      res.status(404).send('Not found.')
      return
    }
    res.status(502).send('Could not read that paper.')
  }
}
