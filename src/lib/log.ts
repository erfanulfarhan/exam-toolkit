/**
 * A record of the papers you have actually sat.
 *
 * Every entry is written as you mark a paper, so the log fills itself in
 * without a "save" button. It lives in this browser's localStorage, like the
 * rest of the site — no account, nothing sent anywhere.
 *
 * One entry per paper (keyed by the same key the per-question progress uses),
 * so re-opening a paper and marking more of it updates that attempt rather than
 * piling up duplicates.
 */

export type LogEntry = {
  key: string
  level: string
  subject: string
  unit: string
  session: string
  year: number
  /** Marks the student gave themselves, summed across questions. */
  marks: number
  /** The paper's raw total, when the boundary data knows the unit. */
  rawMax?: number
  grade?: string
  ums?: number
  umsMax?: number
  questions: number
  attempted: number
  /** ISO timestamp of the most recent marking. */
  at: string
}

const STORE = 'practice.log'

export function loadLog(): LogEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || '[]')
    return Array.isArray(raw) ? (raw as LogEntry[]) : []
  } catch {
    return []
  }
}

function write(entries: LogEntry[]) {
  localStorage.setItem(STORE, JSON.stringify(entries))
  // Same-tab listeners: the storage event only fires in *other* tabs, so the
  // log page would otherwise not refresh while you mark a paper beside it.
  window.dispatchEvent(new Event('practice-log'))
}

/** Add or update the attempt for one paper. Newest first. */
export function saveEntry(entry: LogEntry): void {
  const rest = loadLog().filter((e) => e.key !== entry.key)
  write([entry, ...rest])
}

export function removeEntry(key: string): void {
  write(loadLog().filter((e) => e.key !== key))
}

export function clearLog(): void {
  write([])
}

/** Percentage scored, when the paper's total is known. */
export function percentOf(entry: LogEntry): number | undefined {
  if (!entry.rawMax || entry.rawMax <= 0) return undefined
  return Math.round((entry.marks / entry.rawMax) * 100)
}

export type UnitStat = {
  label: string
  subject: string
  unit: string
  papers: number
  average: number
}

/**
 * Average score per unit, weakest first — the units worth another paper.
 * Only entries whose total is known can be averaged, since marks alone are not
 * comparable between a 45 mark unit and an 80 mark one.
 */
export function unitAverages(entries: LogEntry[]): UnitStat[] {
  const buckets = new Map<string, { subject: string; unit: string; sum: number; n: number }>()
  for (const e of entries) {
    const pct = percentOf(e)
    if (pct == null) continue
    const label = `${e.subject} ${e.unit}`.trim()
    const found = buckets.get(label)
    if (found) { found.sum += pct; found.n += 1 }
    else buckets.set(label, { subject: e.subject, unit: e.unit, sum: pct, n: 1 })
  }
  return [...buckets.entries()]
    .map(([label, b]) => ({
      label, subject: b.subject, unit: b.unit, papers: b.n, average: Math.round(b.sum / b.n),
    }))
    .sort((a, b) => a.average - b.average)
}

/** Scored papers oldest-to-newest, which is the direction a trend reads in. */
export function trend(entries: LogEntry[]): { entry: LogEntry; percent: number }[] {
  return entries
    .map((entry) => ({ entry, percent: percentOf(entry) }))
    .filter((row): row is { entry: LogEntry; percent: number } => row.percent != null)
    .sort((a, b) => a.entry.at.localeCompare(b.entry.at))
}
