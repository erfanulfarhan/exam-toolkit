import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, ChevronDown, Plus, Search, Trash2 } from 'lucide-react'
import { Card, Select, TONES } from '@/components/ui'
import {
  Board, COUNTS, Entry, Level, Scale, allScales, asLetter, best, gradesFor, pointsOf,
} from '@/lib/gpa'
import {
  AWARDS, CATEGORIES, Category, Department, UNIVERSITIES, Verdict, countAtLeast, departmentVerdict,
  bestAcrossSittings,
} from '@/lib/universities'
import { suggest } from '@/lib/subjects'
import { CountUp, Reveal, Stagger, StaggerItem } from '@/components/motion'
import { Link } from '@/lib/router'

const STORE = 'gpa.entries'
const SITTINGS = ['Jan', 'May/June', 'Oct/Nov']
const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 9 }, (_, i) => String(THIS_YEAR + 1 - i))
let nextId = 1
const make = (level: Level, board: Board = 'edexcel'): Entry => ({
  id: nextId++,
  subject: '',
  board,
  scale: level === 'o' && board === 'edexcel' ? 'numeric' : 'letter',
  grade: '',
})

type Saved = { o: Entry[]; a: Entry[] }

export function GpaPage() {
  const [rows, setRows] = useState<Saved>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE) || 'null') as Saved | null
      if (raw?.o && raw?.a) {
        nextId = Math.max(0, ...[...raw.o, ...raw.a].map((e) => e.id)) + 1
        return raw
      }
    } catch { /* fall through to a blank sheet */ }
    return { o: [], a: [] }
  })

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(rows)) }, [rows])

  const update = (level: Level, id: number, patch: Partial<Entry>) =>
    setRows((r) => ({ ...r, [level]: r[level].map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  const remove = (level: Level, id: number) =>
    setRows((r) => ({ ...r, [level]: r[level].filter((e) => e.id !== id) }))
  const add = (level: Level, subject = '', board: Board = 'edexcel') =>
    setRows((r) => ({ ...r, [level]: [...r[level], { ...make(level, board), subject }] }))

  const scales = useMemo(() => allScales(rows.o, rows.a), [rows])
  const oBest = useMemo(() => best(rows.o, 'o'), [rows.o])
  const aBest = useMemo(() => best(rows.a, 'a'), [rows.a])

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <h1 className="font-display text-3xl sm:text-[2.5rem] font-bold tracking-tight leading-[1.1]">
          Your grades as a{' '}
          <span className="bg-gradient-to-r from-[#6EE7B7] via-[#5EEAD4] to-[#22D3EE] bg-clip-text text-transparent">
            GPA
          </span>
        </h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">
          O Level, IGCSE and A Level grades on the scales Bangladeshi universities use. Every
          scale updates as you type, and nothing leaves this browser.
        </p>
      </motion.section>

      <div className="relative z-20 grid lg:grid-cols-2 gap-4 items-start">
        <Panel
          level="o" title="O Level / IGCSE" entries={rows.o} counted={oBest}
          onAdd={(subject, board) => add('o', subject, board)} onUpdate={update} onRemove={remove}
        />
        <Panel
          level="a" title="A Level / IAL" entries={rows.a} counted={aBest}
          onAdd={(subject, board) => add('a', subject, board)} onUpdate={update} onRemove={remove}
        />
      </div>

      <Section title="Where you stand" tone="teal">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scales.map((s) => (
          <Card key={s.key} className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">{s.name}</div>
            {s.combined != null ? (
              <>
                <div className={'font-display font-bold text-4xl leading-none mt-2 tabular-nums ' + TONES.amber.text}>
                  <CountUp value={s.combined} decimals={2} />
                </div>
                {s.threshold != null && (
                  <div className={'text-xs font-semibold mt-2 ' + (s.combined >= s.threshold ? 'text-emerald-400' : 'text-muted')}>
                    {s.combined >= s.threshold ? 'Meets the ' : 'Below the '}
                    {s.threshold.toFixed(2)} needed
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-baseline gap-5 mt-2">
                <div>
                  <div className={'font-display font-bold text-4xl leading-none tabular-nums ' + TONES.teal.text}>
                    <CountUp value={s.o} decimals={2} />
                  </div>
                  <div className="text-[11px] text-muted mt-1">O Level</div>
                </div>
                <div>
                  <div className={'font-display font-bold text-4xl leading-none tabular-nums ' + TONES.violet.text}>
                    <CountUp value={s.a} decimals={2} />
                  </div>
                  <div className="text-[11px] text-muted mt-1">A Level</div>
                </div>
              </div>
            )}
            <p className="text-xs text-muted/90 mt-3 leading-relaxed">{s.note}</p>
          </Card>
        ))}
      </div>
      </Section>

      <Section title="University eligibility">
        <Eligibility o={rows.o} a={rows.a} />
      </Section>
      <Section title="Award eligibility" tone="violet">
        <Awards o={rows.o} a={rows.a} />
      </Section>
      <Section title="Frequently asked questions" tone="teal" defaultOpen={false}>
        <Faq />
      </Section>

      <p className="text-xs text-muted/80 mt-8 leading-relaxed max-w-3xl">
        Unofficial. Universities set their own rules, change them yearly, and most run an
        admission test on top of the grade requirement. Always check the university's own
        admissions page before you rely on any of this.
      </p>
    </>
  )
}

function Panel({
  level, title, entries, counted, onAdd, onUpdate, onRemove,
}: {
  level: Level
  title: string
  entries: Entry[]
  counted: ReturnType<typeof best>
  onAdd: (subject?: string, board?: Board) => void
  onUpdate: (level: Level, id: number, patch: Partial<Entry>) => void
  onRemove: (level: Level, id: number) => void
}) {
  const take = COUNTS[level]
  const spare = Math.max(0, entries.filter((e) => e.grade).length - take)
  const isCounting = (e: Entry) => counted.counting.some((c) => c.id === e.id)

  return (
    <Card className="p-4 sm:p-5 overflow-visible z-20">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted mt-1">
            {entries.filter((e) => e.grade).length} subject{entries.filter((e) => e.grade).length === 1 ? '' : 's'} added
            {spare > 0 && <>, the best {take} count and the other {spare} cannot count against you</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className={'font-display font-bold text-3xl leading-none tabular-nums ' + TONES.teal.text}>
            <CountUp value={counted.gpa} decimals={2} />
          </div>
          <div className="text-[10px] uppercase tracking-[.09em] text-muted mt-1">best {take}</div>
        </div>
      </div>

      <SubjectSearch level={level} taken={entries.map((e) => e.subject)} onAdd={onAdd} />

      <div className="space-y-2.5 mt-3">
        {entries.map((entry, i) => (
          <div key={entry.id} className="rounded-2xl border border-line/70 bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="flex-1 min-w-0 truncate text-sm font-semibold">
                {entry.subject || `Subject ${i + 1}`}
              </span>
              {entry.grade && (
                <span className={
                  'shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ' +
                  (isCounting(entry)
                    ? 'bg-amber-400/15 text-[#82C8E5] border-amber-400/40'
                    : 'text-muted border-line')
                }>
                  {isCounting(entry) ? 'counted' : 'extra'}
                </span>
              )}
              <button
                onClick={() => onRemove(level, entry.id)}
                className="shrink-0 h-9 w-9 grid place-items-center rounded-xl border border-line text-muted hover:text-rose-400 transition-colors"
                aria-label={`Remove subject ${i + 1}`}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <Select
                value={`${entry.board}:${entry.scale}`}
                onChange={(e) => {
                  const [board, scale] = e.target.value.split(':') as [Board, Scale]
                  onUpdate(level, entry.id, { board, scale, grade: '' })
                }}
                className="h-8 text-xs w-auto"
              >
                {level === 'o' ? (
                  <>
                    <option value="edexcel:numeric">Edexcel 9-1</option>
                    <option value="edexcel:letter">Edexcel A*-G</option>
                    <option value="cambridge:letter">Cambridge A*-G</option>
                  </>
                ) : (
                  <>
                    <option value="edexcel:letter">Edexcel IAL</option>
                    <option value="cambridge:letter">Cambridge A Level</option>
                  </>
                )}
              </Select>
              {entry.grade && (
                <span className="text-[11px] text-muted">
                  counts as {asLetter(entry)} · {pointsOf(entry).toFixed(2)} points
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <Select
                value={entry.session ?? ''}
                onChange={(e) => onUpdate(level, entry.id, { session: e.target.value || undefined })}
                className="h-8 text-xs w-auto"
              >
                <option value="">Sitting</option>
                {SITTINGS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Select
                value={entry.year ?? ''}
                onChange={(e) => onUpdate(level, entry.id, { year: e.target.value || undefined })}
                className="h-8 text-xs w-auto"
              >
                <option value="">Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
              <span className="text-[10px] text-muted/70">for award checks</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {gradesFor(level, entry.scale).map((g) => (
                <button
                  key={g}
                  onClick={() => onUpdate(level, entry.id, { grade: entry.grade === g ? '' : g })}
                  className={
                    'h-8 min-w-8 px-2 rounded-lg text-xs font-bold transition-colors border ' +
                    (entry.grade === g
                      ? 'bg-[#82C8E5] text-[#08172a] border-[#82C8E5]'
                      : 'border-line bg-black/25 text-muted hover:text-ink')
                  }
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {counted.counting.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line/60">
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted mb-2">Counting</div>
          <div className="flex flex-wrap gap-1.5">
            {counted.counting.map((c, i) => (
              <span key={c.id} className="text-[11px] px-2 py-1 rounded-md bg-white/[0.05] border border-line">
                {c.subject || `Subject ${i + 1}`} <b className="text-[#82C8E5]">{c.grade}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

/**
 * Every department, judged against the grades entered, grouped by university
 * and filterable. A refusal always says what was short, because "not eligible"
 * on its own tells a student nothing they can act on.
 */
function Eligibility({ o, a }: { o: Entry[]; a: Entry[] }) {
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [openUni, setOpenUni] = useState<string>('')

  const judged = useMemo(() => UNIVERSITIES.map((uni) => {
    const departments = uni.departments.map((d) => ({ dept: d, verdict: departmentVerdict(uni, d, o, a) }))
    return { uni, departments, passing: departments.filter((d) => d.verdict.eligible).length }
  }), [o, a])

  const totals = useMemo(() => {
    const all = judged.flatMap((u) => u.departments)
    return { all: all.length, yes: all.filter((d) => d.verdict.eligible).length }
  }, [judged])

  // Everything blocked by a single requirement, nearest first. A student is far
  // better served by "one grade away from these eleven" than by a page of
  // refusals, and it is the difference between a verdict and a plan.
  const withinReach = useMemo(() => judged
    .flatMap(({ uni, departments }) => departments
      .filter((d) => !d.verdict.eligible && d.verdict.reasons.length === 1)
      .map((d) => ({ uni, dept: d.dept, reason: d.verdict.reasons[0] })))
    .slice(0, 8), [judged])

  const entered = [...o, ...a].filter((e) => e.grade).length

  const visible = (v: { dept: Department; verdict: Verdict }) =>
    (filter === 'all' || (filter === 'yes') === v.verdict.eligible)
    && (category === 'all' || v.dept.category === category)

  return (
    <>
      {entered === 0 && (
        <Card className="p-5 mt-10 text-center">
          <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
            Add your grades above and every department here is checked against them, with the
            reason spelled out wherever you fall short.
          </p>
        </Card>
      )}

      {entered > 0 && (totals.yes > 0 || withinReach.length > 0) && (
        <div className="mt-8 rounded-2xl border border-line bg-gradient-to-br from-[#0047AB]/[0.12] to-transparent p-5">
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div>
              <div className={'font-display font-bold text-4xl leading-none tabular-nums ' + TONES.emerald.text}>
                <CountUp value={totals.yes} />
              </div>
              <div className="text-[11px] text-muted mt-1.5">departments open to you</div>
            </div>
            {withinReach.length > 0 && (
              <div>
                <div className={'font-display font-bold text-4xl leading-none tabular-nums ' + TONES.amber.text}>
                  <CountUp value={withinReach.length} />
                </div>
                <div className="text-[11px] text-muted mt-1.5">one requirement away</div>
              </div>
            )}
          </div>

          {withinReach.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line/60">
              <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted mb-2.5">
                Within reach
              </div>
              <div className="space-y-1.5">
                {withinReach.map(({ uni, dept: d, reason }) => (
                  <div key={uni.id + d.name} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                    <span className="font-semibold">{uni.short}</span>
                    <span className="text-muted truncate">{d.name}</span>
                    <span className="text-[#82C8E5]/90 text-[11px]">{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {entered > 0 && (
      <>
      <h2 className="font-display text-lg font-semibold tracking-tight mt-10 mb-1">
        Every department
      </h2>
      <p className="text-sm text-muted mb-3">
        {totals.yes} of {totals.all} departments across {UNIVERSITIES.length} universities, checked
        against the grades above.
      </p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {([['all', `All ${totals.all}`], ['yes', `Eligible ${totals.yes}`], ['no', `Not eligible ${totals.all - totals.yes}`]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={
              'h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ' +
              (filter === k ? 'border-[#82C8E5]/60 bg-[#82C8E5]/15 text-ink' : 'border-line text-muted hover:text-ink')
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(['all', ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c as Category | 'all')}
            className={
              'h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ' +
              (category === c ? 'border-teal-400/60 bg-[#0047AB]/25 text-ink' : 'border-line text-muted hover:text-ink')
            }
          >
            {c === 'all' ? 'All subjects' : c}
          </button>
        ))}
      </div>

      </>
      )}

      <div className="space-y-2">
        {entered > 0 && judged.map(({ uni, departments, passing }) => {
          const shown = departments.filter(visible)
          if (!shown.length) return null
          const open = openUni === uni.id
          return (
            <Card key={uni.id} className="overflow-hidden">
              <button
                onClick={() => setOpenUni(open ? '' : uni.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="h-9 w-9 shrink-0 grid place-items-center rounded-xl bg-white/[0.06] border border-line text-[11px] font-bold">
                  {uni.short.slice(0, 4)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm truncate">{uni.name}</span>
                  <span className="block text-[11px] text-muted">
                    {uni.type} · {passing} of {uni.departments.length} departments eligible
                  </span>
                </span>
                <span className="hidden sm:block w-24 h-1.5 rounded-full bg-black/40 overflow-hidden shrink-0">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-[#82C8E5] to-[#0047AB]"
                    style={{ width: `${(passing / Math.max(1, uni.departments.length)) * 100}%` }}
                  />
                </span>
                <ChevronDown size={16} className={'shrink-0 text-muted transition-transform ' + (open ? 'rotate-180' : '')} />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                <div className="px-4 pb-4 space-y-1.5">
                  {uni.note && <p className="text-xs text-muted leading-relaxed mb-2">{uni.note}</p>}
                  {shown.map(({ dept: d, verdict }) => (
                    <div key={d.name} className="rounded-xl border border-line/60 bg-black/20 px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{d.name}</div>
                          <div className="text-[11px] text-muted">{d.category}</div>
                        </div>
                        <span className={
                          'shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border ' +
                          (verdict.eligible
                            ? 'bg-emerald-400/15 text-[#82C8E5] border-emerald-400/40'
                            : 'bg-rose-400/10 text-rose-300 border-rose-400/30')
                        }>
                          {verdict.eligible ? 'Eligible' : 'Not eligible'}
                        </span>
                      </div>
                      {!verdict.eligible && (
                        <ul className="mt-1.5 space-y-1">
                          {verdict.reasons.map((r) => (
                            <li key={r} className="text-[11px] text-rose-300/90 leading-relaxed">{r}</li>
                          ))}
                        </ul>
                      )}
                      {d.notes && <p className="text-[11px] text-muted mt-1.5 leading-relaxed">{d.notes}</p>}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted">
                    {uni.admissionTest && <span>Admission test required</span>}
                    {uni.equivalenceRequired && <span>UGC equivalence certificate needed</span>}
                    {uni.source && (
                      <a href={uni.source} target="_blank" rel="noopener noreferrer" className="text-[#82C8E5] hover:text-teal-200 font-semibold">
                        Official admissions page
                      </a>
                    )}
                  </div>
                </div>
                </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )
        })}
      </div>
    </>
  )
}

/** Grade-count awards can be judged here; marks-based ones can only be listed. */
function Awards({ o, a }: { o: Entry[]; a: Entry[] }) {
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-3">
        {AWARDS.map((award) => {
          const checks = (award.needs ?? []).map((n) => {
            const run = bestAcrossSittings(n.level === 'o' ? o : a, n.minGrade, n.sessions)
            return { ...n, have: run.best, undated: run.undated }
          })
          const met = checks.length > 0 && checks.every((c) => c.have >= c.count)
          const missingSittings = checks.some((c) => c.undated > 0)
          return (
            <Card key={award.name} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{award.name}</div>
                  <div className="text-[11px] text-muted">{award.body}</div>
                </div>
                <span className={
                  'shrink-0 text-[10px] font-bold px-2 py-1 rounded-md border ' +
                  (award.infoOnly
                    ? 'text-muted border-line'
                    : met
                      ? 'bg-emerald-400/15 text-[#82C8E5] border-emerald-400/40'
                      : 'text-muted border-line')
                }>
                  {award.infoOnly ? 'Info only' : met ? 'Grades met' : missingSittings ? 'Sittings needed' : 'Not yet'}
                </span>
              </div>
              <ul className="mt-2.5 space-y-1">
                {award.criteria.map((c) => (
                  <li key={c} className="text-[11px] text-muted leading-relaxed flex gap-1.5">
                    <span className="text-muted/50">·</span>{c}
                  </li>
                ))}
              </ul>
              {checks.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-line/60 flex flex-wrap gap-x-4 gap-y-1">
                  {checks.map((c) => (
                    <span key={c.level} className="text-[11px] tabular-nums">
                      <span className="text-muted">{c.level === 'o' ? 'O Level' : 'A Level'} </span>
                      <b className={c.have >= c.count ? 'text-[#82C8E5]' : 'text-muted'}>
                        {c.have}/{c.count}
                      </b>
                      <span className="text-muted">
                        {' '}at {c.minGrade} or above in {c.sessions === 1 ? 'one sitting' : `${c.sessions} consecutive sittings`}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              {!award.infoOnly && (
                <p className="text-[11px] text-muted/80 mt-2 leading-relaxed">
                  {missingSittings
                    ? 'Set the sitting on each subject above: these awards are judged per exam session, and subjects without one are left out of the count.'
                    : 'Counted across your sittings as the awarding body does. Meeting it is worth applying on, not a win.'}
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}

/**
 * Pick a subject by name. Typing narrows the board's own list, and anything not
 * on it can still be added exactly as written, because a retired subject or an
 * unusual one is not a reason to be turned away.
 */
function SubjectSearch({
  level, taken, onAdd,
}: {
  level: Level
  taken: string[]
  onAdd: (subject?: string, board?: Board) => void
}) {
  const [board, setBoard] = useState<Board>('edexcel')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const matches = useMemo(() => {
    const found = suggest(board, level, query)
    const q = query.trim().toLowerCase()
    // Typing a name in full should leave that name, not everything sharing a word.
    const exact = found.filter((f) => f.toLowerCase() === q)
    return (exact.length ? exact : found).slice(0, 8)
  }, [board, level, query])
  const has = (name: string) => taken.some((t) => t.toLowerCase() === name.toLowerCase())

  const choose = (name: string) => {
    onAdd(name, board)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted">Exam board</span>
        {(['edexcel', 'cambridge'] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            className={
              'h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors ' +
              (board === b ? 'border-[#82C8E5]/60 bg-[#82C8E5]/15 text-ink' : 'border-line text-muted hover:text-ink')
            }
          >
            {b === 'edexcel' ? 'Edexcel' : 'Cambridge'}
          </button>
        ))}
        <span className="text-[10px] text-muted/70 hidden sm:inline">applies to what you add next</span>
      </div>
      <p className="text-[11px] text-muted/80 mb-1.5">
        Start typing to find a subject. If yours is not listed, type its name in full and add it as
        your own.
      </p>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (matches[0] || query.trim())) choose(matches[0] ?? query.trim())
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={level === 'o' ? 'Type a subject, e.g. Physics' : 'Type a subject, e.g. Chemistry'}
          className="w-full h-10 pl-9 pr-3 rounded-xl border border-line bg-black/25 text-sm outline-none focus:border-amber-400/60 transition-colors"
        />

        <AnimatePresence>
          {open && (matches.length > 0 || query.trim()) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-30 left-0 right-0 top-12 rounded-xl border border-line bg-bg shadow-2xl origin-top max-h-72 overflow-y-auto overscroll-contain">
            {matches.map((name) => (
              <button
                key={name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(name)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/[0.05] transition-colors"
              >
                {has(name)
                  ? <Check size={14} className="text-emerald-400 shrink-0" />
                  : <Plus size={14} className="text-[#82C8E5] shrink-0" />}
                <span className="flex-1 truncate">{name}</span>
                {has(name) && <span className="text-[10px] text-muted">added</span>}
              </button>
            ))}
            {query.trim() && !matches.some((m) => m.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(query.trim())}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-t border-line/60 hover:bg-white/[0.05] transition-colors"
              >
                <Plus size={14} className="text-muted shrink-0" />
                <span className="truncate">Add &ldquo;{query.trim()}&rdquo; as a custom subject</span>
              </button>
            )}
          </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Section({
  title, tone = 'amber', defaultOpen = true, children,
}: {
  title: string
  tone?: 'amber' | 'teal' | 'violet'
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="overflow-hidden mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 p-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className={'h-2 w-2 rounded-full shrink-0 ' + TONES[tone].dot} />
        <span className="flex-1 font-display font-semibold tracking-tight">{title}</span>
        <ChevronDown size={17} className={'text-muted transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

const QA: { q: string; a: string }[] = [
  {
    q: 'How many of my subjects actually count?',
    a: 'Seven: your five strongest O Levels and your two strongest A Levels. That is the set almost every Bangladeshi university means when its circular refers to "these 7 subjects". Sitting more than five O Levels only helps, because a strong sixth can displace a weaker one from your best five, and a weak one simply sits outside the count. A D in a sixth subject cannot make you ineligible anywhere when your best five are solid. A handful of places count differently and say so plainly: BUET and MIST work from three A Levels, and the government medical colleges take your A Level score from Physics, Chemistry and Biology only.',
  },
  {
    q: 'How is my Edexcel 9-1 grade converted?',
    a: 'It becomes a letter first, because that is what universities score. A 9 or an 8 is an A*, a 7 is an A, a 6 or a 5 is a B, a 4 is a C, a 3 is a D, a 2 is an E and a 1 is an F. Bangladeshi universities publish this table themselves, AUST prints it directly in its admission circular. Every figure on this page, on every scale, is worked out from the converted letter, and each subject card shows you which letter it landed on.',
  },
  {
    q: 'Why does each university give me a different GPA?',
    a: 'Because the same letters are worth different amounts depending on who is reading them. Most private universities use A*/A = 5, B = 4, C = 3, D = 2, E = 1. BRAC removes E grade subjects before it averages, rather than scoring them a point. IBA at Dhaka University pays more for a C, at 3.5, but scores a D or below as nothing at all. BUP does not calculate an average in the first place, it totals points and asks for 26.5. None of these is the real one, which is why they are all shown side by side.',
  },
  {
    q: 'Do I still have to sit an admission test?',
    a: 'Almost always. Meeting the requirement gets you into the exam hall, nothing more. At BUET and IUT the test result alone builds the merit list, and your grades only decide whether you may sit it. There are exceptions worth knowing: UIU will interview instead of testing you if you hold four A grades at O Level or an SAT-I of 1000 or more, NSU accepts an SAT score in place of its test for everything except B.Pharm and LL.B, and IUB considers exemptions case by case for a CGPA of 3.00 or above.',
  },
  {
    q: 'Can I apply before my results come out?',
    a: 'Yes, and most people do. You apply and sit the test as an appeared student, then produce the result before you enrol. NSU says exactly that in its own rules. It matters because Fall deadlines at the big private universities usually land before results are published in August. What you will not find here is a UK-style conditional offer on predicted grades: Bangladeshi universities want the actual result before enrolment.',
  },
  {
    q: 'When do the results come out?',
    a: 'For the May and June 2026 series: Edexcel International A Level on 13 August 2026, Cambridge International AS and A Level on 11 August 2026, and Cambridge IGCSE and O Level on 18 August 2026. January series IAL results land in early March. Since most Fall deadlines fall before those August dates, applying with results still pending is normal.',
  },
  {
    q: 'Why might I still be rejected when this says eligible?',
    a: 'Eligible means you clear the published minimum. It does not mean a seat. For nearly every department listed, the requirement is a gate and the admission test decides who actually gets through it, with far more applicants than places. BUET takes roughly 1,300 students from around 10,000 who sit its test. Requirements also shift each cycle. Use this to decide where applying is worth the fee, then read the current circular before you pay it.',
  },
  {
    q: 'Do the years I sat my exams matter?',
    a: 'More often than students expect, and this is the rule most people miss. Several universities only accept recent results. BRAC takes A Levels from the current year or the two before it. MIST wants O Levels from 2022 or 2023 and A Levels from 2024 or 2025, and IUT is close to that. Jahangirnagar, including IBA-JU, accepts O Levels from 2020 onwards with A Levels from 2024 or 2025. The government medical colleges want A Levels from 2024 or 2025. These windows move every cycle, so check the current circular rather than trusting any calculator on the point.',
  },
  {
    q: 'What if I did not take Mathematics at A Level?',
    a: 'It closes fewer doors than you would think outside engineering. NSU and BRAC will both admit you without it on the condition that you clear an extra three credit maths course during your degree, and IUB and UIU apply the same arrangement to Pharmacy. Engineering is where it is genuinely non-negotiable, and at BUET, IUT and MIST it has to be a strong grade rather than a pass. Dhaka University\'s Science Unit is more flexible than its reputation suggests: it asks for Physics and Chemistry plus either Biology or Mathematics.',
  },
]

function Faq() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <div className="space-y-2">
        {QA.map((item, i) => (
          <Card key={item.q} className="overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left rounded-2xl hover:bg-white/[0.015] transition-colors"
            >
              <span className="font-semibold text-sm">{item.q}</span>
              <ChevronDown
                size={16}
                className={'shrink-0 text-muted transition-transform ' + (open === i ? 'rotate-180' : '')}
              />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-4 pb-4 pt-1.5 text-sm text-muted leading-relaxed max-w-3xl">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
    </>
  )
}
