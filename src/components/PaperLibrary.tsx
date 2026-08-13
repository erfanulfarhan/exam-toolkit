import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronRight, FolderOpen, Lock, TriangleAlert } from 'lucide-react'
import { Card, TONES } from '@/components/ui'
import {
  LibFile, PaperChoice, PaperPair, SubjectRef, fetchSubjects, fetchSubjectFiles,
  groupBySession, pairPapers, paperChoices, unlock,
} from '@/lib/library'

type OnOpen = (choice: PaperChoice, siblings: PaperChoice[]) => void

/**
 * Browse papers as a tree: board → level → subject → sitting → paper. Opening
 * the library fetches only the board/level/subject structure; a subject's
 * papers load the moment it's expanded, so it stays fast however large the
 * archive grows.
 */
export function PaperLibrary({ onOpen }: { onOpen: OnOpen }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'locked' | 'unconfigured' | 'error'>('loading')
  const [subjects, setSubjects] = useState<SubjectRef[]>([])
  const [openBoard, setOpenBoard] = useState('')
  const [openLevel, setOpenLevel] = useState('')       // "Board::Level"
  const [openPrefix, setOpenPrefix] = useState('')     // the expanded subject
  const [openSession, setOpenSession] = useState('')
  const [withSolutions, setWithSolutions] = useState(false)
  const [activeFiles, setActiveFiles] = useState<LibFile[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const cache = useRef(new Map<string, LibFile[]>())

  async function loadTree() {
    try {
      const tree = await fetchSubjects()
      if (tree.locked) { setStatus('locked'); return }
      if (!tree.configured) { setStatus('unconfigured'); return }
      setSubjects(tree.subjects)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }
  useEffect(() => { loadTree() }, [])

  const boards = useMemo(() => [...new Set(subjects.map((s) => s.board))].sort(), [subjects])
  const levelsOf = (board: string) =>
    [...new Set(subjects.filter((s) => s.board === board).map((s) => s.level))].sort()
  const subjectsOf = (board: string, level: string) =>
    subjects.filter((s) => s.board === board && s.level === level)
      .sort((a, b) => a.subject.localeCompare(b.subject))

  // Load the expanded subject's papers, lazily and cached.
  useEffect(() => {
    let cancelled = false
    if (!openPrefix) { setActiveFiles([]); return }
    const ref = subjects.find((s) => s.prefix === openPrefix)
    if (!ref) { setActiveFiles([]); return }
    const cached = cache.current.get(openPrefix)
    if (cached) { setActiveFiles(cached); return }
    setFilesLoading(true)
    fetchSubjectFiles(ref)
      .then((files) => { if (!cancelled) { cache.current.set(openPrefix, files); setActiveFiles(files) } })
      .catch(() => { if (!cancelled) setError('Those papers could not be loaded.') })
      .finally(() => { if (!cancelled) setFilesLoading(false) })
    return () => { cancelled = true }
  }, [openPrefix, subjects])

  const pairs = useMemo(
    () => pairPapers(activeFiles).filter((p) => !withSolutions || !!p.ms),
    [activeFiles, withSolutions],
  )
  const sessions = useMemo(() => groupBySession(pairs), [pairs])
  // Every paper as a switchable choice, keyed for lookup; the ones with a mark
  // scheme are the siblings the viewer can step between.
  const choiceByKey = useMemo(() => {
    const all = paperChoices(pairs)
    return { map: new Map(all.map((c) => [c.key, c])), siblings: all.filter((c) => !!c.ms) }
  }, [pairs])

  if (status === 'loading') {
    return <Card className="p-5"><p className="text-sm text-muted">Opening your library…</p></Card>
  }
  if (status === 'error' || status === 'unconfigured') {
    return <Card className="p-5"><p className="text-sm text-muted">The library isn't reachable right now. Try again in a moment.</p></Card>
  }
  if (status === 'locked') {
    return (
      <Card className="p-5 text-left">
        <span className={'grid place-items-center h-11 w-11 rounded-2xl bg-gradient-to-br text-white mb-3 ' + TONES.violet.grad}>
          <Lock size={20} />
        </span>
        <div className="font-display font-semibold">Your library is locked</div>
        <p className="text-xs text-muted mt-1 max-w-sm leading-relaxed">
          Enter the library password to load your papers. This device stays unlocked afterwards.
        </p>
        <form
          className="flex flex-wrap items-center gap-2 mt-4"
          onSubmit={async (e) => {
            e.preventDefault(); setError(''); setBusy('Unlocking…')
            try { await unlock(password); setPassword(''); setStatus('loading'); await loadTree() }
            catch (err) { setError((err as Error).message) } finally { setBusy('') }
          }}
        >
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Library password" autoComplete="current-password"
            className="h-10 px-3 rounded-xl border border-line bg-black/25 text-sm outline-none focus:border-violet-400/60 transition-colors"
          />
          <button type="submit" disabled={!!busy || !password}
            className="h-10 px-4 rounded-xl bg-gradient-to-br from-[#0047AB] to-[#000080] text-white text-sm font-bold inline-flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-60">
            {busy || 'Unlock'}
          </button>
        </form>
        {error && <p className="text-sm text-rose-400 mt-3">{error}</p>}
      </Card>
    )
  }

  return (
    <Card className="p-3 sm:p-4 text-left">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <div className="text-[11px] font-semibold uppercase tracking-[.12em] text-muted">Past papers</div>
        <button
          onClick={() => setWithSolutions((v) => !v)}
          className={
            'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ' +
            (withSolutions
              ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40'
              : 'text-muted border-line hover:text-ink')
          }
          title="Only show papers that have a mark scheme"
        >
          With solutions only
        </button>
      </div>
      {boards.length === 0 ? (
        <p className="text-sm text-muted py-4 px-1">No papers yet.</p>
      ) : (
        <div className="space-y-1">
          {boards.map((board) => {
            const boardOpen = openBoard === board
            return (
              <div key={board}>
                <Row depth={0} icon={<FolderOpen size={16} className="text-amber-300" />}
                  label={board} bold accent chevron={boardOpen}
                  onClick={() => { setOpenBoard(boardOpen ? '' : board); setOpenLevel(''); setOpenPrefix('') }} />
                {boardOpen && levelsOf(board).map((level) => {
                  const levelKey = `${board}::${level}`
                  const levelOpen = openLevel === levelKey
                  return (
                    <div key={levelKey}>
                      <Row depth={1} icon={<FolderIcon />} label={level} chevron={levelOpen}
                        onClick={() => { setOpenLevel(levelOpen ? '' : levelKey); setOpenPrefix('') }} />
                      {levelOpen && subjectsOf(board, level).map((ref) => {
                        const subjOpen = openPrefix === ref.prefix
                        return (
                          <div key={ref.prefix}>
                            <Row depth={2} icon={<FolderIcon />} label={ref.subject} chevron={subjOpen}
                              onClick={() => { setOpenPrefix(subjOpen ? '' : ref.prefix); setOpenSession('') }} />
                            {subjOpen && (
                              filesLoading ? (
                                <p className="text-sm text-muted py-3 pl-14">Loading…</p>
                              ) : sessions.length === 0 ? (
                                <p className="text-sm text-muted py-3 pl-14">No papers found.</p>
                              ) : sessions.map((g) => {
                                const sesOpen = openSession === `${ref.prefix}::${g.key}`
                                return (
                                  <div key={g.key}>
                                    <Row depth={3} icon={<Calendar size={13} className="text-muted" />}
                                      label={g.label} count={g.papers.length} chevron={sesOpen}
                                      onClick={() => setOpenSession(sesOpen ? '' : `${ref.prefix}::${g.key}`)} />
                                    {sesOpen && g.papers.map((p) => {
                                      const choice = choiceByKey.map.get(p.key)
                                      return choice ? (
                                        <PaperRow key={p.key} pair={p} choice={choice}
                                          siblings={choiceByKey.siblings} onOpen={onOpen} />
                                      ) : null
                                    })}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

const FolderIcon = () => <FolderOpen size={15} className="text-muted" />

function Row({
  depth, icon, label, count, chevron, bold, accent, onClick,
}: {
  depth: number
  icon: ReactNode
  label: string
  count?: number
  chevron: boolean
  bold?: boolean
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 py-2 pr-2 rounded-lg text-left hover:bg-white/[0.04] transition-colors"
      style={{ paddingLeft: 8 + depth * 20 }}
    >
      <ChevronRight size={14} className={'text-muted shrink-0 transition-transform ' + (chevron ? 'rotate-90' : '')} />
      <span className="shrink-0">{icon}</span>
      <span className={
        'flex-1 truncate ' +
        (bold ? 'font-display font-semibold ' : 'text-sm ') +
        (accent ? 'text-amber-300' : '')
      }>{label}</span>
      {count != null && <span className="text-[11px] text-muted">{count}</span>}
    </button>
  )
}

function PaperRow({
  pair, choice, siblings, onOpen,
}: {
  pair: PaperPair
  choice: PaperChoice
  siblings: PaperChoice[]
  onOpen: OnOpen
}) {
  return (
    <button
      onClick={() => onOpen(choice, siblings)}
      className="w-full flex items-center gap-3 py-2 pr-3 rounded-lg text-left hover:bg-white/[0.04] transition-colors"
      style={{ paddingLeft: 8 + 4 * 20 }}
    >
      <span className="font-semibold text-sm flex-1 truncate">{pair.unit}</span>
      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-400/15 text-teal-300 border border-teal-400/30">QP</span>
      {pair.ms
        ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">MS</span>
        : <span className="text-[11px] px-2 py-0.5 rounded-md text-muted/60 border border-line inline-flex items-center gap-1"><TriangleAlert size={10} /> no MS</span>}
    </button>
  )
}
