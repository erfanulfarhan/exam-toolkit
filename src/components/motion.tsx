import { ReactNode, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * The site's motion vocabulary.
 *
 * This subject is about thresholds. A mark is an A or it is a B; a GPA clears
 * a university's bar or it does not. So the one piece of motion that carries
 * meaning is a number arriving at its value and settling there, and everything
 * else stays deliberately quiet around it.
 *
 * Every component here drops to a static render when the reader has asked for
 * reduced motion, rather than merely shortening the animation.
 */

const EASE = [0.22, 1, 0.36, 1] as const

/** Rises into place the first time it is scrolled to, once, then stays put. */
export function Reveal({
  children, delay = 0, className,
}: { children: ReactNode; delay?: number; className?: string }) {
  const still = useReducedMotion()
  if (still) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** A group whose children arrive one after another rather than all at once. */
export function Stagger({
  children, className, gap = 0.06,
}: { children: ReactNode; className?: string; gap?: number }) {
  const still = useReducedMotion()
  if (still) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="rest"
      whileInView="shown"
      viewport={{ once: true, margin: '-40px' }}
      variants={{ shown: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const still = useReducedMotion()
  if (still) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={{
        rest: { opacity: 0, y: 18 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * A number that travels to its value and settles.
 *
 * It animates on every change, not only on first paint, which is the point:
 * editing a grade sends the GPA moving and it comes to rest somewhere new, so
 * you feel the effect of the change rather than reading a figure that silently
 * swapped itself out.
 */
export function CountUp({
  value, decimals = 0, className, duration = 520,
}: { value: number; decimals?: number; className?: string; duration?: number }) {
  const still = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    if (still) { from.current = value; setShown(value); return }
    const start = from.current
    const target = value
    from.current = value
    if (start === target) return
    let frame = 0
    const began = performance.now()
    const settle = (t: number) => 1 - (1 - t) ** 3
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / duration)
      setShown(start + (target - start) * settle(t))
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, still, duration])

  return <span className={className}>{shown.toFixed(decimals)}</span>
}
