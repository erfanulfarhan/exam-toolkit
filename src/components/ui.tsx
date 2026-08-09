import * as React from 'react'
import { motion } from 'motion/react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative rounded-3xl border border-line/80 bg-card/50 backdrop-blur-xl',
        'shadow-[0_1px_0_0_rgba(255,255,255,.04)_inset,0_24px_60px_-30px_rgba(0,0,0,.9)]',
        className,
      )}
      {...p}
    />
  )
}

export function SectionTitle({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
      <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

const btn = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        solid: 'bg-brand text-white hover:brightness-110',
        soft: 'bg-white/[.06] text-ink hover:bg-white/[.1] border border-line',
        ghost: 'text-muted hover:text-ink hover:bg-white/[.05]',
      },
      size: { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-sm', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'soft', size: 'md' },
  },
)
export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof btn> {}
export function Button({ className, variant, size, ...p }: BtnProps) {
  return <button className={cn(btn({ variant, size, className }))} {...p} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted/80">{hint}</span>}
    </label>
  )
}

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-xl bg-black/25 border border-line px-3 text-sm text-ink',
        'outline-none transition-colors hover:border-line/60 focus:border-brand cursor-pointer',
        className,
      )}
      {...p}
    />
  )
}

export function NumInput({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={cn(
        'h-11 w-full rounded-xl bg-black/25 border border-line px-3 text-sm tabular-nums text-ink',
        'outline-none transition-colors hover:border-line/60 focus:border-brand',
        className,
      )}
      {...p}
    />
  )
}

/** Accent hues sections are tinted with, so each part of the page has its own. */
export const TONES = {
  brand: { text: 'text-sky-400', grad: 'from-sky-400 to-blue-500', soft: 'bg-sky-400/10 border-sky-400/25 text-sky-300' },
  violet: { text: 'text-violet-300', grad: 'from-violet-400 to-fuchsia-500', soft: 'bg-violet-400/10 border-violet-400/25 text-violet-200' },
  teal: { text: 'text-teal-300', grad: 'from-teal-300 to-emerald-500', soft: 'bg-teal-400/10 border-teal-400/25 text-teal-200' },
  amber: { text: 'text-amber-300', grad: 'from-amber-300 to-orange-500', soft: 'bg-amber-400/10 border-amber-400/25 text-amber-200' },
  rose: { text: 'text-rose-400', grad: 'from-rose-400 to-fuchsia-500', soft: 'bg-rose-400/10 border-rose-400/25 text-rose-200' },
  emerald: { text: 'text-emerald-400', grad: 'from-emerald-400 to-teal-400', soft: 'bg-emerald-400/10 border-emerald-400/25 text-emerald-200' },
} as const
export type Tone = keyof typeof TONES

/** Sliding-pill segmented control. `id` must be unique per control on the page. */
export function Segmented<T extends string>({
  id, value, options, onChange, className, tone = 'brand',
}: {
  id: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  className?: string
  tone?: Tone
}) {
  return (
    <div className={cn('inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-black/30 border border-line', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className="relative px-4 h-10 rounded-xl text-sm font-semibold transition-colors"
        >
          {value === o.value && (
            <motion.span
              layoutId={id}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className={cn('absolute inset-0 rounded-xl bg-gradient-to-br', TONES[tone].grad)}
            />
          )}
          <span className={cn('relative z-10', value === o.value ? 'text-white' : 'text-muted hover:text-ink')}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export function Chip({ className, children, ...p }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-line bg-white/[.04] px-1.5 py-0.5',
        'text-[11px] font-semibold leading-tight',
        className,
      )}
      {...p}
    >
      {children}
    </span>
  )
}

export function Meter({
  value, max, className, tone = 'brand',
}: { value: number; max: number; className?: string; tone?: Tone }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={cn('h-2 rounded-full bg-black/40 overflow-hidden', className)}>
      <motion.div
        className={cn('h-full rounded-full bg-gradient-to-r', TONES[tone].grad)}
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
      />
    </div>
  )
}
