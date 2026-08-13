import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, Columns2, Crosshair, Expand, Eye, GripVertical, Lock, LockOpen, Minus, PanelLeft, Pause, Play, Plus, RotateCcw, Rows2, TimerReset, Timer as TimerIcon, X } from 'lucide-react'
import { Card, Field, NumInput, Segmented, Select, TONES } from '@/components/ui'
import { LoadedPaper, anchorFor, loadPdf, paperKey, questionList, renderInto } from '@/lib/paper'
import { PaperChoice, PaperMeta, unitGroup } from '@/lib/library'
import { saveEntry } from '@/lib/log'
import { MarkPaper, MarkResult } from '@/components/MarkPaper'
import { PaperLibrary } from '@/components/PaperLibrary'

type Mode = 'question' | 'full'
type Progress = Record<number, { attempted: boolean; marks?: number }>

const SEASON: Record<string, string> = {
  January: 'Jan', 'May/June': 'May/June', 'October/November': 'Oct/Nov',
}
const sessionLabel = (m: PaperMeta) => (m.year ? `${SEASON[m.session] ?? m.session} ${m.year}` : '')

export function PracticePage() {
  const [qp, setQp] = useState<LoadedPaper | null>(null)
  const [ms, setMs] = useState<LoadedPaper | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('question')
  const [current, setCurrent] = useState(1)
  // Which question to scroll the question paper to. Set by clicking a number;
  // scroll-detection reads current back out and never writes here, so following
  // the scroll can't fight a jump. Cleared once the scroll lands.
  // Null means "leave it where it is". Both papers open at page one and move
  // only when a question number is clicked, so nothing jumps under you.
  const [qpScrollTo, setQpScrollTo] = useState<number | null>(null)
  const [msScrollTo, setMsScrollTo] = useState<number | null>(null)
  const [storeKey, setStoreKey] = useState('')
  const [paperMeta, setPaperMeta] = useState<PaperMeta | null>(null)
  // The rest of the open paper's subject, so you can step to another sitting
  // without going back to the library. `choiceKey` marks the one on screen.
  const [siblings, setSiblings] = useState<PaperChoice[]>([])
  const [choiceKey, setChoiceKey] = useState('')
  // What "Mark the paper" made of the marks, kept so the log can store a real
  // percentage and grade alongside the raw total.
  const [result, setResult] = useState<MarkResult | null>(null)
  const [progress, setProgress] = useState<Progress>({})
  const [stacked, setStacked] = useState(() => window.innerWidth < 1024)
  // The subject's other papers, docked beside the viewer. Open by default where
  // there is room for a column, closed on a phone where it would be a drawer
  // over the paper.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('practice.sidebar')
    return saved ? saved === 'on' : window.innerWidth >= 1024
  })
  useEffect(() => {
    localStorage.setItem('practice.sidebar', sidebarOpen ? 'on' : 'off')
  }, [sidebarOpen])
  // Some people just want a side-by-side viewer. Gating is the default, not a rule.
  const [gated, setGated] = useState(() => localStorage.getItem('practice.gated') !== 'off')
  const [split, setSplit] = useState(() => Number(localStorage.getItem('practice.split')) || 50)
  const [paneHeight, setPaneHeight] = useState(
    () => Number(localStorage.getItem('practice.height')) || Math.max(420, window.innerHeight - 250))
  // Anchors the student sets by hand when detection puts a question in the
  // wrong place. Keyed per paper alongside their progress.
  const [manual, setManual] = useState<Record<number, { page: number; y: number }>>({})
  const shell = useRef<HTMLDivElement>(null)

  const questions = useMemo(
    () => (qp && ms ? questionList(qp.anchors, ms.anchors) : []),
    [qp, ms],
  )

  // Progress is keyed to the file itself, so reopening the same paper restores it.
  useEffect(() => {
    if (!storeKey) return
    try {
      setProgress(JSON.parse(localStorage.getItem('practice.' + storeKey) || '{}'))
    } catch { setProgress({}) }
  }, [storeKey])

  useEffect(() => {
    if (storeKey) localStorage.setItem('practice.' + storeKey, JSON.stringify(progress))
  }, [storeKey, progress])

  useEffect(() => { localStorage.setItem('practice.gated', gated ? 'on' : 'off') }, [gated])
  useEffect(() => { localStorage.setItem('practice.split', String(split)) }, [split])
  useEffect(() => { localStorage.setItem('practice.height', String(paneHeight)) }, [paneHeight])

  useEffect(() => {
    if (!storeKey) return
    try { setManual(JSON.parse(localStorage.getItem('anchors.' + storeKey) || '{}')) } catch { setManual({}) }
  }, [storeKey])
  useEffect(() => {
    if (storeKey) localStorage.setItem('anchors.' + storeKey, JSON.stringify(manual))
  }, [storeKey, manual])

  // The library hands over a paper and its subject's other papers at once, so
  // this both opens the pick and stocks the in-viewer switcher. A library paper
  // arrives as the URL that streams it; a dropped one as a File.
  const openPaper = useCallback(async (choice: PaperChoice, sibs: PaperChoice[]) => {
    setError('')
    setBusy('Opening the paper…')
    try {
      // Load the question paper, its mark scheme and the progress key at once.
      // They were opened one after another before, so the mark scheme did not
      // even start downloading until the whole question paper had been parsed.
      const [qpPaper, key, msPaper] = await Promise.all([
        loadPdf(choice.qp, labelOf(choice.qp), 'qp'),
        paperKey(choice.qp),
        choice.ms ? loadPdf(choice.ms, labelOf(choice.ms), 'ms') : Promise.resolve(null),
      ])
      setQp(qpPaper)
      setStoreKey(key)
      setMs(msPaper)
      setPaperMeta(choice.meta)
      setSiblings(sibs)
      setChoiceKey(choice.key)
      setResult(null)   // belongs to the paper being closed, not the new one
      setCurrent(1)
      setQpScrollTo(null)
      setMsScrollTo(null)
      setGated(true)    // a new paper starts honest, whatever the last one ended on
    } catch (e) {
      // The detail goes to the console rather than the page: it is a stack
      // trace, not something a student can act on.
      console.error('Could not open paper', e)
      setError('That paper could not be opened. Try again, or pick another paper.')
    } finally {
      setBusy(null)
    }
  }, [])

  const attempted = (n: number) => !!progress[n]?.attempted
  const markAttempted = (n: number) =>
    setProgress((p) => ({ ...p, [n]: { ...p[n], attempted: true } }))
  const setMarks = (n: number, marks: number | undefined) =>
    setProgress((p) => ({ ...p, [n]: { ...p[n], attempted: true, marks } }))

  const total = Object.values(progress).reduce((s, v) => s + (v.marks ?? 0), 0)
  const done = questions.filter(attempted).length

  // Record the attempt in the practice log as you work, so the log fills itself
  // in. Attempting counts, not just scoring: marking questions as done without
  // typing a mark is still an attempt worth having. Counted off the progress
  // itself rather than the detected question list, so a paper whose numbers
  // could not be read still logs.
  const attemptedCount = Object.values(progress).filter((v) => v.attempted).length
  const scored = Object.values(progress).filter((v) => v.marks != null).length
  useEffect(() => {
    if (!storeKey || !paperMeta) return
    if (attemptedCount === 0 && scored === 0) return
    saveEntry({
      key: storeKey,
      level: paperMeta.level,
      subject: paperMeta.subject,
      unit: paperMeta.unit,
      session: paperMeta.session,
      year: paperMeta.year,
      marks: total,
      // Only claim a total, and therefore a percentage, once marks have really
      // been entered. An attempted-but-unscored paper would otherwise land in
      // the averages as a genuine zero.
      rawMax: scored > 0 ? result?.rawMax : undefined,
      grade: scored > 0 ? result?.grade : undefined,
      ums: scored > 0 ? result?.ums : undefined,
      umsMax: scored > 0 ? result?.umsMax : undefined,
      questions: questions.length || attemptedCount,
      attempted: attemptedCount,
      at: new Date().toISOString(),
    })
  }, [storeKey, paperMeta, total, scored, attemptedCount, questions.length, result])

  if (!qp || !ms) {
    return <Setup busy={busy} error={error} onOpenPaper={openPaper} />
  }

  return (
    <div ref={shell} className="bg-bg">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          {paperMeta ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[.09em] text-muted mb-1">
                <span className="text-teal-300">{paperMeta.level}</span>
                <span>·</span><span>{paperMeta.subject}</span>
                {sessionLabel(paperMeta) && (<><span>·</span><span className="text-violet-300">{sessionLabel(paperMeta)}</span></>)}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                {paperMeta.subject} {paperMeta.unit}
              </h1>
            </>
          ) : (
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {qp.label.replace(/\.pdf$/i, '')}
            </h1>
          )}
          <p className="text-sm text-muted mt-1">
            {questions.length} questions found · {done} attempted
            {total > 0 && <> · {total} marks self-scored</>}
          </p>
          {questions.length === 0 && (
            <p className="text-xs text-amber-300/90 mt-1 max-w-xl">
              Question numbers could not be read from this paper, so jumping between
              questions is off. Both documents still open in full.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {siblings.length > 1 && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className={
                'h-10 px-3 rounded-xl border text-sm font-semibold transition-colors inline-flex items-center gap-1.5 ' +
                (sidebarOpen
                  ? 'border-teal-400/50 bg-teal-400/15 text-ink'
                  : 'border-line text-muted hover:text-ink')
              }
              title="Browse this subject's papers"
            >
              <PanelLeft size={15} /> {sidebarOpen ? 'Hide papers' : 'Show papers'}
            </button>
          )}
          <button
            onClick={() => {
              const node = shell.current
              if (!node) return
              if (document.fullscreenElement) document.exitFullscreen()
              else node.requestFullscreen?.().catch(() => {})
            }}
            className="h-10 px-3 rounded-xl border border-line text-sm font-semibold text-muted hover:text-ink transition-colors inline-flex items-center gap-1.5"
            title="Fill the screen"
          >
            <Expand size={15} /> Fullscreen
          </button>
          <button
            onClick={() => setGated((v) => !v)}
            className={
              'h-10 px-3 rounded-xl border text-sm font-semibold transition-colors inline-flex items-center gap-1.5 ' +
              (gated
                ? 'border-violet-400/50 bg-violet-400/15 text-ink'
                : 'border-line text-muted hover:text-ink')
            }
            title={gated ? 'Mark scheme is revealed one question at a time' : 'Mark scheme is fully open'}
          >
            {gated ? <Lock size={14} /> : <LockOpen size={14} />}
            {gated ? 'Locking on' : 'Locking off'}
          </button>
          <button
            onClick={() => setStacked((v) => !v)}
            className="h-10 px-3 rounded-xl border border-line text-sm font-semibold text-muted hover:text-ink transition-colors inline-flex items-center gap-1.5"
            title={stacked ? 'Side by side' : 'Stack for full width'}
          >
            {stacked ? <Columns2 size={15} /> : <Rows2 size={15} />}
            {stacked ? 'Side by side' : 'Full width'}
          </button>
          <Segmented<Mode>
            id="practice-mode"
            tone="violet"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'question', label: 'Question by question' },
              { value: 'full', label: 'Full paper' },
            ]}
          />
          <MockTimer
            onStart={() => {
              const node = shell.current
              if (node && !document.fullscreenElement) node.requestFullscreen?.().catch(() => {})
            }}
            onTimeUp={() => setGated(false)}
          />
          <button
            onClick={() => { setQp(null); setMs(null); setProgress({}); setCurrent(1) }}
            className="h-10 px-3 rounded-xl border border-line text-sm font-semibold text-muted hover:text-ink transition-colors inline-flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> New paper
          </button>
        </div>
      </div>

      {questions.length > 0 && (
        <div className="sticky top-16 z-20 -mx-1 px-1 py-3 mb-3 bg-bg/95 backdrop-blur border-b border-line/60 flex flex-wrap justify-center gap-1.5">
          {questions.map((n) => (
            <button
              key={n}
              onClick={() => { setCurrent(n); setQpScrollTo(n); setMsScrollTo(n) }}
              className={
                'h-9 min-w-9 px-2 rounded-xl text-sm font-semibold transition-colors border ' +
                (n === current
                  ? 'border-violet-400/60 bg-violet-400/20 text-ink'
                  : attempted(n)
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    : 'border-line bg-black/25 text-muted hover:text-ink')
              }
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/*
        A handle pinned to the edge of the screen, so the list is always one
        click away once it has been hidden — the toolbar button scrolls out of
        reach as soon as you are deep in a paper.
      */}
      <AnimatePresence>
        {!sidebarOpen && siblings.length > 1 && (
          <motion.button
            key="paper-handle"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            onClick={() => setSidebarOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-30 h-28 w-8 rounded-r-xl
              border border-l-0 border-line bg-bg/95 backdrop-blur shadow-xl
              grid place-items-center text-muted hover:text-ink hover:w-9 transition-all"
            title="Show the paper list"
            aria-label="Show the paper list"
          >
            <ChevronRight size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sidebarOpen && siblings.length > 1 && (
          <PaperSidebar
            key="paper-sidebar"
            siblings={siblings}
            current={choiceKey}
            subject={paperMeta?.subject || ''}
            onPick={(c) => openPaper(c, siblings)}
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <SplitView
        stacked={stacked}
        split={split}
        onSplit={setSplit}
        height={paneHeight}
        onHeight={setPaneHeight}
      >
        <Pane
          title="Question paper"
          tone="teal"
          paper={qp}
          height={paneHeight}
          // Jumping to a question is useful in both modes: full paper view
          // still benefits from being able to land on question 12 directly.
          // Reading down the paper also reports which question you have reached,
          // so the mark scheme keeps pace instead of being left behind.
          scrollTo={qpScrollTo}
          onScrolledTo={() => setQpScrollTo(null)}
          onVisibleQuestion={setCurrent}
        />

        <div className="relative min-w-0">
          <Pane
            height={paneHeight}
            title="Mark scheme"
            tone="violet"
            paper={ms}
            question={mode === 'question' ? current : undefined}
            slice={gated && mode === 'question' ? sliceFor(ms, current, manual) : null}
            // Locking on shows the current question as a slice, which changes
            // with the question and re-locks anything not yet attempted. With
            // the whole scheme on show it scrolls to whichever question you have
            // reached, whether you clicked a number or scrolled to it, so coming
            // back up to a question you have already done lands on its answer.
            scrollTo={!gated || mode === 'full' ? (msScrollTo ?? current) : null}
            onScrolledTo={() => setMsScrollTo(null)}
            onSetAnchor={gated && mode === 'question'
              ? (page, y) => setManual((m) => ({ ...m, [current]: { page, y } }))
              : undefined}
            locked={gated && (mode === 'question' ? !attempted(current) : questions.some((n) => !attempted(n)))}
            lockNote={
              mode === 'question'
                ? `Answer question ${current} first. Only question ${current} will be shown.`
                : 'Full paper view unlocks once every question is attempted.'
            }
            onUnlock={gated && mode === 'question' ? () => markAttempted(current) : undefined}
          />
        </div>
      </SplitView>

      {mode === 'question' && attempted(current) && (
        <Card className="p-4 mt-4">
          <div className="flex flex-wrap items-center gap-4">
            <Field label={`Marks you scored on Q${current}`}>
              <NumInput
                value={progress[current]?.marks ?? ''}
                min={0}
                max={30}
                onChange={(e) =>
                  setMarks(current, e.target.value === '' ? undefined : Number(e.target.value))}
                className="h-10 w-28"
                placeholder="marks"
              />
            </Field>
            <div className="text-sm text-muted">
              Running total <b className="text-ink tabular-nums">{total}</b> across{' '}
              {Object.values(progress).filter((v) => v.marks != null).length} questions.
            </div>
          </div>
        </Card>
      )}

      <MarkPaper
        suggested={total}
        preset={paperMeta
          ? { subject: paperMeta.subject, code: paperMeta.unit, session: paperMeta.session, year: paperMeta.year }
          : undefined}
        onResult={setResult}
      />
    </div>
  )
}

/** A library paper carries its filename in the key of the URL that streams it. */
function labelOf(source: File | string): string {
  if (typeof source !== 'string') return source.name
  try {
    const key = new URL(source, window.location.origin).searchParams.get('key')
    if (key) return key.split('/').pop() || key
  } catch { /* not a URL, fall through to the raw string */ }
  return source
}

const MOCK_PRESETS = [60, 75, 90, 105, 120, 150, 180]

function formatClock(total: number): string {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/**
 * Time yourself under exam conditions. Pick a duration, and a countdown runs in
 * a floating clock that stays put as you scroll. It fills the screen on start
 * and, when the time is up, reveals the mark scheme so you can grade the paper
 * yourself. Purely a timer — it never forces you to stop.
 */
function MockTimer({ onStart, onTimeUp }: { onStart: () => void; onTimeUp: () => void }) {
  const [minutes, setMinutes] = useState(90)
  const [remaining, setRemaining] = useState<number | null>(null) // seconds; null = idle
  const [running, setRunning] = useState(false)
  const [setup, setSetup] = useState(false)
  const firedTimeUp = useRef(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setRemaining((r) => (r == null ? r : Math.max(0, r - 1))), 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => {
    if (remaining === 0 && running && !firedTimeUp.current) {
      firedTimeUp.current = true
      setRunning(false)
      onTimeUp()
    }
  }, [remaining, running, onTimeUp])

  const begin = () => {
    firedTimeUp.current = false
    setRemaining(minutes * 60)
    setRunning(true)
    setSetup(false)
    onStart()
  }
  const stop = () => { setRunning(false); setRemaining(null); firedTimeUp.current = false }

  const done = remaining === 0
  const urgent = remaining != null && remaining <= 300 && !done // last five minutes

  return (
    <div className="relative">
      <button
        onClick={() => (remaining == null ? setSetup((v) => !v) : stop())}
        className={
          'h-10 px-3 rounded-xl border text-sm font-semibold transition-colors inline-flex items-center gap-1.5 ' +
          (remaining != null
            ? 'border-amber-400/50 bg-amber-400/15 text-ink'
            : 'border-line text-muted hover:text-ink')
        }
        title={remaining != null ? 'End the mock' : 'Time yourself under exam conditions'}
      >
        <TimerIcon size={15} /> {remaining != null ? 'End mock' : 'Mock exam'}
      </button>

      {setup && (
        <div className="absolute right-0 top-12 z-40 w-64 rounded-2xl border border-line bg-bg/95 backdrop-blur-xl p-4 shadow-2xl">
          <div className="text-xs font-semibold uppercase tracking-[.09em] text-muted mb-2">Mock duration</div>
          <div className="flex flex-wrap gap-1.5">
            {MOCK_PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={
                  'h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors ' +
                  (minutes === m
                    ? 'border-amber-400/60 bg-amber-400/20 text-ink'
                    : 'border-line text-muted hover:text-ink')
                }
              >
                {m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="number" min={1} max={360} value={minutes}
              onChange={(e) => setMinutes(Math.min(360, Math.max(1, Number(e.target.value) || 0)))}
              className="h-9 w-20 px-2 rounded-lg border border-line bg-black/25 text-sm outline-none focus:border-amber-400/60"
            />
            <span className="text-xs text-muted">minutes</span>
          </div>
          <button
            onClick={begin}
            className="mt-3 w-full h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-black text-sm font-bold inline-flex items-center justify-center gap-2 hover:brightness-110 transition-all"
          >
            <Play size={15} /> Start · {formatClock(minutes * 60)}
          </button>
        </div>
      )}

      {remaining != null && (
        <div
          className={
            'fixed bottom-6 right-6 z-50 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-xl ' +
            (done
              ? 'border-rose-400/60 bg-rose-500/20'
              : urgent
                ? 'border-amber-400/60 bg-amber-500/15'
                : 'border-line bg-bg/90')
          }
        >
          <div className={'font-display font-bold tabular-nums leading-none ' + (done ? 'text-rose-300 text-2xl' : 'text-ink text-3xl')}>
            {done ? "Time's up" : formatClock(remaining)}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {!done && (
              <button
                onClick={() => setRunning((v) => !v)}
                className="h-8 px-2.5 rounded-lg border border-line text-xs font-semibold text-muted hover:text-ink transition-colors inline-flex items-center gap-1"
              >
                {running ? <Pause size={13} /> : <Play size={13} />}{running ? 'Pause' : 'Resume'}
              </button>
            )}
            {done && <span className="text-[11px] text-rose-200/80">Mark scheme unlocked — grade yourself.</span>}
            <button
              onClick={stop}
              className="h-8 px-2.5 rounded-lg border border-line text-xs font-semibold text-muted hover:text-ink transition-colors inline-flex items-center gap-1"
              title={done ? 'Clear the timer' : 'End the mock'}
            >
              {done ? <X size={13} /> : <TimerReset size={13} />}{done ? 'Dismiss' : 'End'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The rest of the subject, beside the paper you are reading.
 *
 * Papers are grouped by unit, because that is how revision actually goes: you
 * pick the unit you are weak at and work back through its sittings. The unit
 * holding the open paper starts expanded. On a narrow screen it slides over the
 * viewer as a drawer instead of taking a column from it.
 */
function PaperSidebar({
  siblings, current, subject, onPick, onClose,
}: {
  siblings: PaperChoice[]
  current: string
  subject: string
  onPick: (choice: PaperChoice) => void
  onClose: () => void
}) {
  const byUnit = useMemo(() => {
    const groups = new Map<string, { label: string; papers: PaperChoice[] }>()
    for (const c of siblings) {
      // "Unit 1", "U1" and "WBI11" are one unit, so they group as one.
      const { key, label } = unitGroup(c.meta.unit)
      const found = groups.get(key)
      if (found) found.papers.push(c)
      else groups.set(key, { label, papers: [c] })
    }
    // Siblings arrive newest-first, so each unit's sittings already read that
    // way; only the units themselves need ordering.
    return [...groups.entries()].sort((a, b) =>
      a[1].label.localeCompare(b[1].label, undefined, { numeric: true }))
  }, [siblings])

  const currentUnit = unitGroup(siblings.find((c) => c.key === current)?.meta.unit || '').key
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({})
  const isOpen = (unit: string) => openUnits[unit] ?? unit === currentUnit

  return (
    <>
      {/*
        A drawer rather than a docked column: sliding a column in and out would
        resize the viewer on every animation frame, and each of those resizes
        re-rasterises both PDFs. Overlaying keeps the panes at full width, so
        hiding the drawer really does hand the space back to the paper.

        No backdrop: dimming the page would hide the very paper you are choosing
        against, and would stop you scrolling it while the list is open.
      */}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className={
          'fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto ' +
          'bg-bg border-r border-line p-2.5 shadow-2xl'
        }
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-2 mb-1 border-b border-line/60">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">Papers</div>
            <div className="text-sm font-semibold truncate">{subject}</div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-8 w-8 grid place-items-center rounded-lg text-muted hover:text-ink transition-colors"
            aria-label="Hide the paper list"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-0.5">
          {byUnit.map(([key, { label, papers }]) => {
            const expanded = isOpen(key)
            return (
              <div key={key}>
                <button
                  onClick={() => setOpenUnits((o) => ({ ...o, [key]: !expanded }))}
                  className="w-full flex items-center gap-1.5 py-2 px-1.5 rounded-lg text-left hover:bg-white/[0.04] transition-colors"
                >
                  <ChevronRight
                    size={13}
                    className={'text-muted shrink-0 transition-transform ' + (expanded ? 'rotate-90' : '')}
                  />
                  <span className="flex-1 truncate text-sm font-semibold">{label}</span>
                  <span className="text-[10px] text-muted tabular-nums">{papers.length}</span>
                </button>
                {expanded && papers.map((p) => {
                  const active = p.key === current
                  return (
                    <button
                      key={p.key}
                      // Stays open on a wide screen so you can keep browsing;
                      // on a phone it is covering the paper, so it gets out of
                      // the way once you have chosen.
                      onClick={() => { onPick(p); if (window.innerWidth < 1024) onClose() }}
                      className={
                        'w-full flex items-center gap-2 text-left text-[13px] rounded-lg py-1.5 pl-7 pr-2 transition-colors ' +
                        (active
                          ? 'bg-violet-400/20 text-ink font-semibold'
                          : 'text-muted hover:text-ink hover:bg-white/[0.04]')
                      }
                    >
                      <span className="flex-1 truncate">{sessionLabel(p.meta) || p.label}</span>
                      {/* Both spec generations share a unit now, so the code is
                          what tells a 6PH02 sitting from a WPH12 one. */}
                      <span className="shrink-0 text-[10px] text-muted/70 font-mono">{p.meta.unit}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </motion.aside>
    </>
  )
}

function Setup({
  busy, error, onOpenPaper,
}: {
  busy: string | null
  error: string
  onOpenPaper: (choice: PaperChoice, siblings: PaperChoice[]) => void
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mb-8"
      >
        <h1 className="font-display text-3xl sm:text-[2.75rem] font-bold tracking-tight leading-[1.1]">
          Every past paper,{' '}
          <span className="bg-gradient-to-r from-teal-300 via-sky-400 to-fuchsia-500 bg-clip-text text-transparent">
            marked honestly
          </span>
        </h1>
        <p className="text-muted mt-4 leading-relaxed mx-auto max-w-xl">
          Browse the full Edexcel and Cambridge archive by subject and sitting, and open any paper
          beside its mark scheme. The scheme stays locked question by question until you've attempted
          it — so revision is practice, not just reading the answers.
        </p>
      </motion.section>

      <PaperLibrary onOpen={onOpenPaper} />

      {busy && <p className="text-sm text-muted mt-4 text-center">{busy}</p>}
      {error && <p className="text-sm text-rose-400 mt-4 text-center">{error}</p>}
    </div>
  )
}

/** Drag the divider to size the columns, drag the bottom edge for height. */
function SplitView({
  children, stacked, split, onSplit, height, onHeight,
}: {
  children: React.ReactNode
  stacked: boolean
  split: number
  onSplit: (pct: number) => void
  height: number
  onHeight: (px: number) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [left, right] = children as React.ReactNode[]

  const dragSplit = (e: React.PointerEvent) => {
    e.preventDefault()
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return
    const move = (ev: PointerEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100
      onSplit(Math.min(78, Math.max(22, Math.round(pct))))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const dragHeight = (e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const move = (ev: PointerEvent) => {
      onHeight(Math.min(2000, Math.max(320, Math.round(startH + (ev.clientY - startY)))))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <>
      <div
        ref={box}
        className={stacked ? 'space-y-4' : 'flex items-start gap-0'}
      >
        {stacked ? (
          <>{left}{right}</>
        ) : (
          <>
            <div style={{ width: `calc(${split}% - 14px)` }} className="min-w-0">{left}</div>
            <div
              onPointerDown={dragSplit}
              className="w-7 shrink-0 cursor-col-resize grid place-items-center text-muted/40 hover:text-ink transition-colors"
              style={{ height }}
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize"
            >
              <GripVertical size={16} />
            </div>
            <div style={{ width: `calc(${100 - split}% - 14px)` }} className="min-w-0">{right}</div>
          </>
        )}
      </div>

      <div
        onPointerDown={dragHeight}
        className="mt-1.5 h-3 cursor-row-resize grid place-items-center group"
        title="Drag to make the viewer taller"
      >
        <span className="h-1 w-16 rounded-full bg-line group-hover:bg-muted transition-colors" />
      </div>
    </>
  )
}

type Slice = { from: { page: number; y: number }; to: { page: number; y: number } }

/** The mark scheme band belonging to one question: its anchor to the next one. */
function sliceFor(
  ms: LoadedPaper,
  q: number,
  manual: Record<number, { page: number; y: number }> = {},
): Slice | null {
  const a = manual[q] ? { question: q, ...manual[q] } : anchorFor(ms.anchors, q)
  if (!a) return null
  // End the band at the next question actually detected above this one, not at
  // q+1 — a sparse mark scheme often has no q+1 anchor, and assuming one made
  // the slice run to the end of the document.
  const above = ms.anchors
    .filter((x) => x.question > q)
    .sort((x, y) => x.question - y.question)[0]
  const next = manual[q + 1] ? { question: q + 1, ...manual[q + 1] } : above
  const lastPage = ms.sizes.length
  const to = next && (next.page > a.page || next.y > a.y)
    ? { page: next.page, y: Math.max(0, next.y - 6) }
    : { page: lastPage, y: ms.sizes[lastPage - 1].height }
  return { from: { page: a.page, y: Math.max(0, a.y - 12) }, to }
}

function Pane({
  title, tone, paper, question, slice, locked, lockNote, onUnlock, height, onSetAnchor,
  scrollTo, onScrolledTo, onVisibleQuestion,
}: {
  height: number
  onSetAnchor?: (page: number, y: number) => void
  title: string
  tone: 'teal' | 'violet'
  paper: LoadedPaper
  question?: number
  slice?: Slice | null
  locked?: boolean
  lockNote?: string
  onUnlock?: () => void
  /** Question to scroll this pane to (click-driven). Cleared via onScrolledTo. */
  scrollTo?: number | null
  onScrolledTo?: () => void
  /** When set, report the question currently at the top as the user scrolls. */
  onVisibleQuestion?: (q: number) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [paneWidth, setPaneWidth] = useState(0)
  // Each pane zooms on its own. A mark scheme's table and a question paper's
  // prose rarely want the same magnification, and locking them together meant
  // sizing one always spoiled the other.
  const [zoom, setZoom] = useState(1)

  // Measure the outer frame with offsetWidth, not the scroller's clientWidth.
  // clientWidth shrinks when zooming adds a horizontal scrollbar, which fed
  // back into the render width and made the viewer flicker.
  useEffect(() => {
    const node = frame.current
    if (!node) return
    const measure = () => setPaneWidth(node.offsetWidth - 20)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const pageWidth = Math.max(240, Math.round(paneWidth * zoom))

  // Report the question currently at the top of this pane as it's scrolled, so
  // the mark scheme can follow the question paper. Debounced: it fires when the
  // scroll settles, not on every frame, which keeps the mark scheme from
  // flickering through questions during a fast swipe or a jump-to scroll.
  const lastSeen = useRef(0)
  useEffect(() => {
    const root = scroller.current
    if (!onVisibleQuestion || !root) return
    let timer: ReturnType<typeof setTimeout>
    const compute = () => {
      const holders = new Map<number, HTMLElement>()
      root.querySelectorAll<HTMLElement>('[data-page]').forEach(
        (h) => holders.set(Number(h.dataset.page), h))
      if (!holders.size) return
      // Nothing to scroll (paper fits the pane): leave the clicked question be.
      if (root.scrollHeight <= root.clientHeight + 4) return
      // Normally the current question is the one at the top edge. But the last
      // question can't be scrolled to the top — the document ends first — so at
      // the very bottom, use the viewport's bottom edge instead. Otherwise a
      // jump to the final question reads as the previous one still at the top.
      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 4
      const probe = atBottom ? root.scrollTop + root.clientHeight - 4 : root.scrollTop + 72
      let q = paper.anchors[0]?.question ?? 1
      for (const a of paper.anchors) {
        const holder = holders.get(a.page)
        if (!holder) continue
        const scale = holder.offsetWidth / paper.sizes[a.page - 1].width
        if (holder.offsetTop + a.y * scale <= probe) q = a.question
        else break
      }
      if (q !== lastSeen.current) { lastSeen.current = q; onVisibleQuestion(q) }
    }
    const onScroll = () => { clearTimeout(timer); timer = setTimeout(compute, 120) }
    root.addEventListener('scroll', onScroll, { passive: true })
    compute()
    return () => { root.removeEventListener('scroll', onScroll); clearTimeout(timer) }
  }, [onVisibleQuestion, paper, pageWidth])

  // When the shown question changes, start the mark scheme at the top of that
  // question rather than wherever the previous one was scrolled to.
  useEffect(() => {
    if (slice && scroller.current) scroller.current.scrollTop = 0
  }, [slice?.from.page, slice?.from.y])

  return (
    <Card ref={frame} className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line/60">
        <span className={'text-xs font-semibold uppercase tracking-[.09em] ' + TONES[tone].text}>
          {title}
        </span>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-line bg-black/25 h-7">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
              className="h-full w-7 grid place-items-center text-muted hover:text-ink transition-colors"
              aria-label={`Zoom out the ${title.toLowerCase()}`}
            >
              <Minus size={13} />
            </button>
            <span className="w-11 text-center text-[11px] font-semibold tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.2) * 10) / 10))}
              className="h-full w-7 grid place-items-center text-muted hover:text-ink transition-colors"
              aria-label={`Zoom in on the ${title.toLowerCase()}`}
            >
              <Plus size={13} />
            </button>
          </div>
          {onSetAnchor && !locked && (
            <button
              onClick={() => {
                const root = scroller.current
                if (!root) return
                // Turn the current scroll position back into a page and offset.
                const holders = [...root.querySelectorAll<HTMLElement>('[data-page]')]
                const hit = holders.find((h) => h.offsetTop + h.offsetHeight > root.scrollTop) || holders[0]
                if (!hit) return
                const page = Number(hit.dataset.page)
                const scale = hit.offsetWidth / paper.sizes[page - 1].width
                const within = Math.max(0, (root.scrollTop - hit.offsetTop) / scale + Number(hit.dataset.clipTop || 0))
                onSetAnchor(page, within)
              }}
              className="text-[11px] font-semibold text-muted hover:text-ink transition-colors inline-flex items-center gap-1"
              title="Scroll so this question's answer is at the top, then click"
            >
              <Crosshair size={12} /> Q{question} starts here
            </button>
          )}
          <span className="text-[11px] text-muted">
            {slice ? `question ${question} only` : `${paper.pages} pages`}
          </span>
        </div>
      </div>

      <div className="relative">
        <div ref={scroller} className="overflow-auto p-2.5" style={{ height }}>
          <div className={locked ? 'blur-md select-none pointer-events-none' : ''}>
            {paper.sizes.map((size, i) => {
              const page = i + 1
              // With a slice, everything outside this question's band is not
              // rendered at all, so there is nothing to scroll to and peek at.
              if (slice && (page < slice.from.page || page > slice.to.page)) return null
              const clip = slice
                ? {
                    top: page === slice.from.page ? slice.from.y : 0,
                    bottom: page === slice.to.page ? slice.to.y : size.height,
                  }
                : undefined
              return (
                <PdfPage
                  key={page}
                  paper={paper}
                  pageNumber={page}
                  size={size}
                  width={pageWidth}
                  scroller={scroller}
                  clip={clip}
                  target={scrollTo != null && anchorFor(paper.anchors, scrollTo)?.page === page
                    ? anchorFor(paper.anchors, scrollTo)!.y
                    : undefined}
                  onScrolled={onScrolledTo}
                />
              )
            })}
          </div>
        </div>

        {locked && (
          <div className="absolute inset-0 grid place-items-center bg-bg/70 backdrop-blur-sm p-6 text-center">
            <div>
              <span className="grid place-items-center h-12 w-12 rounded-2xl border border-line bg-black/40 mx-auto mb-3">
                <Lock size={18} className="text-muted" />
              </span>
              <p className="text-sm font-semibold">Mark scheme locked</p>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto leading-relaxed">{lockNote}</p>
              {onUnlock && (
                <button
                  onClick={onUnlock}
                  className="mt-4 h-10 px-4 rounded-xl bg-gradient-to-br from-violet-400 to-fuchsia-500 text-white text-sm font-bold inline-flex items-center gap-2 hover:brightness-110 transition-all"
                >
                  <Eye size={15} /> I have attempted it
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

/**
 * One page. It reserves its exact height straight away from the unscaled page
 * size, so the scrollbar is correct before anything has rendered, and only
 * rasterises once it is near the viewport.
 */
function PdfPage({
  paper, pageNumber, size, width, scroller, target, clip, onScrolled,
}: {
  paper: LoadedPaper
  pageNumber: number
  size: { width: number; height: number }
  width: number
  scroller: React.RefObject<HTMLDivElement | null>
  target?: number
  clip?: { top: number; bottom: number }
  onScrolled?: () => void
}) {
  const holder = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)

  const scale = width / size.width
  const top = clip ? clip.top : 0
  const visible = clip ? Math.max(40, clip.bottom - clip.top) : size.height
  const height = Math.round(visible * scale)

  useEffect(() => {
    const node = holder.current
    const root = scroller.current
    if (!node || !root) return
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setNear(true),
      { root, rootMargin: '900px 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [scroller])

  useEffect(() => {
    if (!near || !canvas.current || width < 240) return
    let cancelled = false
    const el = canvas.current
    renderInto(el, paper.doc, pageNumber, width)
      .catch(() => {})
    return () => { cancelled = true }
  }, [near, width, paper, pageNumber])

  // Scroll this page's question into view. Every page reserves its exact height
  // up front, so offsetTop is correct even for pages not yet rasterised — don't
  // wait for `drawn`, or a question far down the paper can never be reached (it
  // isn't drawn until it's on screen, and it can't come on screen without this
  // scroll). The canvas fills in once the scroll brings it near. Tell the parent
  // afterwards so a later zoom or re-render doesn't yank the view back here.
  useEffect(() => {
    if (target == null) return
    const node = holder.current
    const root = scroller.current
    if (!node || !root) return
    root.scrollTo({ top: node.offsetTop + target * scale - 14, behavior: 'smooth' })
    onScrolled?.()
  }, [target, width, size.width, scroller])

  return (
    <div
      ref={holder}
      data-page={pageNumber}
      data-clip-top={top}
      className="mb-2 mx-auto rounded-lg bg-white overflow-hidden"
      style={{ width, height }}
    >
      <canvas
        ref={canvas}
        className="block"
        style={{ marginTop: clip ? -Math.round(top * scale) : 0 }}
      />
    </div>
  )
}
