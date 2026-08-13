import type { VercelRequest, VercelResponse } from '@vercel/node'
import { grant, passwordMatches, passwordSet } from './_auth'
import { json, postOnly, readBody } from './_shared'

/**
 * Exchange the library password for a cookie.
 *
 * There is no rate limiting here beyond what the platform provides, so the
 * password wants to be a long one. It is the only thing standing between the
 * bucket and the open internet.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!postOnly(req, res)) return

  if (!passwordSet()) {
    res.status(503).send('No library password is configured.')
    return
  }

  const given = String(readBody(req).password || '')
  if (!given || !passwordMatches(given)) {
    res.status(401).send('Wrong password.')
    return
  }

  grant(res)
  return json(res, { ok: true })
}
