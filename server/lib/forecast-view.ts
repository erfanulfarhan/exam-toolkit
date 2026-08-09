import { IAL, IGCSE } from './data'
import { ialCurrentUnits, sortSessions } from './engine'
import { forecastAll, ialGrades, ialHistory, igcseHistory, nextSession } from './predict'

export type ForecastRequest = {
  qual?: 'IAL' | 'IGCSE'
  subject?: string
  code?: string
  papers?: string | null
  level?: 'A Level' | 'AS'
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

const EMPTY: ForecastView = { target: '', max: 0, units: [], code: '', series: [] }

export function forecastView(req: ForecastRequest): ForecastView {
  if (req.qual === 'IGCSE') {
    const subject = req.subject || ''
    const target = nextSession(Object.keys(IGCSE.sessions))
    const latest = [...sortSessions(Object.keys(IGCSE.sessions))].reverse()
      .find((s) => IGCSE.sessions[s][subject])
    if (!latest) return EMPTY
    const variants = IGCSE.sessions[latest][subject].variants
    const variant = variants.find((v) => v.papers === req.papers) || variants[0]
    if (!variant) return EMPTY
    const grades = variant.grades.filter((g) => g !== 'U')
    const series = forecastAll(grades, (g) => igcseHistory(IGCSE, subject, g, req.papers ?? null), target, variant.max)
    return {
      target,
      max: variant.max,
      units: [],
      code: '',
      series: series.map((f) => ({ grade: f.grade, label: f.grade, history: f.history, point: f.point })),
    }
  }

  const subject = req.subject || ''
  const seen = new Set<string>()
  const units = ialCurrentUnits(IAL, subject)
    .filter((u) => (seen.has(u.code) ? false : (seen.add(u.code), true)))
  if (!units.length) return EMPTY

  const unit = units.find((u) => u.code === req.code) || units[0]
  const target = nextSession(Object.keys(IAL.sessions))
  const series = forecastAll(ialGrades(unit), (g) => ialHistory(IAL, subject, unit.code, g), target, unit.raw_max)

  return {
    target,
    max: unit.raw_max,
    code: unit.code,
    units: units.map((u) => ({
      code: u.code,
      label: `${u.code}: ${u.title.replace(/^Unit\s*\d+[A-Z]?\s*:\s*/i, '')}`,
    })),
    series: series.map((f) => ({
      grade: f.grade,
      label: f.grade.toUpperCase(),
      history: f.history,
      point: f.point,
    })),
  }
}
