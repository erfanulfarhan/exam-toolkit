import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { LineChart, Trash2, TrendingUp } from 'lucide-react'
import { Card, Meter, TONES } from '@/components/ui'
import { Link } from '@/lib/router'
import { GRADE_COLORS } from '@/lib/types'
import { LogEntry, clearLog, loadLog, percentOf, removeEntry, trend, unitAverages } from '@/lib/log'
import { CountUp, Reveal } from '@/components/motion'

const SHORT: Record<string, string> = {
  January: 'Jan', 'May/June': 'May/June', 'October/November': 'Oct/Nov',
}
const sitting = (e: LogEntry) => (e.year ? `${SHORT[e.session] ?? e.session} ${e.year}` : '')

/**
 * Every paper you have marked, and what it says about where you stand.
 *
 * Entries are written by the practice page as you score questions, so this page
 * only reads. Papers whose unit the boundary data doesn't cover still appear,
 * but they carry no percentage, so they are left out of the averages rather
 * than quietly distorting them.
 */
export function LogPage() {
  const [entries, setEntries] = useState<LogEntry[]>([])

  useEffect(() => {
    const read = () => setEntries(loadLog())
    read()
    // 'practice-log' fires in this tab, 'storage' in the others.
    window.addEventListener('practice-log', read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener('practice-log', read)
      window.removeEventListener('storage', read)
    }
  }, [])

  const scored = useMemo(() => trend(entries), [entries])
  const weak = useMemo(() => unitAverages(entries), [entries])
  const average = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.percent, 0) / scored.length)
    : null
  const totalMarks = entries.reduce((s, e) => s + e.marks, 0)

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <h1 className="font-display text-3xl sm:text-[2.5rem] font-bold tracking-tight leading-[1.1]">
          Your practice{' '}
          <span className="bg-gradient-to-r from-[#67E8F9] via-[#22D3EE] to-[#0891B2] bg-clip-text text-transparent">
            log
          </span>
        </h1>
        <p className="text-muted mt-3 max-w-xl leading-relaxed">
          Every paper you have marked, how your scores are moving, and the units worth
          another go. Filled in as you mark, kept on this device only.
        </p>
      </motion.section>

      {entries.length === 0 ? (
        <Card className="p-5 sm:p-8 text-center">
          <span className={'grid place-items-center h-12 w-12 rounded-2xl bg-gradient-to-br text-white mx-auto mb-4 ' + TONES.teal.grad}>
            <LineChart size={20} />
          </span>
          <p className="font-display font-semibold">Nothing logged yet</p>
          <p className="text-sm text-muted mt-2 max-w-sm mx-auto leading-relaxed">
            Open a past paper, mark a few questions, and it will show up here on its own.
          </p>
          <Link
            to="/practice"
            className="inline-block mt-5 h-10 px-4 leading-10 rounded-xl bg-gradient-to-br from-[#0047AB] to-[#000080] text-white text-sm font-bold hover:brightness-110 transition-all"
          >
            Start practising
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <Stat label="Papers marked" value={String(entries.length)} tone="teal" />
            <Stat label="Average score" value={average == null ? '—' : `${average}%`} tone="violet" />
            <Stat label="Marks scored" value={String(totalMarks)} tone="amber" />
          </div>

          {scored.length >= 2 && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
                <TrendingUp size={17} className="text-[#82C8E5]" /> How you are moving
              </h2>
              <p className="text-sm text-muted mt-1">
                Oldest to newest, for papers whose total is known.
              </p>
              <div className="mt-5 flex items-end gap-1.5 h-40">
                {scored.slice(-16).map(({ entry, percent }, i) => (
                  <div key={entry.key} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 group">
                    <span className="text-[10px] font-semibold tabular-nums text-muted group-hover:text-ink transition-colors">
                      {percent}
                    </span>
                    <motion.div
                      className="w-full rounded-t-md bg-gradient-to-t from-[#0047AB]/70 to-[#82C8E5] min-h-[3px] origin-bottom"
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.55, delay: 0.03 * i, ease: [0.22, 1, 0.36, 1] }}
                      style={{ height: `${Math.max(3, percent)}%` }}
                      title={`${entry.subject} ${entry.unit} · ${sitting(entry)} · ${percent}%`}
                    />
                    <span className="text-[9px] text-muted/70 truncate w-full text-center">
                      {entry.unit}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {weak.length > 0 && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold tracking-tight">Worth another paper</h2>
              <p className="text-sm text-muted mt-1">Your weakest units first, by average score.</p>
              <div className="mt-4 space-y-3">
                {weak.slice(0, 6).map((u) => (
                  <div key={u.label}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-sm font-semibold truncate">{u.label}</span>
                      <span className="text-xs text-muted shrink-0 tabular-nums">
                        {u.average}% · {u.papers} paper{u.papers === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Meter value={u.average} max={100} tone={u.average < 50 ? 'rose' : u.average < 70 ? 'amber' : 'teal'} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-display text-lg font-semibold tracking-tight">Every paper</h2>
              <button
                onClick={() => { if (confirm('Clear the whole practice log?')) clearLog() }}
                className="text-xs font-semibold text-muted hover:text-rose-400 transition-colors"
              >
                Clear log
              </button>
            </div>
            <div className="space-y-1.5">
              {entries.map((e) => {
                const pct = percentOf(e)
                return (
                  <div
                    key={e.key}
                    className="flex items-center gap-3 rounded-xl border border-line/60 bg-black/20 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {e.subject} {e.unit}
                      </div>
                      <div className="text-[11px] text-muted truncate">
                        {e.level} · {sitting(e)} · {e.attempted}/{e.questions} questions
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold tabular-nums">
                        {e.marks}{e.rawMax ? <span className="text-muted font-normal">/{e.rawMax}</span> : null}
                      </div>
                      {pct != null && <div className="text-[11px] text-muted tabular-nums">{pct}%</div>}
                    </div>
                    {e.grade && (
                      <div className={'font-display font-bold text-xl w-8 text-center shrink-0 ' + (GRADE_COLORS[e.grade] || '')}>
                        {e.grade}
                      </div>
                    )}
                    <button
                      onClick={() => removeEntry(e.key)}
                      className="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-muted hover:text-rose-400 transition-colors"
                      aria-label={`Remove ${e.subject} ${e.unit}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'teal' | 'violet' | 'amber' }) {
  // Percentages carry their sign; plain counts do not.
  const numeric = Number(value.replace('%', ''))
  const suffix = value.endsWith('%') ? '%' : ''
  return (
    <Card className="p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">{label}</div>
      <div className={'font-display font-bold text-3xl leading-none mt-2 tabular-nums ' + TONES[tone].text}>
        {Number.isFinite(numeric) ? <><CountUp value={numeric} />{suffix}</> : value}
      </div>
    </Card>
  )
}
