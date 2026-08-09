import { useState } from 'react'
import { motion } from 'motion/react'
import { AlertTriangle, Check, ChevronDown, Target } from 'lucide-react'
import { Card, Chip, Meter, Segmented, Select, TONES } from '@/components/ui'
import { EFFORT_LABELS, IalView } from '@/lib/types'

export function Planner({
  view, onTarget, onEffort,
}: {
  view: IalView
  onTarget: (grade: string) => void
  onEffort: (code: string, value: number) => void
}) {
  const [tuning, setTuning] = useState(false)
  const plan = view.plan
  const ladder = view.ladder.map((g) => g.grade)

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Target size={17} className="text-amber-300" />
        <h2 className="font-display text-lg font-semibold tracking-tight">Retake planner</h2>
      </div>
      <p className="text-sm text-muted mb-4">
        The cheapest way to your target grade: the easiest papers, at the lowest marks that work.
      </p>

      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <span className="text-sm text-muted">I want at least</span>
        <Segmented
          id="plan-target"
          tone="amber"
          value={view.target}
          onChange={onTarget}
          options={ladder.map((g) => ({ value: g, label: g }))}
        />
      </div>

      {!plan && (
        <p className="text-sm text-muted rounded-2xl border border-line/70 bg-black/20 px-4 py-3">
          Enter at least one mark above and your plan appears here.
        </p>
      )}

      {plan?.status === 'secured' && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[.07] p-4">
          <Check size={18} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">
            <b className="text-emerald-400">Already secured.</b> Your {plan.currentTotal} UMS clears {plan.target} with{' '}
            {plan.currentTotal - plan.needOverall} to spare, so there is nothing to re-sit.
          </p>
        </div>
      )}

      {plan?.status === 'impossible' && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/[.07] p-4">
          <AlertTriangle size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">
            <b className="text-rose-400">Out of reach.</b> Full marks on everything left still tops out at{' '}
            {plan.projectedTotal} UMS, {plan.shortfall} short of the {plan.needOverall} that {plan.target} needs.
            Try {ladder[ladder.indexOf(plan.target) + 1] ?? 'a lower grade'} instead.
          </p>
        </div>
      )}

      {plan?.status === 'planned' && (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed">
            You are on <b className="tabular-nums">{plan.currentTotal}</b> UMS and {plan.target} needs{' '}
            <b className="tabular-nums">{plan.needOverall}</b>.{' '}
            {plan.retakeCount > 0
              ? `Re-sit ${plan.retakeCount} paper${plan.retakeCount > 1 ? 's' : ''} at these marks and you land on ${plan.landsOn}.`
              : `Hit these marks and you land on ${plan.landsOn}.`}
          </p>

          {plan.steps.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              className="rounded-2xl border border-line/70 bg-black/20 px-3.5 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug break-words">{s.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Chip className="font-mono text-muted">{s.code}</Chip>
                    <Chip className={s.retake ? TONES.amber.soft : TONES.teal.soft}>
                      {s.retake ? 'Re-sit' : 'First sitting'}
                    </Chip>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {s.rawNeeded > 0 ? (
                    <>
                      <div className="text-lg font-semibold tabular-nums leading-none">
                        {s.rawNeeded}
                        <span className="text-muted text-sm font-normal">/{s.rawMax}</span>
                      </div>
                      <div className="text-xs text-muted tabular-nums mt-0.5">{s.pct}% for {s.toUms} UMS</div>
                    </>
                  ) : (
                    <div className="text-sm text-muted">any mark works</div>
                  )}
                </div>
              </div>
              <Meter value={s.rawNeeded} max={s.rawMax} tone="amber" className="mt-2.5 h-1.5" />
            </motion.div>
          ))}

          <div className="pt-1">
            <button
              onClick={() => setTuning((t) => !t)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink transition-colors"
            >
              <ChevronDown size={14} className={'transition-transform ' + (tuning ? 'rotate-180' : '')} />
              Which papers do you find hardest?
            </button>
            {tuning && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted leading-relaxed">
                  The plan leans on the papers you find easiest. Adjust these and it re-solves.
                </p>
                {view.units.filter((u) => u.taking).map((u) => (
                  <div key={u.code} className="flex items-center justify-between gap-3">
                    <span className="text-xs min-w-0 break-words">
                      <span className="font-mono text-muted mr-2">{u.code}</span>
                      {u.title}
                    </span>
                    <Select
                      value={u.effort}
                      onChange={(e) => onEffort(u.code, Number(e.target.value))}
                      className="h-8 w-32 shrink-0 text-xs"
                    >
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>{EFFORT_LABELS[v]}</option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-muted/80 leading-relaxed">
            Boundaries move a few marks each session, so treat these as a floor, not an exact target.
          </p>
        </div>
      )}
    </Card>
  )
}
