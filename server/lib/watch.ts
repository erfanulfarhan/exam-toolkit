import { IAL, IGCSE } from './data'
import { sortSessions } from './engine'

/**
 * Results day watcher.
 *
 * Pearson publishes each session's boundary PDF at a predictable URL. This
 * probes for the sessions we do not hold yet and reports which are live, so the
 * cron job can kick off a rebuild that ingests them.
 */

const BASE = 'https://qualifications.pearson.com/content/dam/pdf/Support/Grade-boundaries'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const MONTHS: Record<string, number> = { Jan: 1, Jun: 6, Oct: 10, Nov: 11 }
const NAMES: Record<number, string> = { 1: 'january', 6: 'june', 10: 'october', 11: 'november' }

const IAL_PATTERNS = [
  (yy: string, mm: string) => `${yy}${mm}-ial-subject-grade-boundaries.pdf`,
  (yy: string, mm: string) => `${yy}${mm}-ial-subject-grade-boundaries-v1.pdf`,
  (_yy: string, mm: string, y: number) => `grade-boundaries-${NAMES[+mm]}-${y}-international-advanced-level.pdf`,
]
const IGCSE_PATTERNS = [
  (yy: string, mm: string) => `${yy}${mm}-international-gcse-subject-grade-boundaries.pdf`,
  (yy: string, mm: string) => `${yy}${mm}-intgcse-9-1-subject-grade-boundaries.pdf`,
  (_yy: string, mm: string, y: number) => `grade-boundaries-${NAMES[+mm]}-${y}-int-gcse.pdf`,
]

function order(label: string) {
  const [m, y] = label.split(' ')
  return Number(y) * 100 + (MONTHS[m] || 0)
}

/** The next few sessions after the newest one held, following the same cycle. */
function upcoming(known: string[], count = 2) {
  const sorted = sortSessions(known)
  const latest = sorted[sorted.length - 1]
  const cycle = [...new Set(sorted.slice(-6).map((s) => s.split(' ')[0]))]
    .sort((a, b) => MONTHS[a] - MONTHS[b])
  let [monthName, yearText] = latest.split(' ')
  let m = MONTHS[monthName]
  let y = Number(yearText)
  const out: { label: string; month: number; year: number }[] = []
  for (let i = 0; i < count; i++) {
    const later = cycle.filter((c) => MONTHS[c] > m)
    if (later.length) m = MONTHS[later[0]]
    else { m = MONTHS[cycle[0]]; y += 1 }
    const name = Object.keys(MONTHS).find((k) => MONTHS[k] === m)!
    out.push({ label: `${name} ${y}`, month: m, year: y })
  }
  return out
}

async function isPublished(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'user-agent': UA } })
    return (res.headers.get('content-type') || '').includes('pdf')
  } catch {
    return false
  }
}

export type Published = { qualification: 'IAL' | 'IGCSE'; session: string; file: string }

export async function checkForNewSessions(): Promise<Published[]> {
  const found: Published[] = []
  const jobs: { qual: 'IAL' | 'IGCSE'; dir: string; known: string[]; patterns: typeof IAL_PATTERNS }[] = [
    { qual: 'IAL', dir: `${BASE}/International-A-level`, known: Object.keys(IAL.sessions), patterns: IAL_PATTERNS },
    { qual: 'IGCSE', dir: `${BASE}/International-GCSE`, known: Object.keys(IGCSE.sessions), patterns: IGCSE_PATTERNS },
  ]

  for (const job of jobs) {
    const held = new Set(job.known)
    for (const next of upcoming(job.known)) {
      if (held.has(next.label)) continue
      const mm = String(next.month).padStart(2, '0')
      const yy = String(next.year).slice(2)
      for (const pattern of job.patterns) {
        const file = pattern(yy, mm, next.year)
        if (await isPublished(`${job.dir}/${file}`)) {
          found.push({ qualification: job.qual, session: next.label, file })
          break
        }
      }
    }
  }
  return found
}

export function heldSessions() {
  return {
    ial: sortSessions(Object.keys(IAL.sessions)).slice(-1)[0],
    igcse: sortSessions(Object.keys(IGCSE.sessions)).slice(-1)[0],
  }
}
