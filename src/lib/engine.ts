// ---- Types matching public/data/*.json ----
export type IalUnit = {
  code: string; title: string; type: 'AS' | 'A2'
  raw_max: number; raw: Record<string, number>
  ums_max: number; ums: Record<string, number>
}
export type IalCashin = { code: string; title: string; ums_max: number; ums: Record<string, number> }
export type IalSubject = { units: IalUnit[]; cashins: IalCashin[] }
export type IalData = { qualification: 'IAL'; sessions: Record<string, Record<string, IalSubject>> }

export type IgcseVariant = { code: string; title: string; max: number; boundaries: Record<string, number>; papers: string | null }
export type IgcseSubject = { variants: IgcseVariant[] }
export type IgcseData = { qualification: 'IGCSE'; sessions: Record<string, Record<string, IgcseSubject>> }

// ---- Piecewise-linear interpolation (the raw -> UMS core) ----
function interp(anchors: [number, number][], x: number): number {
  const pts = [...anchors].sort((a, b) => a[0] - b[0]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0])
  if (x <= pts[0][0]) return pts[0][1]
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return pts[pts.length - 1][1]
}

const AS_ORDER = ['a', 'b', 'c', 'd', 'e']
const A2_ORDER = ['a*', 'a', 'b', 'c', 'd', 'e']
const CASHIN_ORDER = ['A*', 'A', 'B', 'C', 'D', 'E']
const IGCSE_ORDER = ['9', '8', '7', '6', '5', '4', '3', '2', '1']

export function unitGradeOrder(u: IalUnit) { return u.type === 'A2' ? A2_ORDER : AS_ORDER }

// Anchors: (0,0) + each grade's (raw, ums) + (raw_max, ums_max)
export function rawToUms(u: IalUnit, raw: number): number {
  const anchors: [number, number][] = [[0, 0], [u.raw_max, u.ums_max]]
  for (const g of Object.keys(u.raw)) {
    if (u.ums[g] != null) anchors.push([u.raw[g], u.ums[g]])
  }
  const r = Math.max(0, Math.min(u.raw_max, raw))
  return Math.round(interp(anchors, r))
}

// Smallest raw mark that reaches a target UMS (inverse of rawToUms).
export function umsToRaw(u: IalUnit, targetUms: number): number {
  if (targetUms <= 0) return 0
  for (let r = 0; r <= u.raw_max; r++) if (rawToUms(u, r) >= targetUms) return r
  return u.raw_max
}

export function unitGrade(u: IalUnit, ums: number): string {
  for (const g of unitGradeOrder(u)) {
    if (u.ums[g] != null && ums >= u.ums[g]) return g.toUpperCase()
  }
  return 'U'
}

export function overallGrade(cashin: IalCashin, totalUms: number): string {
  for (const g of CASHIN_ORDER) {
    if (cashin.ums[g] != null && totalUms >= cashin.ums[g]) return g
  }
  return 'U'
}

export function igcseGrade(v: IgcseVariant, raw: number): string {
  for (const g of IGCSE_ORDER) {
    if (v.boundaries[g] != null && raw >= v.boundaries[g]) return g
  }
  return 'U'
}

// ---- Data reshaping helpers ----
export function ialSubjects(d: IalData): string[] {
  const s = new Set<string>()
  for (const sess of Object.values(d.sessions)) Object.keys(sess).forEach((k) => s.add(k))
  return [...s].sort()
}
export function ialSessionsFor(d: IalData, subject: string): string[] {
  return Object.keys(d.sessions).filter((sess) => d.sessions[sess][subject])
}
// unique units for a subject across sessions (dedup by code, prefer non-"A" variant title)
export function ialUnitsFor(d: IalData, subject: string): IalUnit[] {
  const byCode = new Map<string, IalUnit>()
  for (const sess of Object.keys(d.sessions)) {
    const subj = d.sessions[sess][subject]
    if (!subj) continue
    for (const u of subj.units) {
      const canonical = !/Unit\s*\d+[A-Z]:/.test(u.title) // prefer "Unit 1:" over "Unit 1A:"
      if (!byCode.has(u.code) || canonical) byCode.set(u.code, u)
    }
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}
export function ialUnitInSession(d: IalData, subject: string, session: string, code: string): IalUnit | undefined {
  const subj = d.sessions[session]?.[subject]
  if (!subj) return undefined
  return subj.units.find((u) => u.code === code)
}
export function ialSessionsForUnit(d: IalData, subject: string, code: string): string[] {
  return Object.keys(d.sessions).filter((s) => d.sessions[s][subject]?.units.some((u) => u.code === code))
}
export function ialCashins(d: IalData, subject: string): IalCashin[] {
  for (const sess of Object.keys(d.sessions)) {
    const c = d.sessions[sess][subject]?.cashins
    if (c && c.length) return c
  }
  return []
}

export function igcseSubjects(d: IgcseData): string[] {
  const s = new Set<string>()
  for (const sess of Object.values(d.sessions)) Object.keys(sess).forEach((k) => s.add(k))
  return [...s].sort()
}
export function igcseSessionsFor(d: IgcseData, subject: string): string[] {
  return Object.keys(d.sessions).filter((sess) => d.sessions[sess][subject])
}

export const GRADE_COLORS: Record<string, string> = {
  'A*': 'text-good', '9': 'text-good', '8': 'text-good', A: 'text-good', '7': 'text-good',
  B: 'text-brand-2', '6': 'text-brand-2', '5': 'text-brand-2',
  C: 'text-brand', '4': 'text-brand',
  D: 'text-warn', '3': 'text-warn', E: 'text-warn', '2': 'text-warn',
  '1': 'text-bad', U: 'text-bad',
}
