import type { VercelRequest, VercelResponse } from '@vercel/node'
import { forecastView, ForecastRequest } from '../server/lib/forecast-view'

/**
 * A forecast depends only on the qualification, subject and unit, so it is the
 * same answer for every visitor until the next deploy. GET plus a long edge
 * cache means the chart usually comes back without touching a function.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const q = req.query as Record<string, string | string[] | undefined>
  const one = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : q[k]) as string | undefined
  const view = forecastView({
    qual: one('qual') === 'IGCSE' ? 'IGCSE' : 'IAL',
    subject: one('subject'),
    code: one('code'),
    papers: one('papers') ?? null,
  } as ForecastRequest)
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(200).send(JSON.stringify(view))
}
