import { motion } from 'motion/react'
import { ArrowRight, CalendarCheck, CalendarRange, Calculator, FileText, GraduationCap, LineChart } from 'lucide-react'
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
    to: '/gpa',
    tone: 'emerald',
    icon: <GraduationCap size={20} />,
    title: 'GPA calculator',
    blurb:
      'Your O Level and A Level grades on the scales Bangladeshi universities actually use, and which departments they open at fifteen of them.',
    points: ['Every university scores differently', 'Departments checked one by one', 'Award eligibility too'],
    ready: true,
  },
  {
    to: '/practice',
    tone: 'violet',
    icon: <FileText size={20} />,
    title: 'Past paper practice',
    blurb:
      'Open a question paper beside its mark scheme. Each answer stays locked until you have attempted the question, so you cannot peek your way through a paper.',
    points: ['Question by question or full paper', 'Mark scheme locked until you answer', 'Your files never leave your device'],
    ready: true,
  },
  {
    to: '/exams',
    tone: 'rose',
    icon: <CalendarCheck size={20} />,
    title: 'Exam timetable',
    blurb:
      'Tick your subjects and get only your papers, in order, with dates, sessions and durations, plus a countdown to the first one and any clashes flagged.',
    points: ['From Pearson\'s published timetable', 'Clash detection', 'Feeds your routine automatically'],
    ready: true,
  },
  {
    to: '/log',
    tone: 'rose',
    icon: <LineChart size={20} />,
    title: 'Practice log',
    blurb:
      'Every paper you have marked, how your scores are moving, and the units worth another go. It fills itself in as you practise.',
    points: ['Written as you mark', 'Real grades, not just marks', 'Weakest units first'],
    ready: true,
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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mb-10 sm:mb-12"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#68BA7F] mb-4">
          Edexcel and Cambridge · International A Level and IGCSE
        </p>
        <h1 className="font-display text-4xl sm:text-[3.4rem] font-bold tracking-tight leading-[1.05] max-w-4xl">
          Every past paper,{' '}
          <span className="reveal-line bg-[linear-gradient(110deg,#CFFFDC,#68BA7F,#2E6F40,#8fd6a4,#CFFFDC)] bg-clip-text text-transparent">
            marked honestly
          </span>
        </h1>
        <p className="text-muted mt-5 max-w-2xl text-lg leading-relaxed">
          Thousands of question papers beside their mark schemes, a grade calculator built on the
          real boundaries, and a check on which universities your grades open. Free, no account,
          nothing to install.
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-7">
          <Link
            to="/practice"
            className="h-12 px-6 rounded-2xl bg-gradient-to-br from-[#CFFFDC] to-[#68BA7F] text-[#14251a] text-sm font-bold inline-flex items-center gap-2 hover:brightness-105 hover:-translate-y-0.5 transition-all shadow-lg shadow-[#2E6F40]/30"
          >
            Start practising <ArrowRight size={16} />
          </Link>
          <Link
            to="/gpa"
            className="h-12 px-6 rounded-2xl border border-line text-sm font-bold inline-flex items-center gap-2 hover:border-[#68BA7F]/60 hover:-translate-y-0.5 transition-all"
          >
            Where do my grades get me?
          </Link>
        </div>

        <p className="text-xs text-muted/80 mt-6">
          Built for students sitting Edexcel and Cambridge exams. Everything you enter stays in
          your own browser.
        </p>
      </motion.section>

      <h2 className="font-display text-lg font-semibold tracking-tight mb-4">
        Six tools, all free
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool, i) => (
          <motion.div
            key={tool.to}
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.07 * i, type: 'spring', stiffness: 260, damping: 24 }}
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
      spotlight={ready}
      className={
        'group h-full p-5 flex flex-col transition-all duration-300 ' +
        (ready
          ? 'hover:border-line hover:-translate-y-1 hover:shadow-[0_1px_0_0_rgba(255,255,255,.06)_inset,0_40px_80px_-40px_rgba(0,0,0,1)]'
          : 'opacity-70')
      }
    >
      <span
        className={
          'grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br text-white mb-4 ' +
          'transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 ' +
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
