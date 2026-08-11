import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Eye, FileUp, Lock, RotateCcw } from 'lucide-react'
import { Card, Field, NumInput, Segmented, Select, TONES } from '@/components/ui'
import { Anchor, LoadedPaper, anchorFor, loadPdf, paperKey, questionList, renderPage } from '@/lib/paper'

type Mode = 'question' | 'full'
type Progress = Record<number, { attempted: boolean; marks?: number }>

export function PracticePage() {
  const [qp, setQp] = useState<LoadedPaper | null>(null)
  const [ms, setMs] = useState<LoadedPaper | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<Mode>('question')
  const [current, setCurrent] = useState(1)
  const [storeKey, setStoreKey] = useState('')
  const [progress, setProgress] = useState<Progress>({})

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

  const pick = useCallback(async (which: 'qp' | 'ms', file: File) => {
    setError('')
    setBusy(which === 'qp' ? 'Reading the question paper…' : 'Reading the mark scheme…')
    try {
      const loaded = await loadPdf(file, file.name)
      if (which === 'qp') {
        setQp(loaded)
        setStoreKey(await paperKey(file))
      } else {
        setMs(loaded)
      }
    } catch {
      setError('That file could not be opened as a PDF.')
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

  if (!qp || !ms) {
    return (
      <Setup
        qp={qp}
        ms={ms}
        busy={busy}
        error={error}
        onPick={pick}
      />
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
            {qp.label.replace(/\.pdf$/i, '')}
          </h1>
          <p className="text-sm text-muted mt-1">
            {questions.length} questions found · {done} attempted
            {total > 0 && <> · {total} marks self-scored</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => { setQp(null); setMs(null); setProgress({}); setCurrent(1) }}
            className="h-10 px-3 rounded-xl border border-line text-sm font-semibold text-muted hover:text-ink transition-colors inline-flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> New paper
          </button>
        </div>
      </div>

      {mode === 'question' && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {questions.map((n) => (
            <button
              key={n}
              onClick={() => setCurrent(n)}
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

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Pane
          title="Question paper"
          tone="teal"
          paper={qp}
          question={mode === 'question' ? current : undefined}
        />

        <div className="relative">
          <Pane
            title="Mark scheme"
            tone="violet"
            paper={ms}
            question={mode === 'question' ? current : undefined}
            locked={mode === 'question' ? !attempted(current) : questions.some((n) => !attempted(n))}
            lockNote={
              mode === 'question'
                ? `Answer question ${current} first.`
                : 'Full paper view unlocks once every question is attempted.'
            }
            onUnlock={mode === 'question' ? () => markAttempted(current) : undefined}
          />
        </div>
      </div>

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
              Running total <b className="text-ink tabular-nums">{total}</b>. Put this into the{' '}
              <a href="/calculator" className="text-teal-300 font-semibold hover:text-teal-200">
                grade calculator
              </a>{' '}
              to see where it lands.
            </div>
          </div>
        </Card>
      )}
    </>
  )
}

function Setup({
  qp, ms, busy, error, onPick,
}: {
  qp: LoadedPaper | null
  ms: LoadedPaper | null
  busy: string | null
  error: string
  onPick: (which: 'qp' | 'ms', file: File) => void
}) {
  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="font-display text-3xl sm:text-[2.75rem] font-bold tracking-tight leading-[1.1] max-w-2xl">
          Mark yourself{' '}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
            without cheating yourself
          </span>
        </h1>
        <p className="text-muted mt-3 max-w-xl leading-relaxed">
          Open a question paper beside its mark scheme. Each answer stays locked until you say you
          have attempted that question, so you cannot read your way through a paper and call it
          revision. Works with any board, and with your school mocks.
        </p>
      </motion.section>

      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
        <Drop label="Question paper" tone="teal" loaded={qp} onFile={(f) => onPick('qp', f)} />
        <Drop label="Mark scheme" tone="violet" loaded={ms} onFile={(f) => onPick('ms', f)} />
      </div>

      {busy && <p className="text-sm text-muted mt-4">{busy}</p>}
      {error && <p className="text-sm text-rose-400 mt-4">{error}</p>}

      <p className="text-xs text-muted/80 mt-6 max-w-2xl leading-relaxed">
        Your files stay on your device. They are read in the browser and never uploaded, which is why
        this works offline and with papers only your school has.
      </p>
    </>
  )
}

function Drop({
  label, tone, loaded, onFile,
}: {
  label: string
  tone: 'teal' | 'violet'
  loaded: LoadedPaper | null
  onFile: (file: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <Card
      className={
        'p-5 border-dashed transition-colors cursor-pointer ' +
        (over ? 'border-violet-400/60' : loaded ? 'border-emerald-400/40' : '')
      }
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
    >
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <span className={'grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br text-white mb-3 ' + TONES[tone].grad}>
        {loaded ? <Check size={20} /> : <FileUp size={20} />}
      </span>
      <div className="font-display font-semibold">{label}</div>
      {loaded ? (
        <p className="text-xs text-muted mt-1 break-words">
          {loaded.label} · {loaded.pages} pages · {loaded.anchors.length} questions found
        </p>
      ) : (
        <p className="text-xs text-muted mt-1">Click, or drop a PDF here.</p>
      )}
    </Card>
  )
}

function Pane({
  title, tone, paper, question, locked, lockNote, onUnlock,
}: {
  title: string
  tone: 'teal' | 'violet'
  paper: LoadedPaper
  question?: number
  locked?: boolean
  lockNote?: string
  onUnlock?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState(0)

  // Render every page once into the scroll column, then scroll to a question.
  useEffect(() => {
    let cancelled = false
    const node = host.current
    if (!node) return
    node.innerHTML = ''
    setRendered(0)

    ;(async () => {
      const width = node.clientWidth || 520
      for (let p = 1; p <= paper.pages; p++) {
        if (cancelled) return
        const { canvas } = await renderPage(paper.doc, p, width)
        if (cancelled) return
        canvas.dataset.page = String(p)
        canvas.className = 'block w-full rounded-lg mb-2 bg-white'
        node.appendChild(canvas)
        setRendered(p)
      }
    })()

    return () => { cancelled = true }
  }, [paper])

  useEffect(() => {
    if (!question || rendered < paper.pages) return
    const anchor: Anchor | undefined = anchorFor(paper.anchors, question)
    const node = host.current
    const box = scroller.current
    if (!anchor || !node || !box) return
    const canvas = node.querySelector<HTMLCanvasElement>(`canvas[data-page="${anchor.page}"]`)
    if (!canvas) return
    // The anchor y is in unscaled PDF points; scale it to the rendered height.
    const ratio = canvas.clientHeight / (canvas.height / (canvas.width / canvas.clientWidth))
    box.scrollTo({ top: canvas.offsetTop + anchor.y * ratio - 12, behavior: 'smooth' })
  }, [question, rendered, paper])

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-line/60">
        <span className={'text-xs font-semibold uppercase tracking-[.09em] ' + TONES[tone].text}>
          {title}
        </span>
        <span className="text-[11px] text-muted">
          {rendered < paper.pages ? `rendering ${rendered}/${paper.pages}` : `${paper.pages} pages`}
        </span>
      </div>

      <div className="relative">
        <div ref={scroller} className="max-h-[74vh] overflow-y-auto p-2">
          <div ref={host} className={locked ? 'blur-md select-none pointer-events-none' : ''} />
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
