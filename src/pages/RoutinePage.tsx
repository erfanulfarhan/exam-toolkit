import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, CalendarPlus, Plus, X } from 'lucide-react'
import { Card, Field, Meter, NumInput, Select, TONES } from '@/components/ui'
import { useApi } from '@/lib/api'
import { downloadIcs } from '@/lib/ics'
import { RoutineView } from '@/lib/types'
import { clock12 } from '@/lib/format'

type Entry = { subject: string; examDate?: string; units?: Record<string, number> }

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STORE = 'routine.v1'
const KIND: Record<string, { label: string; tone: keyof typeof TONES }> = {
  learn: { label: 'Learn', tone: 'teal' },
  review: { label: 'Review', tone: 'violet' },
  paper: { label: 'Paper', tone: 'amber' },
}

const today = () => new Date().toISOString().slice(0, 10)

export function RoutinePage() {
  // No account, so the plan lives in this browser. Nothing is stored server side.
  const [entries, setEntries] = useState<Entry[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null')
      if (saved?.entries?.length) return saved.entries
    } catch { /* fall through to the default */ }
    return [{ subject: 'Chemistry' }]
  })
  const [hours, setHours] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null')
      if (saved?.hours?.length === 7) return saved.hours
    } catch { /* fall through */ }
    return [3, 1.5, 1.5, 1.5, 1.5, 1, 3]
  })
  const [startHour, setStartHour] = useState(16)
  const [series, setSeries] = useState<string>(() => {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null')?.series || 'Jun 2026' } catch { return 'Jun 2026' }
  })
  const [tuning, setTuning] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify({ entries, hours, series }))
  }, [entries, hours, series])

  const body = useMemo(
    // Exam dates come from Pearson's published timetable for the chosen series,
    // never from the student, so any old manually-entered date is dropped here.
    () => ({
      subjects: entries.map((e) => ({ subject: e.subject, units: e.units })),
      hours,
      startDate: today(),
      series,
    }),
    [entries, hours, series],
  )
  const { data: view, error } = useApi<RoutineView>('/api/routine', body, 250)

  const weeks = useMemo(() => groupByWeek(view?.days || []), [view])

  if (error) return <Card className="p-5 text-rose-400">Could not build the routine. Try again.</Card>
  if (!view) return <p className="text-muted py-16 text-center">Loading…</p>

  const update = (i: number, patch: Partial<Entry>) =>
    setEntries((e) => e.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-7"
      >
        <h1 className="font-display text-3xl sm:text-[2.75rem] font-bold tracking-tight leading-[1.1] max-w-2xl">
          A routine built around{' '}
          <span className="bg-gradient-to-r from-[#FCD34D] via-[#FBBF24] to-[#F59E0B] bg-clip-text text-transparent">
            the units you dread
          </span>
        </h1>
        <p className="text-muted mt-3 max-w-xl leading-relaxed">
          Your subjects, your exam dates, the hours you actually have. It gives the most time to
          whatever you rate hardest, spaces each unit out instead of cramming it, and turns the last
          fifth into revision and timed papers. No account, nothing saved anywhere but this browser.
        </p>
      </motion.section>

      <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-5 items-start">
        <div className="space-y-5 lg:sticky lg:top-24">
          <Card className="p-5 space-y-4">
            <h2 className="font-display text-lg font-semibold tracking-tight">Subjects</h2>

            <Field label="Exam series" hint="Exam dates fill in from Pearson's timetable.">
              <Select value={series} onChange={(e) => setSeries(e.target.value)}>
                {['Jun 2026', 'Oct 2026', 'Jan 2027', 'Jun 2027', 'Jun 2026 IGCSE', 'Nov 2026 IGCSE', 'Jun 2027 IGCSE']
                  .map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>

            {entries.map((entry, i) => (
              <div key={i} className="rounded-2xl border border-line/70 bg-black/20 p-3 space-y-2.5">
                <div className="flex gap-2">
                  <Select
                    value={entry.subject}
                    onChange={(e) => update(i, { subject: e.target.value, units: undefined })}
                    className="h-10"
                  >
                    {view.subjects.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                  {entries.length > 1 && (
                    <button
                      onClick={() => setEntries((e) => e.filter((_, j) => j !== i))}
                      className="shrink-0 h-10 w-10 grid place-items-center rounded-xl border border-line text-muted hover:text-rose-400 transition-colors"
                      aria-label={`Remove ${entry.subject}`}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <Field label="Exam date" hint="From Pearson's published timetable">
                  <div className="h-10 w-full rounded-xl bg-black/25 border border-line px-3 flex items-center text-sm">
                    {autoDate(view, entry.subject)
                      ? <span className="text-ink">{formatExamDate(autoDate(view, entry.subject)!)}</span>
                      : <span className="text-muted">Not sat in this series</span>}
                  </div>
                </Field>

                <button
                  onClick={() => setTuning(tuning === entry.subject ? null : entry.subject)}
                  className="text-xs font-semibold text-muted hover:text-ink transition-colors"
                >
                  {tuning === entry.subject ? 'Hide' : 'Rate'} the units
                </button>

                {tuning === entry.subject && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] text-muted leading-relaxed">
                      Harder units get more of your time. Defaults come from what students generally
                      find hardest.
                    </p>
                    {(view.units[entry.subject] || []).map((u) => (
                      <div key={u.code} className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-muted w-14 shrink-0">{u.code}</span>
                        <span className="text-[11px] min-w-0 flex-1 truncate" title={u.title}>{u.title}</span>
                        <Select
                          value={entry.units?.[u.code] ?? u.effort}
                          onChange={(e) =>
                            update(i, { units: { ...entry.units, [u.code]: Number(e.target.value) } })}
                          className="h-7 w-16 shrink-0 text-[11px] px-1.5"
                        >
                          {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                        </Select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {entries.length < 6 && (
              <button
                onClick={() => setEntries((e) => [...e, { subject: pickNext(view.subjects, e) }])}
                className="w-full h-10 rounded-xl border border-dashed border-line text-sm font-semibold text-muted hover:text-ink hover:border-line/60 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Plus size={15} /> Add a subject
              </button>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold tracking-tight mb-1">Hours a day</h2>
            <p className="text-sm text-muted mb-3">Be honest, not aspirational.</p>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEK.map((d, i) => (
                <div key={d}>
                  <div className="text-[10px] text-muted text-center mb-1">{d}</div>
                  <NumInput
                    value={hours[i]}
                    min={0}
                    max={12}
                    step={0.5}
                    onChange={(e) =>
                      setHours((h) => h.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                    className="h-9 px-1 text-center text-xs"
                    aria-label={`Hours on ${d}`}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5 min-w-0">
          {view.warnings.map((w) => (
            <div key={w} className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[.07] p-4">
              <AlertTriangle size={17} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-sm leading-relaxed">{w}</p>
            </div>
          ))}

          <Card className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">Total study time</div>
                <div className="font-display text-4xl font-bold leading-none mt-1">
                  {Math.round(view.totalMinutes / 60)}
                  <span className="text-lg text-muted font-normal"> hours</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  className="h-10 w-28"
                  aria-label="Study start time"
                >
                  {[8, 10, 12, 14, 15, 16, 17, 18, 19, 20].map((h) => (
                    <option key={h} value={h}>{`Start ${clock12(h)}`}</option>
                  ))}
                </Select>
                <button
                  onClick={() => downloadIcs(view, startHour)}
                  disabled={!view.days.length}
                  className="h-10 px-4 rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-black text-sm font-bold inline-flex items-center gap-2 disabled:opacity-40 hover:brightness-110 transition-all"
                >
                  <CalendarPlus size={16} /> Add to calendar
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {view.perSubject.map((s) => (
                <div key={s.subject}>
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="font-semibold">{s.subject}</span>
                    <span className="text-muted tabular-nums">
                      {Math.round(s.minutes / 60)}h · exam {s.examDate}
                    </span>
                  </div>
                  <Meter value={s.minutes} max={view.totalMinutes || 1} tone="amber" className="h-1.5" />
                </div>
              ))}
            </div>
          </Card>

          {weeks.map((week, wi) => (
            <Card key={week[0].date} className="p-4 sm:p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted mb-3">
                Week {wi + 1} · {week[0].date} to {week[week.length - 1].date}
              </div>
              <div className="grid sm:grid-cols-7 gap-1.5">
                {week.map((day) => (
                  <div
                    key={day.date}
                    className={
                      'rounded-xl border p-2 min-h-[92px] ' +
                      (day.exams.length
                        ? 'border-rose-400/40 bg-rose-400/[.08]'
                        : day.sessions.length
                          ? 'border-line/70 bg-black/20'
                          : 'border-line/40 bg-black/10')
                    }
                  >
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-muted">{day.weekday.slice(0, 3)}</span>
                      <span className="text-[10px] text-muted/70 tabular-nums">{day.date.slice(8)}</span>
                    </div>

                    {day.exams.map((e) => (
                      <div key={e} className="text-[10px] font-bold text-rose-300 leading-tight mb-1 break-words">
                        {e} exam
                      </div>
                    ))}

                    {blockTimes(day.sessions, startHour).map(({ s, at }, i) => (
                      <div key={i} className="mb-1 last:mb-0">
                        <div className={'text-[10px] font-mono leading-tight ' + TONES[KIND[s.kind].tone].text}>
                          {s.code}
                        </div>
                        <div className="text-[9px] text-muted leading-tight">
                          {at} · {KIND[s.kind].label}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {!!view.perUnit.length && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold tracking-tight mb-3">Time per unit</h2>
              <div className="space-y-1.5">
                {view.perUnit.map((u) => (
                  <div key={u.subject + u.code} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-muted w-14 shrink-0">{u.code}</span>
                    <span className="min-w-0 flex-1 truncate" title={`${u.subject}: ${u.title}`}>{u.title}</span>
                    <span className="text-muted/70 shrink-0">effort {u.effort}</span>
                    <span className="tabular-nums font-semibold w-12 text-right shrink-0">
                      {(u.minutes / 60).toFixed(1)}h
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function groupByWeek(days: RoutineView['days']) {
  const out: RoutineView['days'][] = []
  for (const day of days) {
    if (!out.length || out[out.length - 1].length === 7 || day.weekday === 'Sunday') out.push([])
    out[out.length - 1].push(day)
  }
  return out
}

/** Clock time of each block, matching what the calendar export writes. */
function blockTimes(sessions: RoutineView['days'][number]['sessions'], startHour: number) {
  let cursor = startHour * 60
  return sessions.map((s) => {
    const at = clock12(Math.floor(cursor / 60) % 24, cursor % 60)
    cursor += s.minutes + 15
    return { s, at }
  })
}

function autoDate(view: RoutineView, subject: string) {
  return view.perSubject.find((s) => s.subject === subject)?.examDate
}

/** Pearson's date (YYYY-MM-DD) shown as e.g. "Fri 22 Jan 2027". */
function formatExamDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function pickNext(all: string[], chosen: Entry[]) {
  const taken = new Set(chosen.map((c) => c.subject))
  return all.find((s) => !taken.has(s)) || all[0]
}
