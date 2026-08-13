import { ExamsView } from '@/lib/types'
import { duration } from '@/lib/format'

/**
 * The printable exam routine.
 *
 * Deliberately an agenda rather than a spreadsheet: papers are grouped by the
 * week they fall in, each day leads with a large date so the sheet can be read
 * from across a room, and a span rule at the top shows the shape of the whole
 * run at a glance. Morning and afternoon are a filled or hollow marker, which
 * survives a black and white printer better than a coloured badge.
 *
 * Hidden on screen; the print stylesheet reveals it.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const parse = (iso: string) => new Date(iso + 'T00:00:00Z')
const dayNum = (iso: string) => String(parse(iso).getUTCDate()).padStart(2, '0')
const dayName = (iso: string) => DAYS[parse(iso).getUTCDay()]
const monthName = (iso: string) => MONTHS[parse(iso).getUTCMonth()]

/** Monday of the week an exam falls in, so weeks group consistently. */
function weekStart(iso: string) {
  const d = parse(iso)
  const shift = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - shift)
  return d.toISOString().slice(0, 10)
}

export function PrintRoutine({ view }: { view: ExamsView }) {
  const { exams, summary } = view
  if (!exams.length) return <div className="print-sheet" />

  const first = parse(summary.first!).getTime()
  const last = parse(summary.last!).getTime()
  const span = Math.max(1, last - first)

  // Group into weeks, then into days within each week.
  const weeks = new Map<string, Map<string, typeof exams>>()
  for (const e of exams) {
    const wk = weekStart(e.date)
    if (!weeks.has(wk)) weeks.set(wk, new Map())
    const days = weeks.get(wk)!
    days.set(e.date, [...(days.get(e.date) || []), e])
  }

  return (
    <div className="print-sheet">
      <div className="pr-head">
        <div>
          <div className="pr-title">Exam routine</div>
          <div className="pr-sub">
            {view.series} · Edexcel {view.qualification === 'IAL' ? 'International A Level' : 'International GCSE'}
          </div>
        </div>
        <div className="pr-stats">
          <span><b>{summary.papers}</b> papers</span>
          <span><b>{duration(summary.minutes)}</b> in exams</span>
          <span>over <b>{summary.span}</b> days</span>
        </div>
      </div>

      <div className="pr-fields">
        <span>Name <i /></span>
        <span>Centre <i /></span>
        <span>Candidate <i /></span>
      </div>

      {/* The whole run on one rule, so the clustering is obvious on paper. */}
      <div className="pr-span">
        <div className="pr-span-rule" />
        {exams.map((e) => (
          <div
            key={e.code + e.paper + e.date}
            className="pr-span-tick"
            style={{ left: `${((parse(e.date).getTime() - first) / span) * 100}%` }}
          />
        ))}
        <div className="pr-span-ends">
          <span>{dayNum(summary.first!)} {monthName(summary.first!)}</span>
          <span>{dayNum(summary.last!)} {monthName(summary.last!)}</span>
        </div>
      </div>

      {[...weeks.entries()].map(([wk, days]) => (
        <section key={wk} className="pr-week">
          <div className="pr-week-label">
            Week of {dayNum(wk)} {monthName(wk)}
          </div>

          {[...days.entries()].map(([date, list]) => (
            <div key={date} className="pr-day">
              <div className="pr-date">
                <span className="pr-date-num">{dayNum(date)}</span>
                <span className="pr-date-day">{dayName(date)}</span>
              </div>

              <div className="pr-papers">
                {list.map((e) => (
                  <div key={e.code + e.paper} className="pr-paper">
                    <div className="pr-meta">
                      <span className={e.session === 'Morning' ? 'pr-dot pr-dot-am' : 'pr-dot'} />
                      <span className="pr-when">{e.session === 'Morning' ? 'AM' : 'PM'}</span>
                      <span className="pr-dur">{duration(e.minutes)}</span>
                      <span className="pr-code">{e.code} {e.paper}</span>
                    </div>
                    <div className="pr-name">
                      <b>{e.subject}</b> {e.title}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pr-tick" />
            </div>
          ))}
        </section>
      ))}

      <div className="pr-notes">
        <div className="pr-notes-label">Notes</div>
        <div className="pr-rule" />
        <div className="pr-rule" />
        <div className="pr-rule" />
      </div>

      <div className="pr-foot">
        Sessions as published by Pearson. Start times vary by timezone, so your centre confirms the
        exact time. Unofficial: check against your statement of entry.
      </div>
    </div>
  )
}
