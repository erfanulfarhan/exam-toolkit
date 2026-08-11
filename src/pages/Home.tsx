import { motion } from 'motion/react'
import { ArrowRight, CalendarRange, Calculator, FileText } from 'lucide-react'
import { Card, TONES, Tone } from '@/components/ui'
import { Link } from '@/lib/router'

const TOOLS: {
  to: string
  tone: Tone
  icon: React.ReactNode
  title: string
  blurb: string
  points: string[]
  ready: boolean
}[] = [
  {
    to: '/calculator',
    tone: 'teal',
    icon: <Calculator size={20} />,
    title: 'Grade calculator',
    blurb:
      'Put in the UMS from your results slip and see your grade against the real boundaries, the raw mark behind it, and the easiest papers to re-sit.',
    points: ['Every session since 2014', 'A* rule built in', 'Next session forecast'],
    ready: true,
  },
  {
    to: '/practice',
    tone: 'violet',
    icon: <FileText size={20} />,
    title: 'Past paper practice',
    blurb:
      'Open a question paper beside its mark scheme. Each answer stays locked until you have attempted the question, so you cannot peek your way through a paper.',
    points: ['Question by question or full paper', 'Mark scheme locked until you answer', 'Your marks feed the calculator'],
    ready: false,
  },
  {
    to: '/routine',
    tone: 'amber',
    icon: <CalendarRange size={20} />,
    title: 'Study routine builder',
    blurb:
      'Tell it your units, your exam dates and the hours you actually have. It builds a day by day plan that front-loads the units you find hardest.',
    points: ['No sign up, ever', 'Exports to your calendar', 'Weighted to your weakest units'],
    ready: true,
  },
]

export function Home() {
  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-10 sm:mb-12"
      >
        <h1 className="font-display text-3xl sm:text-[3rem] font-bold tracking-tight leading-[1.08] max-w-3xl">
          Everything for Edexcel,{' '}
          <span className="bg-gradient-to-r from-teal-300 via-sky-400 via-violet-400 to-amber-300 bg-clip-text text-transparent">
            in one place
          </span>
        </h1>
        <p className="text-muted mt-4 max-w-xl leading-relaxed">
          Three tools for International A Level and International GCSE. Free, no account, no ads.
          Pick one.
        </p>
      </motion.section>

      <div className="grid md:grid-cols-3 gap-4">
        {TOOLS.map((tool, i) => (
          <motion.div
            key={tool.to}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.35 }}
          >
            <ToolCard {...tool} />
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-muted/80 mt-10 leading-relaxed max-w-2xl">
        Built from Pearson's published grade boundary documents. Unofficial, so check anything that
        matters against your statement of results.
      </p>
    </>
  )
}

function ToolCard({ to, tone, icon, title, blurb, points, ready }: (typeof TOOLS)[number]) {
  const body = (
    <Card
      className={
        'group h-full p-5 flex flex-col transition-all ' +
        (ready ? 'hover:border-line hover:-translate-y-0.5' : 'opacity-70')
      }
    >
      <span
        className={
          'grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br text-white mb-4 ' +
          TONES[tone].grad
        }
      >
        {icon}
      </span>

      <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
        {title}
        {!ready && (
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-muted">
            soon
          </span>
        )}
      </h2>

      <p className="text-sm text-muted leading-relaxed mt-2">{blurb}</p>

      <ul className="mt-4 space-y-1.5">
        {points.map((p) => (
          <li key={p} className="text-xs text-muted flex items-start gap-2">
            <span className={'mt-1.5 h-1 w-1 rounded-full shrink-0 ' + TONES[tone].dot} />
            {p}
          </li>
        ))}
      </ul>

      <span
        className={
          'mt-5 pt-4 border-t border-line/60 inline-flex items-center gap-1.5 text-sm font-semibold ' +
          (ready ? TONES[tone].text : 'text-muted/60')
        }
      >
        {ready ? 'Open' : 'In progress'}
        {ready && <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />}
      </span>
    </Card>
  )

  return ready ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    <div className="h-full cursor-default">{body}</div>
  )
}
