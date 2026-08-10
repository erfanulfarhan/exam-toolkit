/**
 * Shapes the API returns.
 *
 * Written out by hand rather than imported from `server/`, so there is no path
 * by which server code can be pulled into the browser bundle by accident.
 */

export type IalUnitView = {
  code: string
  title: string
  type: 'AS' | 'A2'
  cap: number
  rawMax: number
  umsMax: number
  session: string
  variant: string
  sessions: string[]
  variants: { key: string; label: string }[]
  ums: number | null
  raw: number | null
  grade: string | null
  taking: boolean
  effort: number
  note: string | null
}

export type PlanStep = {
  key: string
  code: string
  title: string
  type: 'AS' | 'A2'
  retake: boolean
  fromUms: number
  toUms: number
  gain: number
  rawNeeded: number
  rawMax: number
  pct: number
  effort: number
}

export type Plan = {
  status: 'secured' | 'planned' | 'impossible' | 'idle'
  target: string
  needOverall: number
  currentTotal: number
  projectedTotal: number
  steps: PlanStep[]
  shortfall: number
  retakeCount: number
  landsOn: string
}

export type IalView = {
  subjects: string[]
  sessions: string[]
  subject: string
  level: 'A Level' | 'AS'
  session: string
  units: IalUnitView[]
  hasOptional: boolean
  totalUms: number
  maxUms: number
  overall: string
  anyMarks: boolean
  ladder: { grade: string; need: number; extra: string | null; reached: boolean }[]
  rule: { label: string; need: number; have: number; note: string } | null
  target: string
  plan: Plan | null
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

export type ForecastView = {
  target: string
  max: number
  units: { code: string; label: string }[]
  code: string
  series: {
    grade: string
    label: string
    history: { session: string; value: number }[]
    point: number
  }[]
}

export const EFFORT_LABELS: Record<number, string> = {
  1: 'Easy for me',
  2: 'Fairly easy',
  3: 'Average',
  4: 'Hard',
  5: 'Brutal',
}

export const GRADE_COLORS: Record<string, string> = {
  // A spectrum rather than a single hue, ordered so the warm end is the one you
  // do not want. Grade text always sits beside its own colour, never alone.
  'A*': 'text-violet-300', '9': 'text-violet-300',
  A: 'text-emerald-400', '8': 'text-emerald-400',
  B: 'text-teal-300', '7': 'text-teal-300',
  C: 'text-sky-400', '6': 'text-sky-400',
  '5': 'text-blue-400',
  D: 'text-amber-300', '4': 'text-amber-300',
  E: 'text-orange-400', '3': 'text-orange-400',
  '2': 'text-rose-400',
  '1': 'text-rose-500',
  U: 'text-rose-500',
}
