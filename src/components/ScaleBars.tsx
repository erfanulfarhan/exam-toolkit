import { motion, useReducedMotion } from 'motion/react'
import { ScaleResult } from '@/lib/gpa'
import { CountUp } from '@/components/motion'

/**
 * The same grades, read by each university in turn.
 *
 * Cards put every scale in its own box, which quietly suggests they are
 * separate answers. They are not: they are one set of grades seen through
 * different rules, and the useful thing is the comparison. So each scale is a
 * track on a common axis, and where a university publishes a bar to clear, the
 * bar is drawn on the track and the fill either reaches it or does not.
 *
 * It is the hero's boundary ladder again, turned on its side, which is
 * deliberate: thresholds are the one idea this whole site is about.
 */

const TRACK = { standard: 5, brac: 5, iba: 5, combined: 10, bup: 35 } as const

export function ScaleBars({ scales }: { scales: ScaleResult[] }) {
  const still = useReducedMotion()

  return (
    <div className="space-y-5">
      {scales.map((s, i) => {
        const max = TRACK[s.key as keyof typeof TRACK] ?? 5
        const single = s.combined != null
        const value = single ? s.combined! : Math.max(s.o, s.a)
        const clears = s.threshold != null ? value >= s.threshold : null

        return (
          <div key={s.key}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="text-xs tabular-nums">
                {single ? (
                  <>
                    <span className={clears ? 'text-[#6EE7B7] font-bold' : 'text-muted font-bold'}>
                      <CountUp value={s.combined!} decimals={2} />
                    </span>
                    {s.threshold != null && (
                      <span className="text-muted"> of {s.threshold.toFixed(2)} needed</span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[#5EEAD4] font-bold"><CountUp value={s.o} decimals={2} /></span>
                    <span className="text-muted"> O Level · </span>
                    <span className="text-[#C4B5FD] font-bold"><CountUp value={s.a} decimals={2} /></span>
                    <span className="text-muted"> A Level</span>
                  </>
                )}
              </span>
            </div>

            {/* the track */}
            <div className="relative h-2.5 rounded-full bg-black/40 overflow-hidden">
              {single ? (
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: clears
                      ? 'linear-gradient(90deg,#5EEAD4,#6EE7B7)'
                      : 'linear-gradient(90deg,#60A5FA,#A78BFA)',
                  }}
                  initial={still ? false : { width: 0 }}
                  animate={{ width: `${Math.min(100, (value / max) * 100)}%` }}
                  transition={{ duration: 0.7, delay: still ? 0 : 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                />
              ) : (
                <>
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#5EEAD4] to-[#0D9488]"
                    initial={still ? false : { width: 0 }}
                    animate={{ width: `${(s.o / max) * 100}%` }}
                    transition={{ duration: 0.7, delay: still ? 0 : 0.05 * i, ease: [0.22, 1, 0.36, 1] }}
                  />
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#A78BFA]/70 to-[#7C3AED]/70 h-1"
                    style={{ top: 'auto', bottom: 0 }}
                    initial={still ? false : { width: 0 }}
                    animate={{ width: `${(s.a / max) * 100}%` }}
                    transition={{ duration: 0.7, delay: still ? 0 : 0.05 * i + 0.08, ease: [0.22, 1, 0.36, 1] }}
                  />
                </>
              )}

              {/* the bar to clear */}
              {s.threshold != null && (
                <div
                  className="absolute inset-y-0 w-px bg-white/50"
                  style={{ left: `${Math.min(100, (s.threshold / max) * 100)}%` }}
                />
              )}
            </div>

            <p className="text-[11px] text-muted/90 mt-1.5 leading-relaxed">{s.note}</p>
          </div>
        )
      })}
    </div>
  )
}
