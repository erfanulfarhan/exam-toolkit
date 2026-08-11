import timetables from '../../data/timetables.json'

/**
 * Personal exam timetable.
 *
 * Built from the scheduling facts in Pearson's published examination
 * timetables: which unit sits on which date, in which session, for how long.
 * Pearson gives a session rather than a clock time because start times differ
 * by timezone, so this reports the session and says so.
 */

export type Exam = {
  code: string
  paper: string
  subject: string
  title: string
  date: string
  session: 'Morning' | 'Afternoon'
  minutes: number
}

type Series = { qualification: 'IAL' | 'IGCSE'; exams: Exam[] }
const TABLES = timetables as unknown as Record<string, Series>

export type ExamsRequest = {
  series?: string
  codes?: string[]
  subjects?: string[]
  today?: string
}

export type ExamsView = {
  seriesList: { label: string; qualification: string; first: string; last: string }[]
  series: string
  qualification: string
  subjects: string[]
  /** Every unit sitting in this series, so the UI can offer a picker. */
  available: { code: string; paper: string; subject: string; title: string }[]
  exams: (Exam & { daysAway: number; clash: boolean })[]
  summary: {
    papers: number
    minutes: number
    first: string | null
    last: string | null
    daysToFirst: number | null
    span: number | null
  }
  clashes: { date: string; session: string; codes: string[] }[]
}

function seriesOrder(label: string) {
  const [m, y] = label.replace(' IGCSE', '').split(' ')
  const months: Record<string, number> = { Jan: 1, Jun: 6, Oct: 10, Nov: 11 }
  return Number(y) * 100 + (months[m] || 0)
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (new Date(to + 'T00:00:00Z').getTime() - new Date(from + 'T00:00:00Z').getTime()) / 86400000)
}

export function examsView(req: ExamsRequest): ExamsView {
  const seriesList = Object.entries(TABLES)
    .map(([label, s]) => ({
      label,
      qualification: s.qualification,
      first: s.exams[0]?.date ?? '',
      last: s.exams[s.exams.length - 1]?.date ?? '',
    }))
    .sort((a, b) => seriesOrder(a.label) - seriesOrder(b.label))

  const today = req.today || new Date().toISOString().slice(0, 10)
  // Default to the next series that has not finished yet.
  const label = TABLES[req.series || '']
    ? req.series!
    : (seriesList.find((s) => s.last >= today)?.label ?? seriesList[seriesList.length - 1].label)
  const series = TABLES[label]

  const subjects = [...new Set(series.exams.map((e) => e.subject))].sort()
  const available = series.exams.map((e) => ({
    code: e.code, paper: e.paper, subject: e.subject, title: e.title,
  }))

  const wantedCodes = new Set(req.codes || [])
  const wantedSubjects = new Set(req.subjects || [])
  const picked = series.exams.filter(
    (e) => wantedCodes.has(e.code) || wantedSubjects.has(e.subject))

  // Two papers in the same session on the same day is a clash the student has
  // to take to their exams officer, so it is worth surfacing loudly.
  const bySlot = new Map<string, string[]>()
  for (const e of picked) {
    const key = `${e.date}|${e.session}`
    bySlot.set(key, [...(bySlot.get(key) || []), e.code])
  }
  const clashes = [...bySlot.entries()]
    .filter(([, codes]) => codes.length > 1)
    .map(([key, codes]) => {
      const [date, session] = key.split('|')
      return { date, session, codes }
    })
  const clashed = new Set(clashes.flatMap((c) => c.codes.map((code) => `${c.date}|${c.session}|${code}`)))

  const exams = picked
    .map((e) => ({
      ...e,
      daysAway: daysBetween(today, e.date),
      clash: clashed.has(`${e.date}|${e.session}|${e.code}`),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session))

  const upcoming = exams.filter((e) => e.daysAway >= 0)
  const first = exams[0]?.date ?? null
  const last = exams[exams.length - 1]?.date ?? null

  return {
    seriesList,
    series: label,
    qualification: series.qualification,
    subjects,
    available,
    exams,
    summary: {
      papers: exams.length,
      minutes: exams.reduce((s, e) => s + e.minutes, 0),
      first,
      last,
      daysToFirst: upcoming.length ? upcoming[0].daysAway : null,
      span: first && last ? daysBetween(first, last) + 1 : null,
    },
    clashes,
  }
}

/** The date of a subject's final paper in a series, for the routine builder. */
export function lastExamDate(series: string, subject: string): string | null {
  const table = TABLES[series]
  if (!table) return null
  const dates = table.exams.filter((e) => e.subject === subject).map((e) => e.date).sort()
  return dates.length ? dates[dates.length - 1] : null
}

export function seriesLabels() {
  return Object.keys(TABLES)
}
