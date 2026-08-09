import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { GraduationCap, Calculator as CalcIcon, Target, AlertTriangle, Github } from 'lucide-react'
import { Card, Button, Field, Select, NumInput } from '@/components/ui'
import {
  IalData, IgcseData, ialSubjects, ialCashins, ialUnitsFor, ialSessionsForUnit,
  ialUnitInSession, rawToUms, unitGrade, unitGradeOrder, overallGrade, umsToRaw,
  igcseSubjects, igcseSessionsFor, igcseGrade, GRADE_COLORS,
} from '@/lib/engine'
import { getDifficulty } from '@/lib/difficulty'

type Qual = 'IAL' | 'IGCSE'

export default function App() {
  const [ial, setIal] = useState<IalData | null>(null)
  const [igcse, setIgcse] = useState<IgcseData | null>(null)
  const [qual, setQual] = useState<Qual>('IAL')
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/data/ial.json').then((r) => r.json()),
      fetch('/data/igcse.json').then((r) => r.json()),
    ]).then(([a, g]) => { setIal(a); setIgcse(g) }).catch(() => setErr('Could not load grade data.'))
  }, [])

  return (
    <div className="min-h-[100svh] flex flex-col">
      <header className="border-b border-line/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-display font-bold text-lg">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-brand via-brand-3 to-brand-2 text-white">
              <GraduationCap size={18} />
            </span>
            Edexcel Grade Calc
          </div>
          <a href="https://qualifications.pearson.com/en/support/support-topics/results-certification/grade-boundaries.html"
            target="_blank" rel="noopener" className="text-xs text-muted hover:text-ink">official boundaries ↗</a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Raw marks → UMS → your grade</h1>
          <p className="text-muted mt-1 text-sm sm:text-base">Every Pearson Edexcel IAL &amp; International GCSE subject, per exam session — plus a planner for the easiest route to your target grade.</p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-card border border-line mb-6">
          {(['IAL', 'IGCSE'] as Qual[]).map((q) => (
            <button key={q} onClick={() => setQual(q)}
              className={'px-4 h-10 rounded-lg text-sm font-semibold transition-colors ' +
                (qual === q ? 'bg-brand text-white' : 'text-muted hover:text-ink')}>
              {q === 'IAL' ? 'International A Level' : 'International GCSE'}
            </button>
          ))}
        </div>

        {err && <Card className="p-4 text-bad">{err}</Card>}
        {!err && qual === 'IAL' && ial && <IalCalculator data={ial} />}
        {!err && qual === 'IGCSE' && igcse && <IgcseCalculator data={igcse} />}
        {!err && ((qual === 'IAL' && !ial) || (qual === 'IGCSE' && !igcse)) &&
          <div className="text-muted">Loading grade data…</div>}
      </main>

      <footer className="border-t border-line/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 text-xs text-muted flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>Built by Erfanul Hakim Farhan. Data from Pearson's public grade-boundary documents.</span>
          <span>UMS via piecewise-linear interpolation between published boundaries. Unofficial — verify with Pearson.</span>
        </div>
      </footer>
    </div>
  )
}

/* ============================== IAL ============================== */
function IalCalculator({ data }: { data: IalData }) {
  const subjects = useMemo(() => ialSubjects(data), [data])
  const [subject, setSubject] = useState(subjects.includes('Chemistry') ? 'Chemistry' : subjects[0])
  const [level, setLevel] = useState<'A Level' | 'AS'>('A Level')

  const allUnits = useMemo(() => ialUnitsFor(data, subject), [data, subject])
  const units = useMemo(
    () => (level === 'AS' ? allUnits.filter((u) => u.type === 'AS') : allUnits),
    [allUnits, level]
  )
  const cashins = useMemo(() => ialCashins(data, subject), [data, subject])
  const cashin = useMemo(
    () => cashins.find((c) => (level === 'AS' ? /AS/i.test(c.title) : /A Level/i.test(c.title))) || cashins[cashins.length - 1],
    [cashins, level]
  )

  // rows: code -> { session, raw }
  const [rows, setRows] = useState<Record<string, { session: string; raw: string }>>({})
  useEffect(() => {
    const next: Record<string, { session: string; raw: string }> = {}
    for (const u of units) {
      const ss = ialSessionsForUnit(data, subject, u.code)
      next[u.code] = { session: ss[ss.length - 1] || '', raw: '' }
    }
    setRows(next)
  }, [subject, level, data]) // eslint-disable-line

  const computed = units.map((u) => {
    const row = rows[u.code] || { session: '', raw: '' }
    const unitInSession = ialUnitInSession(data, subject, row.session, u.code) || u
    const hasRaw = row.raw !== '' && !isNaN(+row.raw)
    const ums = hasRaw ? rawToUms(unitInSession, +row.raw) : null
    return { u, unitInSession, row, hasRaw, ums, grade: ums != null ? unitGrade(unitInSession, ums) : null }
  })

  const totalUms = computed.reduce((s, c) => s + (c.ums || 0), 0)
  const maxUms = cashin ? cashin.ums_max : computed.reduce((s, c) => s + c.unitInSession.ums_max, 0)
  const overall = cashin ? overallGrade(cashin, totalUms) : '—'

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <div className="space-y-5">
        <Card className="p-4 sm:p-5">
          <div className="grid sm:grid-cols-[1fr_auto] gap-4">
            <Field label="Subject">
              <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjects.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Qualification">
              <div className="inline-flex p-1 rounded-xl bg-bg/60 border border-line h-11">
                {(['A Level', 'AS'] as const).map((l) => (
                  <button key={l} onClick={() => setLevel(l)}
                    className={'px-4 rounded-lg text-sm font-semibold ' + (level === l ? 'bg-brand text-white' : 'text-muted')}>
                    {l}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        <Card className="p-2 sm:p-3">
          <div className="hidden sm:grid grid-cols-[1fr_130px_90px_84px] gap-2 px-3 py-2 text-xs uppercase tracking-wide text-muted">
            <span>Unit</span><span>Session</span><span>Raw mark</span><span className="text-right">UMS</span>
          </div>
          <div className="divide-y divide-line/60">
            {computed.map(({ u, unitInSession, row, ums, grade }) => {
              const sessions = ialSessionsForUnit(data, subject, u.code)
              const diff = getDifficulty(u.code)
              return (
                <div key={u.code} className="grid sm:grid-cols-[1fr_130px_90px_84px] gap-2 items-center px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <span className="text-muted font-mono text-xs">{u.code}</span>
                      <span className="truncate">{u.title.replace(/^Unit\s*\d+[A-Z]?:\s*/, '')}</span>
                      {diff && diff.score >= 4 && (
                        <span title={diff.note} className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-bad/90 bg-bad/10 border border-bad/20 rounded px-1.5 py-0.5">
                          <AlertTriangle size={10} /> hard
                        </span>
                      )}
                    </div>
                  </div>
                  <Select value={row.session} onChange={(e) => setRows((r) => ({ ...r, [u.code]: { ...r[u.code], session: e.target.value } }))} className="h-10">
                    {sessions.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                  <NumInput placeholder={`/${unitInSession.raw_max}`} min={0} max={unitInSession.raw_max}
                    value={row.raw} onChange={(e) => setRows((r) => ({ ...r, [u.code]: { ...r[u.code], raw: e.target.value } }))}
                    className="h-10" />
                  <div className="text-right tabular-nums">
                    {ums != null ? (
                      <span><b>{ums}</b><span className="text-muted">/{unitInSession.ums_max}</span>{' '}
                        <span className={'font-semibold ' + (GRADE_COLORS[grade!] || '')}>{grade}</span></span>
                    ) : <span className="text-muted/50">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Planner units={computed} cashin={cashin} totalUms={totalUms} />
      </div>

      {/* result rail */}
      <div className="lg:sticky lg:top-6 self-start">
        <Card className="p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted">{subject} · {level}</div>
          <motion.div key={overall} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={'font-display font-bold text-6xl my-2 ' + (GRADE_COLORS[overall] || 'text-ink')}>{overall}</motion.div>
          <div className="tabular-nums text-sm text-muted">{totalUms} <span className="opacity-60">/ {maxUms}</span> UMS</div>
          <div className="mt-3 h-2 rounded-full bg-bg/70 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${Math.min(100, (totalUms / maxUms) * 100)}%` }} />
          </div>
          {cashin && (
            <div className="mt-4 text-left text-xs space-y-1">
              {['A*', 'A', 'B', 'C', 'D', 'E'].filter((g) => cashin.ums[g] != null).map((g) => (
                <div key={g} className="flex justify-between">
                  <span className={GRADE_COLORS[g]}>{g}</span>
                  <span className="tabular-nums text-muted">{cashin.ums[g]} UMS</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ---------- pass planner ---------- */
function Planner({ units, cashin, totalUms }: { units: any[]; cashin: any; totalUms: number }) {
  const [target, setTarget] = useState('A')
  if (!cashin) return null
  const grades = ['A*', 'A', 'B', 'C', 'D', 'E'].filter((g) => cashin.ums[g] != null)
  const need = cashin.ums[target]
  const done = units.filter((c) => c.hasRaw)
  const remaining = units.filter((c) => !c.hasRaw)
  const lockedUms = done.reduce((s, c) => s + c.ums, 0)
  const gap = Math.max(0, need - lockedUms)
  const capacity = remaining.reduce((s, c) => s + c.unitInSession.ums_max, 0)
  const feasible = gap <= capacity

  // difficulty-aware allocation: push more of the needed UMS onto easier units
  const weights = remaining.map((c) => {
    const d = getDifficulty(c.u.code)
    const easiness = d ? Math.max(1, 6 - d.score) : 3.5
    return c.unitInSession.ums_max * easiness
  })
  const wSum = weights.reduce((a, b) => a + b, 0) || 1
  const alloc = remaining.map((c, i) => Math.min(c.unitInSession.ums_max, Math.round((gap * weights[i]) / wSum)))

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Target size={16} className="text-brand-2" />
        <h2 className="font-display font-semibold">Pass planner</h2>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm text-muted">I want at least</span>
        <Select value={target} onChange={(e) => setTarget(e.target.value)} className="h-10 w-24">
          {grades.map((g) => <option key={g}>{g}</option>)}
        </Select>
        <span className="text-sm text-muted">= <b className="text-ink tabular-nums">{need}</b> UMS overall</span>
      </div>

      {totalUms > 0 && (
        <p className="text-sm mb-3">
          You have <b className="tabular-nums">{lockedUms}</b> UMS locked in.{' '}
          {gap === 0 ? <span className="text-good font-semibold">Target already secured! 🎉</span>
            : <>You need <b className="tabular-nums">{gap}</b> more from your remaining {remaining.length} unit{remaining.length !== 1 ? 's' : ''}.</>}
        </p>
      )}

      {gap > 0 && !feasible && (
        <p className="text-sm text-bad flex items-center gap-2"><AlertTriangle size={14} /> Not reachable — even full marks on the remaining units ({capacity} UMS) fall short of the {gap} needed.</p>
      )}

      {gap > 0 && feasible && remaining.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted">Suggested spread — leaning the load onto the easier units so you don't have to ace the brutal ones:</p>
          {remaining.map((c, i) => {
            const d = getDifficulty(c.u.code)
            const needRaw = umsToRaw(c.unitInSession, alloc[i])
            const pct = Math.round((needRaw / c.unitInSession.raw_max) * 100)
            return (
              <div key={c.u.code} className="flex items-center justify-between gap-3 text-sm rounded-lg bg-bg/50 border border-line px-3 py-2">
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs text-muted mr-2">{c.u.code}</span>
                  {c.u.title.replace(/^Unit\s*\d+[A-Z]?:\s*/, '')}
                  {d && d.score >= 4 && <span className="ml-2 text-[10px] text-warn">↓ go easy here</span>}
                </span>
                <span className="shrink-0 tabular-nums">
                  <b>{needRaw}</b><span className="text-muted">/{c.unitInSession.raw_max}</span>
                  <span className="text-muted"> ({pct}% · {alloc[i]} UMS)</span>
                </span>
              </div>
            )
          })}
          <p className="text-[11px] text-muted/80 pt-1">Difficulty ratings are community sentiment (r/6thForm, The Student Room), not official.</p>
        </div>
      )}
    </Card>
  )
}

/* ============================== IGCSE ============================== */
function IgcseCalculator({ data }: { data: IgcseData }) {
  const subjects = useMemo(() => igcseSubjects(data), [data])
  const [subject, setSubject] = useState(subjects.includes('Chemistry') ? 'Chemistry' : subjects[0])
  const sessions = useMemo(() => igcseSessionsFor(data, subject), [data, subject])
  const [session, setSession] = useState(sessions[sessions.length - 1])
  useEffect(() => { setSession((s) => (sessions.includes(s) ? s : sessions[sessions.length - 1])) }, [sessions])

  const variants = data.sessions[session]?.[subject]?.variants || []
  const [vi, setVi] = useState(0)
  useEffect(() => { setVi(0) }, [subject, session])
  const variant = variants[vi] || variants[0]
  const [raw, setRaw] = useState('')

  const hasRaw = raw !== '' && !isNaN(+raw) && variant
  const grade = hasRaw ? igcseGrade(variant, Math.max(0, Math.min(variant.max, +raw))) : null

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <Card className="p-4 sm:p-5 space-y-4 self-start">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Subject">
            <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {subjects.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Session">
            <Select value={session} onChange={(e) => setSession(e.target.value)}>
              {sessions.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Papers">
            <Select value={vi} onChange={(e) => setVi(+e.target.value)}>
              {variants.map((v, i) => <option key={i} value={i}>{v.papers || `Variant ${i + 1}`}</option>)}
            </Select>
          </Field>
        </div>
        {variant && (
          <Field label={`Total raw mark (out of ${variant.max})`}>
            <NumInput placeholder={`0 – ${variant.max}`} min={0} max={variant.max} value={raw} onChange={(e) => setRaw(e.target.value)} />
          </Field>
        )}
        {variant && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted mb-2">Grade boundaries ({session})</div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 text-center">
              {['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U'].filter((g) => variant.boundaries[g] != null).map((g) => {
                const active = grade === g
                return (
                  <div key={g} className={'rounded-lg border px-1 py-1.5 ' + (active ? 'border-brand bg-brand/15' : 'border-line bg-bg/40')}>
                    <div className={'text-sm font-bold ' + (GRADE_COLORS[g] || '')}>{g}</div>
                    <div className="text-[11px] text-muted tabular-nums">{variant.boundaries[g]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      <div className="lg:sticky lg:top-6 self-start">
        <Card className="p-5 text-center">
          <div className="text-xs uppercase tracking-wide text-muted">{subject}</div>
          <motion.div key={String(grade)} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={'font-display font-bold text-6xl my-2 ' + (grade ? GRADE_COLORS[grade] || 'text-ink' : 'text-muted/40')}>
            {grade || '—'}
          </motion.div>
          {variant && <div className="text-sm text-muted tabular-nums">{hasRaw ? Math.max(0, Math.min(variant.max, +raw)) : 0} / {variant.max} raw</div>}
        </Card>
      </div>
    </div>
  )
}
