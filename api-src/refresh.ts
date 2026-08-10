import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkForNewSessions, heldSessions } from '../server/lib/watch'

/**
 * Results day watcher, run by Vercel Cron.
 *
 * Checks whether Pearson has published a session the site does not hold yet.
 * If it has, and a deploy hook is configured, it triggers a rebuild: the build
 * runs `tools/refresh.py`, which downloads and parses the new PDF and bundles
 * the fresh boundaries into the functions. The site updates with no one
 * touching it.
 *
 * Requires two project environment variables:
 *   CRON_SECRET       Vercel sends this as a bearer token on cron requests.
 *   DEPLOY_HOOK_URL   Vercel deploy hook to POST when something new appears.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.authorization
  const manual = typeof req.query.key === 'string' && req.query.key === secret
  if (secret && auth !== `Bearer ${secret}` && !manual) {
    res.status(401).send('Unauthorized')
    return
  }

  const held = heldSessions()
  let found: Awaited<ReturnType<typeof checkForNewSessions>> = []
  let error: string | null = null
  try {
    found = await checkForNewSessions()
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  let triggered = false
  const hook = process.env.DEPLOY_HOOK_URL
  if (found.length && hook) {
    try {
      const r = await fetch(hook, { method: 'POST' })
      triggered = r.ok
    } catch {
      triggered = false
    }
  }

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(200).send(JSON.stringify({
    checkedAt: new Date().toISOString(),
    held,
    published: found,
    rebuildTriggered: triggered,
    deployHookConfigured: !!hook,
    error,
  }))
}
