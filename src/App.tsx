import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowUpRight, Layers } from 'lucide-react'
import { Segmented } from '@/components/ui'
import { IalCalculator } from '@/components/IalCalculator'
import { IgcseCalculator } from '@/components/IgcseCalculator'

type Qual = 'IAL' | 'IGCSE'

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
}

export default function App() {
  const [qual, setQual] = useState<Qual>('IAL')

  return (
    <div className="min-h-[100svh] flex flex-col">
      <div className="mesh" />
      <div className="grain" />

      <header className="sticky top-0 z-30 border-b border-line/50 bg-bg/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-teal-300 via-sky-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20">
              <Layers size={17} />
            </span>
            <span className="font-display font-bold text-[15px] sm:text-base tracking-tight">
              Edexcel Grade Calculator
            </span>
          </div>
          <a
            href="https://qualifications.pearson.com/en/support/support-topics/results-certification/grade-boundaries.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs sm:text-sm text-muted hover:text-ink transition-colors"
          >
            Pearson boundaries <ArrowUpRight size={14} />
          </a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.section {...fade} className="mb-7">
          <h1 className="font-display text-3xl sm:text-[2.75rem] font-bold tracking-tight leading-[1.1] max-w-2xl">
            Work out your grade, then{' '}
            <span className="bg-gradient-to-r from-teal-300 via-sky-400 via-violet-400 to-amber-300 bg-clip-text text-transparent">
              plan your retakes
            </span>
          </h1>
          <p className="text-muted mt-3 max-w-xl leading-relaxed">
            Type in the UMS from your results slip. See your grade against Pearson's real boundaries, the raw
            mark behind it, where boundaries are heading next series, and the easiest papers to re-sit.
          </p>
        </motion.section>

        <div className="mb-6">
          <Segmented<Qual>
            id="qual-switch"
            value={qual}
            onChange={setQual}
            options={[
              { value: 'IAL', label: 'International A Level' },
              { value: 'IGCSE', label: 'International GCSE' },
            ]}
          />
        </div>

        {/* One plain child keyed by tab. AnimatePresence with mode="wait" was
            holding the outgoing panel and never mounting the incoming one. */}
        <motion.div key={qual} {...fade}>
          {qual === 'IAL' ? <IalCalculator /> : <IgcseCalculator />}
        </motion.div>
      </main>

      <footer className="border-t border-line/50 mt-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 text-xs text-muted space-y-2">
          <p>
            Built from Pearson's published grade boundary documents, covering every International A Level
            and International GCSE session including the October and November series.
          </p>
          <p>
            Unofficial, so check anything that matters against your statement of results. Difficulty
            ratings are student opinion, not official.
          </p>
        </div>
      </footer>
    </div>
  )
}
