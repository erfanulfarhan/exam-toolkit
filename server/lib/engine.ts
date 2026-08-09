// ---- Types matching public/data/*.json ----
export type IalUnit = {
  code: string
  title: string
  type: 'AS' | 'A2'
  variant: string | null
  raw_max: number
  raw: Record<string, number>
  ums_max: number
  ums: Record<string, number>
}
export type IalCashin = { code: string; title: string; ums_max: number; ums: Record<string, number> }
export type IalSubject = { units: IalUnit[]; cashins: IalCashin[] }
export type IalData = { qualification: 'IAL'; sessions: Record<string, Record<string, IalSubject>> }

export type IgcseVariant = {
  code: string
  title: string
  max: number
  grades: string[]
  boundaries: Record<string, number>
  papers: string | null
}
export type IgcseSubject = { variants: IgcseVariant[] }
export type IgcseData = { qualification: 'IGCSE'; sessions: Record<string, Record<string, IgcseSubject>> }

// ---- Piecewise-linear interpolation (the raw -> UMS core) ----
function interp(anchors: [number, number][], x: number): number {
  const pts = [...anchors].sort((a, b) => a[0] - b[0]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0])
  if (x <= pts[0][0]) return pts[0][1]
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
    }
  }
  return pts[pts.length - 1][1]
}

const AS_ORDER = ['a*', 'a', 'b', 'c', 'd', 'e']
const A2_ORDER = ['a*', 'a', 'b', 'c', 'd', 'e']
export const CASHIN_ORDER = ['A', 'B', 'C', 'D', 'E']

export function unitGradeOrder(u: IalUnit) {
  return (u.type === 'A2' ? A2_ORDER : AS_ORDER).filter((g) => u.ums[g] != null)
}

// Anchors: (0,0) + each grade's (raw, ums) + (raw_max, ums_max)
export function rawToUms(u: IalUnit, raw: number): number {
  const anchors: [number, number][] = [[0, 0], [u.raw_max, u.ums_max]]
  for (const g of Object.keys(u.raw)) {
    if (u.ums[g] != null) anchors.push([u.raw[g], u.ums[g]])
  }
  const r = Math.max(0, Math.min(u.raw_max, raw))
  return Math.round(interp(anchors, r))
}

/** Smallest raw mark that reaches a target UMS (inverse of rawToUms). */
export function umsToRaw(u: IalUnit, targetUms: number): number {
  if (targetUms <= 0) return 0
  for (let r = 0; r <= u.raw_max; r++) if (rawToUms(u, r) >= targetUms) return r
  return u.raw_max
}

/** rawFor[ums] = the smallest raw mark that reaches that UMS. Cached per unit. */
const rawTables = new WeakMap<IalUnit, number[]>()
export function rawTable(u: IalUnit): number[] {
  let table = rawTables.get(u)
  if (table) return table
  table = new Array(u.ums_max + 1).fill(u.raw_max)
  let next = 0
  for (let r = 0; r <= u.raw_max && next <= u.ums_max; r++) {
    const ums = rawToUms(u, r)
    while (next <= ums && next <= u.ums_max) table[next++] = r
  }
  rawTables.set(u, table)
  return table
}

export function unitGrade(u: IalUnit, ums: number): string {
  for (const g of unitGradeOrder(u)) {
    if (ums >= u.ums[g]) return g.toUpperCase()
  }
  return 'U'
}

export function igcseGrade(v: IgcseVariant, raw: number): string {
  for (const g of v.grades) {
    if (g !== 'U' && v.boundaries[g] != null && raw >= v.boundaries[g]) return g
  }
  return 'U'
}

// ---- Award rules ----------------------------------------------------------
// Pearson does not publish an A* cash-in boundary: A* is a rule applied on top
// of an A. For a six-unit International A Level that is 480 UMS overall *and*
// 270 of the 300 UMS available at A2 (90%). Four-unit qualifications use
// 320 / 180. Mathematics substitutes a P3 + P4 requirement for the A2 rule.
export type StarRule = {
  /** Unit codes that count toward the A* sub-total. */
  codes: string[]
  need: number
  max: number
  label: string
  note: string
  /**
   * Set when Pearson counts a student's *best* N units rather than a fixed
   * set, as in Further and Pure Mathematics, whose units are all published under
   * the AS heading because they can be cashed in at either level.
   */
  bestOf?: number
}

export function isALevelCashin(c: IalCashin) {
  return /a\s*level/i.test(c.title) && !/\bAS\b/i.test(c.title)
}

const MATHS_P3P4 = ['WMA13', 'WMA14'] // new spec P3 + P4
const MATHS_C34 = ['WMA02'] // legacy C34, a single 200-UMS unit

/** Sum of ums_max over distinct unit codes, so variants cannot double-count. */
function maxOverCodes(units: IalUnit[], codes: string[]) {
  const seen = new Set<string>()
  let total = 0
  for (const u of units) {
    if (!codes.includes(u.code) || seen.has(u.code)) continue
    seen.add(u.code)
    total += u.ums_max
  }
  return total
}

export function starRule(subject: string, cashin: IalCashin, units: IalUnit[]): StarRule | null {
  if (!isALevelCashin(cashin) || !units.length) return null
  const half = Math.round(cashin.ums_max / 2)
  const need = Math.round(half * 0.9)

  if (/^Mathematics/i.test(subject)) {
    const codes = MATHS_P3P4.every((c) => units.some((u) => u.code === c))
      ? MATHS_P3P4
      : MATHS_C34.every((c) => units.some((u) => u.code === c))
        ? MATHS_C34
        : null
    if (codes) {
      const max = maxOverCodes(units, codes)
      return {
        codes,
        max,
        need: Math.round(max * 0.9),
        label: codes.length > 1 ? 'P3 + P4' : 'C34',
        note: `International A Level Mathematics awards A* for an A overall (${cashin.ums['A']} UMS) plus at least ${Math.round(max * 0.9)} of the ${max} combined UMS on ${codes.join(' and ')}.`,
      }
    }
  }

  const a2 = [...new Set(units.filter((u) => u.type === 'A2').map((u) => u.code))]
  if (a2.length) {
    return {
      codes: a2,
      max: half,
      need,
      label: 'A2 units',
      note: `A* needs an A overall (${cashin.ums['A']} UMS) plus at least ${need} of the ${half} UMS available at A2, which is 90%.`,
    }
  }

  // Further and Pure Mathematics publish every unit under the AS heading,
  // because the same units can be cashed in at AS or A2. Pearson still awards
  // A* on 90% of the A2 half, counted across the best A2 units, approximated
  // here as the student's best-scoring units filling that half.
  const codes = [...new Set(units.map((u) => u.code))]
  const perUnit = units[0].ums_max || 100
  const bestOf = Math.max(1, Math.round(half / perUnit))
  return {
    codes,
    max: half,
    need,
    label: `best ${bestOf} units`,
    note: `A* needs an A overall (${cashin.ums['A']} UMS) plus at least ${need} of the ${half} UMS counted at A2, which is 90%. Pearson does not label which ${subject} units sit at A2, so this is measured against your ${bestOf} strongest units.`,
    bestOf,
  }
}

/** Narrow a best-of rule to the codes it actually applies to for these marks. */
export function resolveStarRule(
  rule: StarRule | null,
  scores: { code: string; ums: number | null }[],
): StarRule | null {
  if (!rule?.bestOf) return rule
  const ranked = scores
    .filter((s) => rule.codes.includes(s.code))
    .sort((a, b) => (b.ums ?? 0) - (a.ums ?? 0) || a.code.localeCompare(b.code))
    .slice(0, rule.bestOf)
    .map((s) => s.code)
  return { ...rule, codes: ranked }
}

/** Overall cash-in grade from a UMS total, before the A* rule. */
export function baseGrade(cashin: IalCashin, totalUms: number): string {
  for (const g of CASHIN_ORDER) {
    if (cashin.ums[g] != null && totalUms >= cashin.ums[g]) return g
  }
  return 'U'
}

/** Overall grade including A*, given the A2 (or P3+P4) sub-total. */
export function overallGrade(cashin: IalCashin, totalUms: number, rule: StarRule | null, ruleUms: number): string {
  const base = baseGrade(cashin, totalUms)
  if (base === 'A' && rule && ruleUms >= rule.need) return 'A*'
  return base
}

export function gradeLadder(cashin: IalCashin, rule: StarRule | null): string[] {
  const ladder = CASHIN_ORDER.filter((g) => cashin.ums[g] != null)
  return rule ? ['A*', ...ladder] : ladder
}

// ---- Data reshaping helpers ----
const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
export function sessionOrder(label: string) {
  const [m, y] = label.split(' ')
  return Number(y) * 100 + (MONTHS[m] || 0)
}
export function sortSessions(labels: string[]) {
  return [...labels].sort((a, b) => sessionOrder(a) - sessionOrder(b))
}

export function unitKey(u: { code: string; variant?: string | null }) {
  return u.variant ? `${u.code}${u.variant}` : u.code
}

export function ialSubjects(d: IalData): string[] {
  const s = new Set<string>()
  for (const sess of Object.values(d.sessions)) Object.keys(sess).forEach((k) => s.add(k))
  return [...s].sort()
}

export function ialSessions(d: IalData): string[] {
  return sortSessions(Object.keys(d.sessions))
}

/** Every distinct unit a subject has ever had, newest boundaries winning. */
export function ialUnitsFor(d: IalData, subject: string): IalUnit[] {
  const byKey = new Map<string, IalUnit>()
  for (const sess of sortSessions(Object.keys(d.sessions))) {
    const subj = d.sessions[sess][subject]
    if (!subj) continue
    for (const u of subj.units) byKey.set(unitKey(u), u)
  }
  return [...byKey.values()].sort((a, b) => unitKey(a).localeCompare(unitKey(b)))
}

/** Units of the current specification only, the ones still sittable. */
export function ialCurrentUnits(d: IalData, subject: string): IalUnit[] {
  const sessions = sortSessions(Object.keys(d.sessions)).filter((s) => d.sessions[s][subject])
  const latest = sessions[sessions.length - 1]
  if (!latest) return []
  const byKey = new Map<string, IalUnit>()
  for (const u of d.sessions[latest][subject].units) byKey.set(unitKey(u), u)
  return [...byKey.values()].sort((a, b) => unitKey(a).localeCompare(unitKey(b)))
}

/**
 * Which units a student is most likely taking.
 *
 * Most subjects publish exactly the units the cash-in needs. Mathematics and
 * Further Mathematics publish a menu: four compulsory Pure papers plus a
 * choice of applications, so pick the compulsory core first (the largest
 * family of unit codes) and top up in code order until the cash-in is filled.
 */
export function defaultUnitSelection(units: IalUnit[], cashin?: IalCashin): string[] {
  const byCode = new Map<string, IalUnit>()
  for (const u of units) if (!byCode.has(u.code)) byCode.set(u.code, u)
  const list = [...byCode.values()]
  const total = list.reduce((s, u) => s + u.ums_max, 0)
  if (!cashin || total <= cashin.ums_max) return list.map((u) => u.code)

  const families = new Map<string, number>()
  for (const u of list) families.set(u.code.slice(0, 3), (families.get(u.code.slice(0, 3)) || 0) + 1)
  const core = [...families.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  const ordered = [...list].sort((a, b) => {
    const ca = a.code.startsWith(core) ? 0 : 1
    const cb = b.code.startsWith(core) ? 0 : 1
    return ca - cb || a.code.localeCompare(b.code)
  })

  const picked: string[] = []
  let sum = 0
  for (const u of ordered) {
    if (sum + u.ums_max > cashin.ums_max) continue
    picked.push(u.code)
    sum += u.ums_max
    if (sum === cashin.ums_max) break
  }
  return picked
}

export function ialUnitInSession(d: IalData, subject: string, session: string, key: string): IalUnit | undefined {
  return d.sessions[session]?.[subject]?.units.find((u) => unitKey(u) === key)
}

export function ialSessionsForUnit(d: IalData, subject: string, key: string): string[] {
  return sortSessions(Object.keys(d.sessions)).filter((s) =>
    d.sessions[s][subject]?.units.some((u) => unitKey(u) === key))
}

export function ialCashins(d: IalData, subject: string): IalCashin[] {
  for (const sess of sortSessions(Object.keys(d.sessions)).reverse()) {
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
  return sortSessions(Object.keys(d.sessions)).filter((sess) => d.sessions[sess][subject])
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
