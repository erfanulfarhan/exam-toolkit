import type { VercelRequest, VercelResponse } from '@vercel/node'
import { forecastView, ForecastRequest } from '../server/lib/forecast-view'
import { json, postOnly, readBody } from './_shared'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!postOnly(req, res)) return
  json(res, forecastView(readBody(req) as ForecastRequest))
}
