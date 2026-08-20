import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/**
 * The site's signature: a raw mark finding its grade.
 *
 * Everything here turns on a threshold. 61 out of 80 is an A and 60 is a B,
 * and the whole anxiety of results day lives in that one mark. So the hero
 * shows the thing itself: a scale carrying the real Physics WPH12 January 2025
 * boundaries, with a mark that travels and settles on a grade.
 *
 * The numbers are genuine, from the same published boundaries the calculator
 * runs on.
 */

const BOUNDARIES = [
  { grade: 'A*', mark: 70, tone: '#6EE7B7' },
  { grade: 'A', mark: 61, tone: '#5EEAD4' },
  { grade: 'B', mark: 53, tone: '#60A5FA' },
  { grade: 'C', mark: 45, tone: '#A78BFA' },
  { grade: 'D', mark: 38, tone: '#FCD34D' },
  { grade: 'E', mark: 31, tone: '#FB7185' },
]
const MAX = 80
const MARKS = [58, 64, 72, 49]
const HEIGHT = 260

export function BoundaryLadder() {
  const still = useReducedMotion()
  const [i, setI] = useState(0)
  const mark = MARKS[i]

  useEffect(() => {
    if (still) return
    const t = setInterval(() => setI((n) => (n + 1) % MARKS.length), 3400)
    return () => clearInterval(t)
  }, [still])

  const hit = BOUNDARIES.find((b) => mark >= b.mark)
  const grade = hit?.grade ?? 'U'
  const tone = hit?.tone ?? '#94a3b8'
  const y = (m: number) => (m / MAX) * HEIGHT

  return (
    <div className="w-[268px] shrink-0" aria-hidden="true">
      <div className="flex gap-2.5">
        {/* the mark, riding alongside the scale */}
        <div className="relative w-11 shrink-0" style={{ height: HEIGHT }}>
          <motion.div
            className="absolute right-0 -translate-y-1/2"
            initial={false}
            animate={{ bottom: y(mark) }}
            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          >
            <span className="font-display font-bold text-[26px] leading-none tabular-nums" style={{ color: tone }}>
              {mark}
            </span>
          </motion.div>
        </div>

        {/* the scale, with every boundary drawn on it */}
        <div
          className="relative flex-1 rounded-2xl border border-line/70 bg-black/25 overflow-hidden"
          style={{ height: HEIGHT }}
        >
          <motion.div
            className="absolute inset-x-0 bottom-0"
            initial={false}
            animate={{ height: y(mark) }}
            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
            style={{ background: `linear-gradient(to top, ${tone}18, ${tone}4d)` }}
          />
          {BOUNDARIES.map((b) => (
            <div key={b.grade} className="absolute inset-x-0 flex items-center gap-1.5 px-2" style={{ bottom: y(b.mark) }}>
              <div className="h-px flex-1" style={{ background: `${b.tone}66` }} />
              <span className="font-display text-[10px] font-bold leading-none" style={{ color: b.tone }}>
                {b.grade}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 pl-[54px] text-[11px] text-muted">
        out of {MAX} is a{' '}
        <motion.span
          key={grade}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="font-display font-bold text-base align-middle"
          style={{ color: tone }}
        >
          {grade}
        </motion.span>
        <span className="block mt-0.5 text-muted/60">Physics WPH12, January 2025</span>
      </p>
    </div>
  )
}
