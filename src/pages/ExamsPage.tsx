import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, CalendarPlus, Check, Printer } from 'lucide-react'
import { Card, Field, Select, TONES } from '@/components/ui'
import { useApi } from '@/lib/api'
import { duration, prettyDate } from '@/lib/format'
import { ExamsView } from '@/lib/types'
import { PrintRoutine } from '@/components/PrintRoutine'

const STORE = 'exams.v1'

export function ExamsPage() {
  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(STORE) || 'null') } catch { return null }
  }, [])
  const [series, setSeries] = useState<string | undefined>(saved?.series)
  const [subjects, setSubjects] = useState<string[]>(saved?.subjects || [])

  const body = useMemo(() => ({ series, subjects }), [series, subjects])
  const { data: view, error } = useApi<ExamsView>('/api/exams', body, 150)

  const toggle = (subject: string) => {
    const next = subjects.includes(subject)
      ? subjects.filter((s) => s !== subject)
      : [...subjects, subject]
    setSubjects(next)
    localStorage.setItem(STORE, JSON.stringify({ series: view?.series, subjects: next }))
  }

  if (error) return <Card className="p-5 text-rose-400">Could not load the timetable. Try again.</Card>
  if (!view) return <p className="text-muted py-16 text-center">Loading…</p>

  const byDate = groupByDate(view.exams)

  return (
    <>
      <PrintRoutine view={view} />

      <div className="no-print">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-7"
      >
        <h1 className="font-display text-3xl sm:text-[2.75rem] font-bold tracking-tight leading-[1.1] max-w-2xl">
          Your exam timetable,{' '}
          <span className="bg-gradient-to-r from-rose-400 to-fuchsia-500 bg-clip-text text-transparent">
            just yours
          </span>
        </h1>
        <p className="text-muted mt-3 max-w-xl leading-relaxed">
          Tick your subjects and get only your papers, in order, with dates, sessions, durations and a
          countdown. Straight from Pearson's published examination timetable, clashes flagged.
        </p>
      </motion.section>

      <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-5 items-start">
        <div className="space-y-5 lg:sticky lg:top-24">
          <Card className="p-5 space-y-4">
            <Field label="Exam series">
              <Select
                value={view.series}
                onChange={(e) => { setSeries(e.target.value); setSubjects([]) }}
              >
                {view.seriesList.map((s) => (
                  <option key={s.label} value={s.label}>{s.label}</option>
                ))}
              </Select>
            </Field>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted mb-2">
                Your subjects
              </div>
              <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                {view.subjects.map((s) => {
                  const on = subjects.includes(s)
                  return (
                    <button
                      key={s}
                      onClick={() => toggle(s)}
                      className={
                        'w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors flex items-center gap-2.5 ' +
                        (on
                          ? 'border-rose-400/40 bg-rose-400/[.1] text-ink'
                          : 'border-line/60 bg-black/20 text-muted hover:text-ink hover:border-line')
                      }
                    >
                      <span
                        className={
                          'grid place-items-center h-4 w-4 rounded shrink-0 border ' +
                          (on ? 'bg-rose-400 border-rose-400 text-black' : 'border-line')
                        }
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 break-words">{s}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5 min-w-0">
          {!subjects.length && (
            <Card className="p-8 text-center">
              <p className="text-muted">Tick a subject to build your timetable.</p>
            </Card>
          )}

          {!!view.clashes.length && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/[.08] p-4">
              <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="text-sm leading-relaxed">
                <b className="text-rose-300">Clash.</b>{' '}
                {view.clashes.map((c) => `${c.codes.join(' and ')} both sit ${c.session.toLowerCase()} on ${prettyDate(c.date)}`).join('; ')}.
                Your exams officer has to arrange this, so tell them early.
              </div>
            </div>
          )}

          {!!subjects.length && (
            <Card className="p-5">
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => window.print()}
                  className="h-9 px-3.5 rounded-xl border border-line text-sm font-semibold text-muted hover:text-ink hover:border-line/60 transition-colors inline-flex items-center gap-1.5"
                >
                  <Printer size={14} /> Print routine
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Papers" value={String(view.summary.papers)} />
                <Stat label="Time in exams" value={duration(view.summary.minutes)} />
                <Stat
                  label="First paper"
                  value={view.summary.daysToFirst != null
                    ? (view.summary.daysToFirst > 0 ? `in ${view.summary.daysToFirst} days` : 'today')
                    : 'done'}
                  accent
                />
                <Stat label="Runs over" value={view.summary.span ? `${view.summary.span} days` : '—'} />
              </div>
            </Card>
          )}

          {byDate.map(([date, exams], i) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.28 }}
            >
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                  <span className="font-display font-semibold">{prettyDate(date)}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {exams[0].daysAway < 0
                      ? 'sat'
                      : exams[0].daysAway === 0
                        ? 'today'
                        : `in ${exams[0].daysAway} days`}
                  </span>
                </div>

                <div className="space-y-2">
                  {exams.map((e) => (
                    <div
                      key={e.code + e.paper}
                      className={
                        'rounded-xl border px-3 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ' +
                        (e.clash ? 'border-rose-400/40 bg-rose-400/[.07]' : 'border-line/60 bg-black/20')
                      }
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-muted">{e.code}/{e.paper}</span>
                          <span
                            className={
                              'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ' +
                              (e.session === 'Morning' ? TONES.amber.soft : TONES.violet.soft)
                            }
                          >
                            {e.session}
                          </span>
                          <span className="text-[11px] text-muted">{duration(e.minutes)}</span>
                        </div>
                        <p className="text-sm font-medium leading-snug break-words mt-1">
                          {e.subject}
                          <span className="text-muted font-normal"> · {e.title}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}

          {!!subjects.length && (
            <p className="text-xs text-muted/80 leading-relaxed flex items-start gap-2">
              <CalendarPlus size={13} className="shrink-0 mt-0.5" />
              <span>
                Pearson publishes a session rather than a clock time, because start times differ by
                timezone. Your centre confirms the exact time, and international start times are on
                Pearson's site.
              </span>
            </p>
          )}
        </div>
      </div>
      </div>
    </>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">{label}</div>
      <div className={'font-display font-bold text-xl leading-tight mt-0.5 ' + (accent ? 'text-rose-400' : '')}>
        {value}
      </div>
    </div>
  )
}

function groupByDate(exams: ExamsView['exams']) {
  const map = new Map<string, ExamsView['exams']>()
  for (const e of exams) map.set(e.date, [...(map.get(e.date) || []), e])
  return [...map.entries()]
}
