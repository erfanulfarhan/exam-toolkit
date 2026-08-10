import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Card, Chip, Field, Meter, NumInput, Segmented, Select, TONES } from '@/components/ui'
import { Planner } from '@/components/Planner'
import { IalForecast } from '@/components/BoundaryForecast'
import { useApi } from '@/lib/api'
import { GRADE_COLORS, IalUnitView, IalView } from '@/lib/types'

type Level = 'A Level' | 'AS'
type Mode = 'ums' | 'raw'

export function IalCalculator() {
  const [subject, setSubject] = useState<string | undefined>()
  const [level, setLevel] = useState<Level>('A Level')
  const [session, setSession] = useState<string | undefined>()
  const [mode, setMode] = useState<Mode>('ums')
  const [target, setTarget] = useState<string | undefined>()
  const [rows, setRows] = useState<Record<string, { session?: string; variant?: string; value?: string }>>({})
  const [taking, setTaking] = useState<Record<string, boolean>>({})
  const [effort, setEffort] = useState<Record<string, number>>({})

  const body = useMemo(
    () => ({ subject, level, session, mode, target, rows, taking, effort }),
    [subject, level, session, mode, target, rows, taking, effort],
  )
  const { data: view, error } = useApi<IalView>('/api/ial', body)

  /** Subject and level changes invalidate everything keyed by unit code. */
  const reset = (apply: () => void) => {
    apply()
    setRows({})
    setTaking({})
    setEffort({})
    setTarget(undefined)
  }

  if (error) {
    return <Card className="p-5 text-rose-400">Could not reach the calculator. Check your connection and retry.</Card>
  }
  if (!view) return <p className="text-muted py-16 text-center">Loading grade boundaries...</p>

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        <Card className="p-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Subject">
              <Select value={subject ?? view.subject} onChange={(e) => reset(() => setSubject(e.target.value))}>
                {view.subjects.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Exam session">
              <Select value={session ?? view.session} onChange={(e) => { setSession(e.target.value); setRows({}) }}>
                {view.sessions.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Segmented<Level>
              id="ial-level"
              tone="violet"
              value={level}
              onChange={(v) => reset(() => setLevel(v))}
              options={[{ value: 'A Level', label: 'Full A Level' }, { value: 'AS', label: 'AS only' }]}
            />
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">Your marks</h2>
            <p className="text-sm text-muted">
              {mode === 'ums'
                ? 'Type the UMS from your results slip. Leave blank if you have not sat it.'
                : 'Type the raw mark from your paper. Leave blank if you have not sat it.'}
            </p>
          </div>

          <div className="mb-4">
            <Segmented<Mode>
              id="mark-mode"
              tone="teal"
              value={mode}
              onChange={(v) => { setMode(v); setRows({}) }}
              options={[{ value: 'ums', label: 'I have UMS' }, { value: 'raw', label: 'I have raw marks' }]}
            />
          </div>

          <div className="space-y-2.5">
            {view.units.map((u) => (
              <UnitRow
                key={u.code}
                unit={u}
                mode={mode}
                value={rows[u.code]?.value ?? ''}
                session={rows[u.code]?.session}
                variant={rows[u.code]?.variant}
                taking={taking[u.code]}
                showTaking={view.hasOptional}
                onTaking={(v) => setTaking((t) => ({ ...t, [u.code]: v }))}
                onChange={(patch) =>
                  setRows((r) => {
                    const next = { ...r[u.code], ...patch }
                    // A different session may not carry the same paper variant.
                    if (patch.session) delete next.variant
                    return { ...r, [u.code]: next }
                  })
                }
              />
            ))}
            {!view.units.length && (
              <p className="text-muted text-sm py-6 text-center">No units published for this combination.</p>
            )}
          </div>

          {mode === 'ums' && (
            <p className="text-xs text-muted/80 leading-relaxed mt-3">
              The raw mark shown is the lowest one that gives that UMS in the session you picked, so it is
              your mark give or take a point.
            </p>
          )}
        </Card>

        <IalForecast subject={view.subject} />

        {view.ladder.length > 0 && (
          <Planner
            view={view}
            target={target}
            effort={effort}
            onTarget={setTarget}
            onEffort={(code, v) => setEffort((e) => ({ ...e, [code]: v }))}
          />
        )}
      </div>

      <div className="lg:sticky lg:top-24">
        <Card className="p-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted break-words">
            {subject ?? view.subject} · {level === 'AS' ? 'International AS' : 'International A Level'}
          </div>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={view.overall || 'none'}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className={
                'font-display font-bold text-7xl my-3 leading-none ' +
                (view.anyMarks ? GRADE_COLORS[view.overall] || 'text-ink' : 'text-muted/25')
              }
            >
              {view.anyMarks ? view.overall : '?'}
            </motion.div>
          </AnimatePresence>
          <div className="tabular-nums text-sm text-muted">
            <b className="text-ink">{view.totalUms}</b> / {view.maxUms} UMS
          </div>
          <Meter value={view.totalUms} max={view.maxUms} tone="emerald" className="mt-3" />

          {view.ladder.length > 0 && (
            <div className="mt-5 pt-4 border-t border-line/70 text-left space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted mb-2">
                What each grade needs
              </div>
              {view.ladder.map((g) => (
                <div key={g.grade} className="flex items-baseline justify-between gap-2 text-xs">
                  <span className={'font-semibold shrink-0 ' + (GRADE_COLORS[g.grade] || '')}>{g.grade}</span>
                  <span className="tabular-nums text-muted flex items-baseline gap-1.5 text-right">
                    {g.need} UMS{g.extra && <span className="text-muted/70">{g.extra}</span>}
                    {g.reached && <Check size={12} className="text-emerald-400 self-center" />}
                  </span>
                </div>
              ))}
            </div>
          )}

          {view.rule && (
            <div className="mt-4 pt-4 border-t border-line/70 text-left">
              <div className="flex items-baseline justify-between gap-2 text-xs mb-1.5">
                <span className="font-semibold">A* also needs</span>
                <span className="tabular-nums text-muted">{view.rule.have} of {view.rule.need}</span>
              </div>
              <Meter value={view.rule.have} max={view.rule.need} tone="violet" />
              <p className="text-[11px] text-muted/85 leading-relaxed mt-2">{view.rule.note}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function UnitRow({
  unit, mode, value, session, variant, taking, showTaking, onTaking, onChange,
}: {
  unit: IalUnitView
  mode: Mode
  value: string
  session?: string
  variant?: string
  taking?: boolean
  showTaking: boolean
  onTaking: (v: boolean) => void
  onChange: (patch: { session?: string; variant?: string; value?: string }) => void
}) {
  // Prefer what the user just picked over what the last reply said, so the
  // control never snaps back while the request is in flight.
  const shownSession = session ?? unit.session
  const shownVariant = variant ?? unit.variant
  const isTaking = taking ?? unit.taking
  return (
    <div
      className={
        'rounded-2xl border px-3.5 py-3 transition-all ' +
        (isTaking ? 'border-line/70 bg-black/20' : 'border-line/40 bg-black/10 opacity-55')
      }
    >
      <div className="grid sm:grid-cols-[minmax(0,1fr)_7rem_5.5rem] gap-x-4 gap-y-2 items-center">
        <div className="flex items-start gap-2.5 min-w-0">
          {showTaking && (
            <input
              type="checkbox"
              checked={isTaking}
              onChange={(e) => onTaking(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-line bg-black/40 accent-violet-500 cursor-pointer shrink-0"
              aria-label={`Taking ${unit.code}`}
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug break-words" title={unit.note || undefined}>
              {unit.title}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Chip className="font-mono text-muted">{unit.code}</Chip>
              <Chip className={unit.type === 'A2' ? TONES.violet.soft : TONES.teal.soft}>{unit.type}</Chip>
            </div>
          </div>
        </div>

        <NumInput
          placeholder={`/ ${unit.cap}`}
          min={0}
          max={unit.cap}
          value={value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="h-10"
          aria-label={`${mode === 'ums' ? 'UMS' : 'Raw mark'} for ${unit.code} out of ${unit.cap}`}
        />

        <div className="text-right tabular-nums">
          {unit.ums != null ? (
            <>
              <div className="text-base font-semibold leading-none">
                {mode === 'ums' ? `${unit.raw}/${unit.rawMax}` : `${unit.ums}`}
                <span className="text-muted text-xs font-normal">{mode === 'ums' ? ' raw' : ' UMS'}</span>
              </div>
              <div className={'text-sm font-bold mt-0.5 ' + (GRADE_COLORS[unit.grade!] || '')}>{unit.grade}</div>
            </>
          ) : (
            <span className="text-muted/40 text-xs">not sat</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-line/50">
        <Field label="Session sat">
          <Select value={shownSession} onChange={(e) => onChange({ session: e.target.value })} className="h-9 text-xs">
            {[...unit.sessions].reverse().map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        {unit.variants.length > 1 && (
          <Field label="Paper version">
            <Select value={shownVariant} onChange={(e) => onChange({ variant: e.target.value })} className="h-9 text-xs">
              {unit.variants.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
            </Select>
          </Field>
        )}
      </div>
    </div>
  )
}
