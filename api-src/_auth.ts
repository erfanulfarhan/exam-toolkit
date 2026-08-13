import crypto from 'crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * A password on the library.
 *
 * Vercel only offers deployment-level protection on paid plans, so the gate
 * lives in the application instead. Without it every paper in the bucket would
 * be readable by anyone who found the URL, which is the difference between a
 * private library and a public archive.
 *
 * The browser holds a derived token in an HttpOnly cookie rather than the
 * password itself, so script on the page cannot read it back out.
 */

const COOKIE = 'library'

export function passwordSet(): boolean {
  return Boolean(process.env.LIBRARY_PASSWORD)
}

function token(): string {
  return crypto
    .createHash('sha256')
    .update('library-v1:' + (process.env.LIBRARY_PASSWORD || ''))
    .digest('hex')
}

function cookieValue(req: VercelRequest, name: string): string {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

/** Equal length first, because timingSafeEqual throws on a mismatch. */
function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function authorized(req: VercelRequest): boolean {
  // Fails closed. A deployment with no password configured serves nothing,
  // rather than quietly opening the whole bucket.
  if (!passwordSet()) return false
  return sameSecret(cookieValue(req, COOKIE), token())
}

/**
 * An explicit escape hatch to serve the library without a password.
 *
 * Set LIBRARY_OPEN=true to drop the gate; unset it (and redeploy) to restore
 * the password. It is deliberately a separate flag from LIBRARY_PASSWORD so
 * that clearing the password locks the library rather than opening it — the
 * bucket only goes public when someone opts in on purpose.
 */
export function libraryOpen(): boolean {
  return process.env.LIBRARY_OPEN === 'true'
}

export function requireAuth(req: VercelRequest, res: VercelResponse): boolean {
  if (libraryOpen()) return true
  if (authorized(req)) return true
  res.status(401).send('Locked')
  return false
}

export function grant(res: VercelResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${token()}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`,
  )
}

/** Compare hashes so the response time does not reveal the password's length. */
export function passwordMatches(given: string): boolean {
  const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex')
  return sameSecret(digest(given), digest(process.env.LIBRARY_PASSWORD || ''))
}
