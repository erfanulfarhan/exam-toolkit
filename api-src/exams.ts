import type { VercelRequest, VercelResponse } from '@vercel/node'
import { examsView, ExamsRequest } from '../server/lib/exams'
import { json, postOnly, readBody } from './_shared'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!postOnly(req, res)) return
  json(res, examsView(readBody(req) as ExamsRequest))
}
