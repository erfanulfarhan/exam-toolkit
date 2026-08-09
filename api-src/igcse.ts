import type { VercelRequest, VercelResponse } from '@vercel/node'
import { igcseView, IgcseRequest } from '../server/lib/igcse-view'
import { json, postOnly, readBody } from './_shared'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!postOnly(req, res)) return
  json(res, igcseView(readBody(req) as IgcseRequest))
}
