import { useEffect, useMemo, useState } from 'react'
import { Card, Field, Meter, NumInput, Select } from '@/components/ui'
import { useApi } from '@/lib/api'
import { GRADE_COLORS, IalView } from '@/lib/types'

/**
 * Mark the whole paper.
 *
 * The raw total goes through the same boundary engine the calculator uses, so
 * the grade comes from the real boundaries for the session picked, not an
 * estimate. Per-question marks entered while working are summed as the starting
 * total, and can be overridden.
 */
type Preset = { subject?: string; code?: string; session?: string; year?: number }

const SEASON_WORDS: Record<string, string[]> = {
  January: ['jan'], 'May/June': ['jun', 'may'], 'October/November': ['nov', 'oct'],
}

/**
 * The boundary data splits one subject across spec variants the library name
 * doesn't distinguish — "Physics" carries the current units (WPH11-16), while
 * "Physics (New) (up to Jan 2021)" carries the previous ones (WPH01-06). So the
 * candidates for a name are the exact match and any "<name> (…)" variants, plus
 * a loose prefix match as a last resort.
 */
function candidateSubjects(subjects: string[], want: string): string[] {
  const w = want.trim().toLowerCase()
  const out: string[] = []
  const exact = subjects.find((s) => s.toLowerCase() === w)
  if (exact) out.push(exact)
  for (const s of subjects) if (s.toLowerCase().startsWith(w + ' (') && !out.includes(s)) out.push(s)
  if (!out.length) { const pre = subjects.find((s) => s.toLowerCase().startsWith(w)); if (pre) out.push(pre) }
  return out
}

/**
 * Which variant of a subject a unit code belongs to. Edexcel IAL numbers the
 * current spec <letters>1x (WPH11) and the previous one <letters>0x (WPH01), so
 * the code alone picks the plain name or its "(New)" counterpart. A legacy
 * numeric code (6PH01) or an unknown shape just takes the first candidate —
 * there's no boundary data for it anyway.
 */
function subjectForCode(subjects: string[], want: string, code?: string): string | undefined {
  const cands = candidateSubjects(subjects, want)
  if (!cands.length || !code) return cands[0]
  const c = code.toUpperCase()
  if (/^[A-Z]{2,4}1\d[A-Z]?$/.test(c)) return cands.find((s) => !/\(new\)/i.test(s)) ?? cands[0]
  if (/^[A-Z]{2,4}0\d[A-Z]?$/.test(c)) return cands.find((s) => /\(new\)/i.test(s)) ?? cands[0]
  return cands[0]
}

/** What the boundary engine made of the marks, for the practice log. */
export type MarkResult = { rawMax?: number; grade?: string; ums?: number; umsMax?: number }

export function MarkPaper({
  suggested, preset, onResult,
}: {
  suggested: number
  preset?: Preset
  onResult?: (result: MarkResult) => void
}) {
  const [subject, setSubject] = useState<string | undefined>()
  const [session, setSession] = useState<string | undefined>()
  const [code, setCode] = useState<string | undefined>()
  const [raw, setRaw] = useState('')

  useEffect(() => {
    if (suggested > 0 && raw === '') setRaw(String(suggested))
  }, [suggested]) // eslint-disable-line react-hooks/exhaustive-deps

  // The opened paper still waiting to be applied. Cleared once it's resolved (or
  // shown to have no boundary data). Leaving the marks blank is the whole point.
  const [pending, setPending] = useState<Preset | undefined>()
  useEffect(() => {
    setPending(preset)
  }, [preset?.subject, preset?.code, preset?.session, preset?.year])

  const body = useMemo(
    () => ({
      subject,
      session,
      mode: 'raw',
      rows: code ? { [code]: { value: raw, session } } : {},
    }),
    [subject, session, code, raw],
  )
  const { data: view } = useApi<IalView>('/api/ial', body, 200)

  const unit = view?.units.find((u) => u.code === (code ?? view.units[0]?.code))
  useEffect(() => {
    if (view && !code && view.units[0]) setCode(view.units[0].code)
  }, [view, code])

  // Resolve the paper against the boundary data one step at a time as it loads:
  // the right spec variant of the subject (chosen by the unit code), then the
  // unit, then the session. Each step sets one field and waits for the reload it
  // triggers, so the async subject → units → sessions chain settles in order.
  useEffect(() => {
    if (!view || !pending) return

    // 1) The spec variant of the subject that actually carries this unit code.
    const wantSubj = pending.subject
      ? subjectForCode(view.subjects, pending.subject, pending.code)
      : undefined
    if (wantSubj && wantSubj !== view.subject) { setSubject(wantSubj); setCode(undefined); return }

    // 2) The unit, by code, within that subject.
    const u = pending.code
      ? view.units.find((x) => x.code.toLowerCase() === pending.code!.toLowerCase())
      : undefined
    if (u && u.code !== code) { setCode(u.code); return }

    // 3) The session, by year and season, within that unit (or the subject).
    if (pending.year) {
      const words = SEASON_WORDS[pending.session ?? ''] ?? []
      const chosen = view.units.find((x) => x.code === (code ?? u?.code))
      const list = chosen?.sessions ?? view.sessions
      const hit = list.find((x) => x.includes(String(pending.year)) && words.some((w) => x.toLowerCase().includes(w)))
      if (hit && hit !== session) { setSession(hit); return }
    }

    // On the right subject with nothing left to apply (a legacy or pre-2014
    // paper the data doesn't carry just stops here on its defaults).
    setPending(undefined)
  }, [view, pending, code, session])

  // Hand the graded result up so the practice log can store a real percentage
  // and grade rather than a bare mark.
  useEffect(() => {
    if (!onResult || !unit) return
    onResult({ rawMax: unit.rawMax, grade: unit.grade, ums: unit.ums ?? undefined, umsMax: unit.umsMax })
  }, [onResult, unit?.rawMax, unit?.grade, unit?.ums, unit?.umsMax])

  if (!view) return null

  return (
    <Card className="p-5 mt-4">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-1">Mark the paper</h2>
      <p className="text-sm text-muted mb-4">
        Your total raw mark against the real boundaries for that session.
      </p>

      <div className="grid sm:grid-cols-4 gap-3">
        <Field label="Subject">
          <Select value={view.subject} onChange={(e) => { setSubject(e.target.value); setCode(undefined) }} className="h-10">
            {view.subjects.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Unit">
          <Select value={unit?.code ?? ''} onChange={(e) => setCode(e.target.value)} className="h-10">
            {view.units.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}
          </Select>
        </Field>
        <Field label="Session">
          <Select value={session ?? unit?.session ?? view.session} onChange={(e) => setSession(e.target.value)} className="h-10">
            {(unit?.sessions ?? view.sessions).slice().reverse().map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label={`Raw total / ${unit?.rawMax ?? '?'}`}>
          <NumInput
            value={raw}
            min={0}
            max={unit?.rawMax}
            onChange={(e) => setRaw(e.target.value)}
            className="h-10"
            placeholder="marks"
          />
        </Field>
      </div>

      {unit && unit.ums != null && (
        <div className="mt-4 pt-4 border-t border-line/60 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">Grade</div>
            <div className={'font-display font-bold text-4xl leading-none mt-1 ' + (GRADE_COLORS[unit.grade!] || '')}>
              {unit.grade}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">UMS</div>
            <div className="font-display font-bold text-2xl leading-none mt-1 tabular-nums">
              {unit.ums}<span className="text-muted text-base font-normal">/{unit.umsMax}</span>
            </div>
          </div>
          <div className="min-w-[180px] flex-1">
            <Meter value={unit.ums} max={unit.umsMax} tone="teal" />
            <p className="text-xs text-muted mt-2 leading-relaxed">
              {unit.title}. Put this UMS into the{' '}
              <a href="/calculator" className="text-[#82C8E5] font-semibold hover:text-teal-200">calculator</a>{' '}
              with your other units for the overall grade.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
