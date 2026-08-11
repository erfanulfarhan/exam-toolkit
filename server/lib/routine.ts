import { IAL } from './data'
import { ialCurrentUnits, ialSubjects } from './engine'
import { defaultEffort } from './difficulty'

/**
 * Study routine builder.
 *
 * The scheduling rules, in order of importance:
 *
 *   1. Time follows weakness. A unit's share of the available minutes scales
 *      with how hard the student says it is, not with how many units there are.
 *   2. Spacing beats cramming. Each unit gets several separate touches with
 *      widening gaps rather than one long block, because a unit revisited on
 *      days 1, 4 and 11 is remembered and one studied for three hours on day 1
 *      is not.
 *   3. The last stretch is review and papers only. New ground close to an exam
 *      is the least useful thing a student can do, so the final fifth of the
 *      run switches to short revisits plus timed papers.
 *   4. No more than two subjects a day. Context switching costs more than the
 *      extra variety is worth.
 */

export type RoutineRequest = {
  subjects?: { subject: string; examDate: string; units?: Record<string, number> }[]
  /** Minutes available per weekday, Sunday first. */
  hours?: number[]
  startDate?: string
}

export type Session = {
  subject: string
  code: string
  title: string
  minutes: number
  kind: 'learn' | 'review' | 'paper'
}

export type Day = {
  date: string
  weekday: string
  minutes: number
  sessions: Session[]
  /** Set on the day of an exam, so the plan stops for that subject. */
  exams: string[]
}

export type RoutineView = {
  subjects: string[]
  days: Day[]
  totalMinutes: number
  perSubject: { subject: string; minutes: number; examDate: string; share: number }[]
  perUnit: { subject: string; code: string; title: string; minutes: number; effort: number }[]
  warnings: string[]
  units: Record<string, { code: string; title: string; effort: number }[]>
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const BLOCK = 45          // one sitting, minutes
const MAX_PER_DAY = 4     // blocks before a day stops being realistic
const MAX_SUBJECTS_DAY = 2

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function cleanTitle(t: string) {
  return t.replace(/^Unit\s*\d+[A-Z]?\s*:\s*/i, '').trim() || t
}

/** Every current unit of a subject, deduplicated by code, with a default effort. */
export function unitsForSubject(subject: string) {
  const seen = new Set<string>()
  return ialCurrentUnits(IAL, subject)
    .filter((u) => (seen.has(u.code) ? false : (seen.add(u.code), true)))
    .map((u) => ({ code: u.code, title: cleanTitle(u.title), effort: defaultEffort(u.code) }))
}

export function buildRoutine(req: RoutineRequest): RoutineView {
  const all = ialSubjects(IAL)
  const chosen = (req.subjects || []).filter((s) => all.includes(s.subject)).slice(0, 6)
  const warnings: string[] = []

  const units: RoutineView['units'] = {}
  for (const s of chosen) units[s.subject] = unitsForSubject(s.subject)

  if (!chosen.length) {
    return { subjects: all, days: [], totalMinutes: 0, perSubject: [], perUnit: [], warnings, units }
  }

  // Minutes available on each weekday, Sunday first.
  const hours = (req.hours && req.hours.length === 7 ? req.hours : [2, 1, 1, 1, 1, 1, 2])
    .map((h) => Math.max(0, Math.min(12, Number(h) || 0)))
  const perWeekday = hours.map((h) => Math.round(h * 60))

  const start = req.startDate ? new Date(req.startDate + 'T00:00:00Z') : new Date(iso(new Date()) + 'T00:00:00Z')
  const examOf = new Map(chosen.map((s) => [s.subject, new Date(s.examDate + 'T00:00:00Z')]))
  const lastExam = new Date(Math.max(...[...examOf.values()].map((d) => d.getTime())))

  if (isNaN(lastExam.getTime()) || lastExam <= start) {
    warnings.push('Every exam date is in the past, so there is nothing to schedule.')
    return { subjects: all, days: [], totalMinutes: 0, perSubject: [], perUnit: [], warnings, units }
  }

  // Build the empty calendar first: which days exist and how much fits in each.
  const days: Day[] = []
  for (let d = new Date(start); d <= lastExam; d = addDays(d, 1)) {
    const wd = d.getUTCDay()
    const exams = chosen.filter((s) => s.examDate === iso(d)).map((s) => s.subject)
    days.push({
      date: iso(d),
      weekday: WEEKDAYS[wd],
      // An exam day is not a study day.
      minutes: exams.length ? 0 : Math.min(perWeekday[wd], BLOCK * MAX_PER_DAY),
      sessions: [],
      exams,
    })
  }

  const capacity = days.reduce((s, d) => s + d.minutes, 0)
  if (capacity < BLOCK) {
    warnings.push('That leaves almost no study time. Raise the hours or start earlier.')
  }

  // Weight every unit. Effort 5 gets double the time of effort 1.
  type Slot = { subject: string; code: string; title: string; effort: number; weight: number; minutes: number; placed: number }
  const slots: Slot[] = []
  for (const s of chosen) {
    for (const u of units[s.subject]) {
      const effort = s.units?.[u.code] ?? u.effort
      slots.push({
        subject: s.subject, code: u.code, title: u.title, effort,
        weight: 1 + 0.25 * (effort - 3), minutes: 0, placed: 0,
      })
    }
  }
  const totalWeight = slots.reduce((a, b) => a + b.weight, 0) || 1
  for (const slot of slots) slot.minutes = Math.round((capacity * slot.weight) / totalWeight)

  // Deal blocks out day by day. Within a day, prefer the unit that is furthest
  // behind its target and has not been touched recently, so revisits space out.
  const lastTouched = new Map<string, number>()
  const lastPaper = new Map<string, number>()
  const reviewStartsAt = Math.floor(days.length * 0.8)

  days.forEach((day, index) => {
    if (!day.minutes) return
    let left = day.minutes
    const subjectsToday = new Set<string>()

    while (left >= BLOCK / 2) {
      const usable = slots.filter((s) => {
        const exam = examOf.get(s.subject)!
        if (iso(exam) <= day.date) return false          // exam already sat
        if (s.placed >= s.minutes + BLOCK) return false  // this unit has had its share
        if (subjectsToday.size >= MAX_SUBJECTS_DAY && !subjectsToday.has(s.subject)) return false
        return true
      })
      if (!usable.length) break

      usable.sort((a, b) => {
        // A second block should go to a different subject where possible, so
        // a day reads as a mix rather than three hours of one thing.
        const freshA = subjectsToday.has(a.subject) ? 1 : 0
        const freshB = subjectsToday.has(b.subject) ? 1 : 0
        if (freshA !== freshB) return freshA - freshB
        const debtA = (a.minutes - a.placed) / Math.max(1, a.minutes)
        const debtB = (b.minutes - b.placed) / Math.max(1, b.minutes)
        const restA = index - (lastTouched.get(a.code) ?? -99)
        const restB = index - (lastTouched.get(b.code) ?? -99)
        // Furthest behind wins; a unit touched yesterday waits its turn.
        return (debtB - debtA) || (restB - restA)
      })

      const pick = usable[0]
      const daysToExam = Math.round((examOf.get(pick.subject)!.getTime() - new Date(day.date + 'T00:00:00Z').getTime()) / 86400000)
      const reviewing = index >= reviewStartsAt || daysToExam <= 10
      // One timed paper per subject roughly weekly once revision starts. A real
      // paper does not fit in 45 minutes, so it takes a double block.
      const duePaper = reviewing && index - (lastPaper.get(pick.subject) ?? -99) >= 6 && left >= BLOCK * 2
      const kind: Session['kind'] = duePaper ? 'paper' : reviewing ? 'review' : 'learn'
      const minutes = Math.min(duePaper ? BLOCK * 2 : BLOCK, left)

      day.sessions.push({ subject: pick.subject, code: pick.code, title: pick.title, minutes, kind })
      if (duePaper) lastPaper.set(pick.subject, index)
      pick.placed += minutes
      left -= minutes
      subjectsToday.add(pick.subject)
      lastTouched.set(pick.code, index)
    }
    day.minutes = day.sessions.reduce((s, x) => s + x.minutes, 0)
  })

  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0)
  const perSubject = chosen.map((s) => {
    const minutes = days.reduce(
      (sum, d) => sum + d.sessions.filter((x) => x.subject === s.subject).reduce((a, b) => a + b.minutes, 0), 0)
    return { subject: s.subject, minutes, examDate: s.examDate, share: totalMinutes ? minutes / totalMinutes : 0 }
  })

  const perUnit = slots
    .map((s) => ({ subject: s.subject, code: s.code, title: s.title, minutes: s.placed, effort: s.effort }))
    .filter((s) => s.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)

  const starved = perUnit.filter((u) => u.minutes < BLOCK * 2)
  if (starved.length) {
    warnings.push(
      `${starved.length} unit${starved.length > 1 ? 's get' : ' gets'} under 90 minutes in total. ` +
      'More hours a day, or an earlier start, would fix that.')
  }

  return { subjects: all, days, totalMinutes, perSubject, perUnit, warnings, units }
}
