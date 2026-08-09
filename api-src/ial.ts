import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ialView, IalRequest } from '../server/lib/ial-view'
import { json, postOnly, readBody } from './_shared'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!postOnly(req, res)) return
  json(res, ialView(readBody(req) as IalRequest))
}
