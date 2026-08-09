import { IalData, IalUnit, IgcseData, IgcseVariant, sessionOrder, sortSessions, unitKey } from './engine'

/**
 * Grade boundary forecasting.
 *
 * Pearson sets boundaries session by session from how the paper performed, so
 * nobody can know next series' numbers. What history does support is a range:
 * boundaries for the same unit drift slowly, and each series of the year has its
 * own character (October entries are small and often sit a few marks off June).
 *
 * The forecast is therefore two estimates blended:
 *   1. a weighted least-squares line through recent sessions, extrapolated one
 *      step, which captures drift;
 *   2. the recent mean for the *same* series (Jan / Jun / Oct), which captures
 *      the seasonal offset.
 *
 * The band around it is the spread of the history itself, never narrower than
 * two marks, because that is roughly the honest resolution of this method.
 */

export type Point = { session: string; value: number }

export type Forecast = {
  grade: string
  point: number
  low: number
  high: number
  history: Point[]
}

/** Half-life in sessions: a paper five sittings ago counts about a quarter. */
const HALF_LIFE = 3
const MIN_BAND = 2
/** Fewer than this many past sittings and a trend line is just noise. */
const MIN_HISTORY = 3

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The series Pearson runs next, following the cycle the data already shows. */
export function nextSession(sessions: string[]): string {
  const sorted = sortSessions(sessions)
  const latest = sorted[sorted.length - 1]
  if (!latest) return ''
  const [month, year] = latest.split(' ')

  // Which months this qualification still runs. Six sessions back is about two
  // years, recent enough to have dropped series Pearson has retired.
  const months = [...new Set(sorted.slice(-6).map((s) => s.split(' ')[0]))]
    .sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b))
  const i = months.indexOf(month)
  if (i === -1 || !months.length) return `Jun ${Number(year) + 1}`
  const next = months[(i + 1) % months.length]
  const rolls = MONTHS.indexOf(next) <= MONTHS.indexOf(month)
  return `${next} ${Number(year) + (rolls ? 1 : 0)}`
}

function weightedLine(points: Point[]) {
  // x is the position in the series, so the next session is at x = n.
  const n = points.length
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0
  points.forEach((p, i) => {
    const w = Math.pow(0.5, (n - 1 - i) / HALF_LIFE)
    sw += w
    sx += w * i
    sy += w * p.value
    sxx += w * i * i
    sxy += w * i * p.value
  })
  const denom = sw * sxx - sx * sx
  const slope = denom === 0 ? 0 : (sw * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / sw
  return { slope, intercept, weightSum: sw }
}

export function forecast(history: Point[], target: string, max: number): Forecast | null {
  const points = history.filter((p) => Number.isFinite(p.value))
  if (points.length < MIN_HISTORY) return null

  const { slope, intercept } = weightedLine(points)
  const trend = intercept + slope * points.length

  // Seasonal correction: what this series of the year usually does.
  const month = target.split(' ')[0]
  const sameSeries = points.filter((p) => p.session.startsWith(month)).slice(-3)
  const seasonal = sameSeries.length
    ? sameSeries.reduce((s, p) => s + p.value, 0) / sameSeries.length
    : null

  const blended = seasonal == null ? trend : trend * 0.6 + seasonal * 0.4

  // The band is how much this boundary has actually moved lately.
  const recent = points.slice(-6)
  const mean = recent.reduce((s, p) => s + p.value, 0) / recent.length
  const spread = Math.sqrt(recent.reduce((s, p) => s + (p.value - mean) ** 2, 0) / recent.length)
  const band = Math.max(MIN_BAND, Math.round(spread))

  const clamp = (v: number) => Math.max(0, Math.min(max, Math.round(v)))
  const point = clamp(blended)
  return {
    grade: '',
    point,
    low: clamp(point - band),
    high: clamp(point + band),
    history: points,
  }
}

/** Raw boundary history for one IAL unit, oldest session first. */
export function ialHistory(data: IalData, subject: string, code: string, grade: string): Point[] {
  const out: Point[] = []
  for (const session of sortSessions(Object.keys(data.sessions))) {
    const units = data.sessions[session]?.[subject]?.units || []
    // Prefer the standard paper over an "A" variant so the line stays comparable.
    const unit = units.filter((u) => u.code === code).sort((a, b) => (a.variant ? 1 : 0) - (b.variant ? 1 : 0))[0]
    const value = unit?.raw[grade]
    if (unit && typeof value === 'number' && value > 0) out.push({ session, value })
  }
  return out
}

export function ialGrades(unit: IalUnit): string[] {
  return ['a*', 'a', 'b', 'c', 'd', 'e'].filter((g) => unit.raw[g] != null)
}

/** Raw boundary history for one International GCSE subject and grade. */
export function igcseHistory(data: IgcseData, subject: string, grade: string, papers: string | null): Point[] {
  const out: Point[] = []
  for (const session of sortSessions(Object.keys(data.sessions))) {
    const variants = data.sessions[session]?.[subject]?.variants || []
    // Match the same paper combination where it exists, else the first listing.
    const v = variants.find((x) => x.papers === papers) || variants[0]
    const value = v?.boundaries[grade]
    if (v && typeof value === 'number' && value > 0) out.push({ session, value })
  }
  return out
}

/** Forecast every grade of a unit or subject in one call. */
export function forecastAll(
  grades: string[],
  historyFor: (grade: string) => Point[],
  target: string,
  max: number,
): Forecast[] {
  return grades
    .map((grade) => {
      const f = forecast(historyFor(grade), target, max)
      return f ? { ...f, grade } : null
    })
    .filter((f): f is Forecast => f !== null)
}

export { sessionOrder, unitKey }
