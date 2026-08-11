import { useState } from 'react'
import { motion } from 'motion/react'
import { Segmented } from '@/components/ui'
import { IalCalculator } from '@/components/IalCalculator'
import { IgcseCalculator } from '@/components/IgcseCalculator'

type Qual = 'IAL' | 'IGCSE'

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
}

export function CalculatorPage() {
  const [qual, setQual] = useState<Qual>('IAL')

  return (
    <>
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
    </>
  )
}
