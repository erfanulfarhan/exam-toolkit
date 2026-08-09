import { IGCSE } from './data'
import { igcseGrade, igcseSessionsFor, igcseSubjects } from './engine'

export type IgcseRequest = {
  subject?: string
  session?: string
  variantIndex?: number
  raw?: string
}

export type IgcseView = {
  subjects: string[]
  sessions: string[]
  subject: string
  session: string
  variantIndex: number
  variants: { label: string; papers: string | null }[]
  max: number
  grades: string[]
  boundaries: Record<string, number>
  mark: number | null
  grade: string | null
  papers: string | null
}

function variantLabel(title: string, papers: string | null, i: number) {
  const tier = /\((Foundation|Higher)\)/i.exec(title)?.[1]
  if (tier) return `${tier}, papers ${papers || i + 1}`
  return papers ? `Papers ${papers}` : `Option ${i + 1}`
}

export function igcseView(req: IgcseRequest): IgcseView {
  const subjects = igcseSubjects(IGCSE)
  const subject = subjects.includes(req.subject || '')
    ? req.subject!
    : (subjects.includes('Chemistry') ? 'Chemistry' : subjects[0])

  const sessions = igcseSessionsFor(IGCSE, subject)
  const session = sessions.includes(req.session || '') ? req.session! : sessions[sessions.length - 1]

  const list = IGCSE.sessions[session]?.[subject]?.variants || []
  const index = req.variantIndex != null && list[req.variantIndex] ? req.variantIndex : 0
  const variant = list[index]

  const text = req.raw ?? ''
  const entered = text !== '' && !isNaN(Number(text)) && !!variant
  const mark = entered && variant ? Math.max(0, Math.min(variant.max, Number(text))) : null

  return {
    subjects,
    sessions,
    subject,
    session,
    variantIndex: index,
    variants: list.map((v, i) => ({ label: variantLabel(v.title, v.papers, i), papers: v.papers })),
    max: variant?.max ?? 0,
    grades: (variant?.grades || []).filter((g) => g !== 'U'),
    boundaries: variant?.boundaries || {},
    mark,
    grade: variant && mark != null ? igcseGrade(variant, mark) : null,
    papers: variant?.papers ?? null,
  }
}
