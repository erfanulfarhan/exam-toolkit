import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Card, Field, Meter, NumInput, Select } from '@/components/ui'
import { IgcseForecast } from '@/components/BoundaryForecast'
import { useApi } from '@/lib/api'
import { GRADE_COLORS, IgcseView } from '@/lib/types'

export function IgcseCalculator() {
  const [subject, setSubject] = useState<string | undefined>()
  const [session, setSession] = useState<string | undefined>()
  const [variantIndex, setVariantIndex] = useState<number | undefined>()
  const [raw, setRaw] = useState('')

  const body = useMemo(
    () => ({ subject, session, variantIndex, raw }),
    [subject, session, variantIndex, raw],
  )
  const { data: view, error } = useApi<IgcseView>('/api/igcse', body)

  if (error) {
    return <Card className="p-5 text-rose-400">Could not reach the calculator. Check your connection and retry.</Card>
  }
  if (!view) return <p className="text-muted py-16 text-center">Loading grade boundaries...</p>

  const hasVariant = view.variants.length > 0 && view.max > 0

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <div className="space-y-5 min-w-0">
        <Card className="p-5 space-y-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Subject">
              <Select
                value={view.subject}
                onChange={(e) => { setSubject(e.target.value); setSession(undefined); setVariantIndex(undefined) }}
              >
                {view.subjects.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Exam session">
              <Select
                value={view.session}
                onChange={(e) => { setSession(e.target.value); setVariantIndex(undefined) }}
              >
                {[...view.sessions].reverse().map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Papers or tier">
              <Select value={view.variantIndex} onChange={(e) => setVariantIndex(Number(e.target.value))}>
                {view.variants.map((v, i) => <option key={i} value={i}>{v.label}</option>)}
              </Select>
            </Field>
          </div>

          {hasVariant ? (
            <>
              <Field label={`Total raw mark across all papers, out of ${view.max}`}>
                <NumInput
                  placeholder={`0 to ${view.max}`}
                  min={0}
                  max={view.max}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                />
              </Field>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted mb-2.5">
                  Grade boundaries for {view.session}
                </div>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${view.grades.length > 10 ? '3rem' : '3.6rem'}, 1fr))` }}
                >
                  {view.grades.map((g) => {
                    const active = view.grade === g
                    return (
                      <div
                        key={g}
                        className={
                          'rounded-xl border px-1 py-2 text-center transition-colors ' +
                          (active ? 'border-violet-400/60 bg-violet-400/15' : 'border-line bg-black/25')
                        }
                      >
                        <div className={'text-sm font-bold leading-none ' + (GRADE_COLORS[g] || 'text-ink')}>{g}</div>
                        <div className="text-[11px] text-muted tabular-nums mt-1">{view.boundaries[g]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted text-sm py-4">
              Pearson published no boundaries for {view.subject} in {view.session}. Pick another session.
            </p>
          )}
        </Card>

        {hasVariant && <IgcseForecast subject={view.subject} papers={view.papers} />}
      </div>

      <div className="lg:sticky lg:top-24">
        <Card className="p-6 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted break-words">
            {view.subject}
          </div>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={String(view.grade)}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className={
                'font-display font-bold my-3 leading-none ' +
                ((view.grade?.length ?? 0) > 2 ? 'text-5xl' : 'text-7xl') + ' ' +
                (view.grade ? GRADE_COLORS[view.grade] || 'text-ink' : 'text-muted/25')
              }
            >
              {view.grade || '?'}
            </motion.div>
          </AnimatePresence>
          {hasVariant && (
            <>
              <div className="text-sm text-muted tabular-nums">
                <b className="text-ink">{view.mark ?? 0}</b> / {view.max} raw
              </div>
              <Meter value={view.mark ?? 0} max={view.max} tone="emerald" className="mt-3" />
              {view.papers && <div className="text-xs text-muted mt-3">Papers {view.papers}</div>}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
