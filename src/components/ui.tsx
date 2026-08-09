import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-line bg-card/70 backdrop-blur-sm', className)} {...p} />
}

const btn = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 select-none',
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
  }
)
export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof btn> {}
export function Button({ className, variant, size, ...p }: BtnProps) {
  return <button className={cn(btn({ variant, size, className }))} {...p} />
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  )
}

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn('h-11 rounded-xl bg-bg/60 border border-line px-3 text-sm text-ink outline-none focus:border-brand cursor-pointer', className)}
      {...p}
    />
  )
}

export function NumInput({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={cn('h-11 w-full rounded-xl bg-bg/60 border border-line px-3 text-sm text-ink outline-none focus:border-brand', className)}
      {...p}
    />
  )
}
