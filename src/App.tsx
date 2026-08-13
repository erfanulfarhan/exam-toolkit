import { Suspense, lazy } from 'react'
import { ArrowUpRight, Layers } from 'lucide-react'
import { Link, Router, useRouter } from '@/lib/router'
import { Home } from '@/pages/Home'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { RoutinePage } from '@/pages/RoutinePage'
import { ExamsPage } from '@/pages/ExamsPage'
import { LogPage } from '@/pages/LogPage'
import { GpaPage } from '@/pages/GpaPage'
// pdf.js is large, so the practice page loads only when someone opens it.
const PracticePage = lazy(() => import('@/pages/PracticePage').then((m) => ({ default: m.PracticePage })))

const NAV = [
  { to: '/calculator', label: 'Calculator' },
  { to: '/exams', label: 'Timetable' },
  { to: '/routine', label: 'Routine' },
  { to: '/practice', label: 'Practice' },
  { to: '/gpa', label: 'GPA' },
  { to: '/log', label: 'Log' },
]

export default function App() {
  return (
    <Router>
      <Shell />
    </Router>
  )
}

function Shell() {
  const { path } = useRouter()

  return (
    <div className="min-h-[100svh] flex flex-col">
      <div className="mesh" />
      <div className="grain" />

      <header className="no-print sticky top-0 z-30 border-b border-line/50 bg-bg/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <span className="grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-teal-300 via-sky-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20">
              <Layers size={17} />
            </span>
            <span className="font-display font-bold text-[15px] sm:text-base tracking-tight">
              Exam Toolkit
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={
                  'rounded-lg px-2.5 sm:px-3 h-8 inline-flex items-center text-xs sm:text-sm font-semibold transition-colors ' +
                  (path === item.to ? 'bg-white/[.07] text-ink' : 'text-muted hover:text-ink')
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main
        className={
          path === '/practice'
            ? 'flex-1 w-full px-3 sm:px-4 py-4'
            : 'flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12'
        }
      >
        <Route path={path} />
      </main>

      <footer className={'no-print border-t border-line/50 ' + (path === '/practice' ? 'mt-4' : 'mt-10')}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 text-xs text-muted flex flex-wrap gap-x-5 gap-y-2 justify-between">
          <p>
            © {new Date().getFullYear()} Exam Toolkit. All rights reserved.
            {' '}Unofficial. Check anything that matters against your statement of results.
          </p>
          <a
            href="https://qualifications.pearson.com/en/support/support-topics/results-certification/grade-boundaries.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-ink transition-colors"
          >
            Pearson boundaries <ArrowUpRight size={13} />
          </a>
        </div>
      </footer>
    </div>
  )
}

function Route({ path }: { path: string }) {
  if (path === '/calculator') return <CalculatorPage />
  if (path === '/routine') return <RoutinePage />
  if (path === '/exams') return <ExamsPage />
  if (path === '/log') return <LogPage />
  if (path === '/gpa') return <GpaPage />
  if (path === '/practice') {
    return (
      <Suspense fallback={<p className="text-muted py-16 text-center">Loading the paper viewer…</p>}>
        <PracticePage />
      </Suspense>
    )
  }
  if (path === '/') return <Home />
  return <NotFound />
}

function Soon({ path }: { path: string }) {
  const name = path === '/practice' ? 'Past paper practice' : 'This tool'
  return (
    <div className="py-20 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight">{name}</h1>
      <p className="text-muted mt-2">Being built right now.</p>
      <Link to="/" className="inline-block mt-6 text-sm font-semibold text-sky-400 hover:text-sky-300">
        Back to the tools
      </Link>
    </div>
  )
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight">Nothing here</h1>
      <Link to="/" className="inline-block mt-4 text-sm font-semibold text-sky-400 hover:text-sky-300">
        Back to the tools
      </Link>
    </div>
  )
}
