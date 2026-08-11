import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildRoutine, RoutineRequest } from '../server/lib/routine'
import { json, postOnly, readBody } from './_shared'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (!postOnly(req, res)) return
  json(res, buildRoutine(readBody(req) as RoutineRequest))
}
