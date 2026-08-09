import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * These endpoints exist so the boundary dataset and the grading, planning and
 * forecasting logic stay on the server. The browser sends what the student
 * typed and receives only the answer.
 */
export function json(res: VercelResponse, body: unknown) {
  // Answers depend entirely on the posted body, so nothing is cacheable.
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(200).send(JSON.stringify(body))
}

export function readBody(req: VercelRequest): Record<string, unknown> {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return req.body as Record<string, unknown>
}

export function postOnly(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'POST') return true
  res.setHeader('Allow', 'POST')
  res.status(405).send('Method Not Allowed')
  return false
}
