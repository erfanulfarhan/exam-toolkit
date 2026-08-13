import { IAL } from './data'
import {
  IalUnit, defaultUnitSelection, gradeLadder, ialCashins, ialCurrentUnits, ialSubjects,
  isALevelCashin, overallGrade, rawTable, rawToUms, resolveStarRule, sortSessions, starRule,
  unitGrade, unitKey,
} from './engine'
import { defaultEffort, getDifficulty } from './difficulty'
import { Plan, PlannerUnit, plan as solvePlan, planGrade } from './planner'

/**
 * Everything the International A Level screen needs, computed here so the
 * boundaries, the award rules and the planner never reach the browser.
 */

export type IalRequest = {
  subject?: string
  level?: 'A Level' | 'AS'
  session?: string
  mode?: 'ums' | 'raw'
  target?: string
  rows?: Record<string, { session?: string; variant?: string; value?: string }>
  taking?: Record<string, boolean>
  effort?: Record<string, number>
}

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
  ladder: { grade: string; need: number; reached: boolean }[]
  rule: { label: string; need: number; have: number; note: string } | null
  target: string
  plan: (Plan & { landsOn: string }) | null
}

function cleanTitle(title: string) {
  return title.replace(/^Unit\s*\d+[A-Z]?\s*:\s*/i, '').trim() || title
}

function sessionsForCode(subject: string, code: string): string[] {
  return sortSessions(
    Object.keys(IAL.sessions).filter((s) => IAL.sessions[s][subject]?.units.some((u) => u.code === code)),
  )
}

function variantsFor(subject: string, session: string, code: string): IalUnit[] {
  return IAL.sessions[session]?.[subject]?.units.filter((u) => u.code === code) || []
}

function latestUnit(subject: string, code: string): IalUnit | undefined {
  const list = sessionsForCode(subject, code)
  return variantsFor(subject, list[list.length - 1], code)[0]
}

/**
 * Some subject headings only ever covered a stretch of sessions: Pearson's
 * "(New)" headings from 2019 to 2021, and specifications that have since been
 * withdrawn. Both leave a session list that stops years ago, which is how a
 * student ends up calculating against Jan 2021 boundaries without noticing.
 * Labelling each one with the last sitting it covers makes that obvious in the
 * dropdown itself.
 */
function labelSubjects(names: string[]) {
  const newest = sortSessions(Object.keys(IAL.sessions)).slice(-1)[0]
  const lastOf = (subject: string) =>
    sortSessions(Object.keys(IAL.sessions).filter((s) => IAL.sessions[s][subject])).slice(-1)[0]
  return names.map((name) => {
    const last = lastOf(name)
    return last === newest ? name : `${name} (up to ${last})`
  })
}

/** Strip a label back to the key the dataset actually uses. */
function unlabel(name: string) {
  return name.replace(/\s*\(up to [A-Za-z]{3} \d{4}\)\s*$/, '')
}

export function ialView(req: IalRequest): IalView {
  const subjects = ialSubjects(IAL)
  const asked = unlabel(req.subject || '')
  const subject = subjects.includes(asked)
    ? asked
    : (subjects.includes('Chemistry') ? 'Chemistry' : subjects[0])
  const labelled = labelSubjects(subjects)
  const shownSubject = labelled[subjects.indexOf(subject)]
  const level: 'A Level' | 'AS' = req.level === 'AS' ? 'AS' : 'A Level'
  const mode = req.mode === 'raw' ? 'raw' : 'ums'

  const allSessions = sortSessions(Object.keys(IAL.sessions)).reverse()
  const session = allSessions.includes(req.session || '') ? req.session! : allSessions[0]

  const currentUnits = ialCurrentUnits(IAL, subject)
  const levelUnits = currentUnits.filter((u) => (level === 'AS' ? u.type === 'AS' : true))
  const seen = new Set<string>()
  const codes = levelUnits.filter((u) => (seen.has(u.code) ? false : (seen.add(u.code), true))).map((u) => u.code)

  const cashins = ialCashins(IAL, subject)
  const cashin = cashins.filter((c) => (level === 'AS' ? !isALevelCashin(c) : isALevelCashin(c)))[0]
    || cashins[cashins.length - 1]

  const defaultTaking = new Set(defaultUnitSelection(levelUnits, cashin))

  const units: IalUnitView[] = codes.map((code) => {
    const row = req.rows?.[code] || {}
    const available = sessionsForCode(subject, code)
    const chosenSession = available.includes(row.session || '')
      ? row.session!
      : (available.includes(session) ? session : available[available.length - 1] || '')
    const variants = variantsFor(subject, chosenSession, code)
    const variantKey = variants.some((v) => unitKey(v) === row.variant)
      ? row.variant!
      : (variants[0] ? unitKey(variants[0]) : code)
    const unit = variants.find((v) => unitKey(v) === variantKey) || latestUnit(subject, code)!
    const reference = latestUnit(subject, code) || unit

    const cap = mode === 'ums' ? unit.ums_max : unit.raw_max
    const text = row.value ?? ''
    const entered = text !== '' && !isNaN(Number(text))
    const value = entered ? Math.max(0, Math.min(cap, Number(text))) : null
    const ums = value == null ? null : mode === 'ums' ? value : rawToUms(unit, value)
    const raw = value == null ? null : mode === 'ums' ? rawTable(unit)[value] : value

    return {
      code,
      title: cleanTitle(reference.title),
      type: reference.type,
      cap,
      rawMax: unit.raw_max,
      umsMax: unit.ums_max,
      session: chosenSession,
      variant: variantKey,
      sessions: available,
      variants: variants.map((v) => ({
        key: unitKey(v),
        label: v.variant ? `Variant ${v.variant}` : 'Standard',
      })),
      ums,
      raw,
      grade: ums == null ? null : unitGrade(unit, ums),
      taking: req.taking?.[code] ?? defaultTaking.has(code),
      effort: req.effort?.[code] ?? defaultEffort(code),
      note: getDifficulty(code)?.note ?? null,
    }
  })

  const counted = units.filter((u) => u.taking)
  const baseRule = cashin ? starRule(subject, cashin, currentUnits) : null
  const rule = resolveStarRule(baseRule, counted.map((u) => ({ code: u.code, ums: u.ums })))

  const totalUms = counted.reduce((s, u) => s + (u.ums ?? 0), 0)
  const maxUms = cashin ? cashin.ums_max : counted.reduce((s, u) => s + u.umsMax, 0)
  const ruleUms = rule ? counted.reduce((s, u) => s + (rule.codes.includes(u.code) ? u.ums ?? 0 : 0), 0) : 0
  const overall = cashin ? overallGrade(cashin, totalUms, rule, ruleUms) : ''
  const anyMarks = counted.some((u) => u.ums != null)

  const ladderGrades = cashin ? gradeLadder(cashin, rule) : []
  const ladder = ladderGrades.map((g) => {
    const need = g === 'A*' ? cashin.ums['A'] : cashin.ums[g]
    return {
      grade: g,
      need,
      // A* shares the A total, so spell out the extra condition or the two rows
      // read as the same requirement.
      extra: g === 'A*' && rule ? `plus ${rule.need} at ${rule.label}` : null,
      reached: g === 'A*' ? overall === 'A*' : anyMarks && totalUms >= need,
    }
  })

  const target = ladderGrades.includes(req.target || '') ? req.target! : (ladderGrades.includes('A') ? 'A' : ladderGrades[0])

  let plan: (Plan & { landsOn: string }) | null = null
  if (cashin && anyMarks && counted.length) {
    const plannerUnits: PlannerUnit[] = counted.map((u) => {
      const reference = latestUnit(subject, u.code)!
      return {
        key: u.code,
        code: u.code,
        title: u.title,
        type: u.type,
        unit: reference,
        currentUms: u.ums,
        effort: u.effort,
      }
    })
    const solved = solvePlan(plannerUnits, cashin, target, rule)
    // The unit objects carry the whole boundary table, so strip them out.
    plan = { ...solved, starRule: null, landsOn: planGrade(solved, cashin) }
  }

  return {
    subjects: labelled,
    sessions: allSessions,
    subject: shownSubject,
    level,
    session,
    units,
    hasOptional: !!cashin && units.reduce((s, u) => s + u.umsMax, 0) > cashin.ums_max,
    totalUms,
    maxUms,
    overall,
    anyMarks,
    ladder,
    rule: rule ? { label: rule.label, need: rule.need, have: ruleUms, note: rule.note } : null,
    target,
    plan,
  }
}
