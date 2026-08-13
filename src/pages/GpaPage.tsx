import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { Card, Select, TONES } from '@/components/ui'
import {
  Board, COUNTS, Entry, Level, Scale, allScales, asLetter, best, gradesFor, pointsOf,
} from '@/lib/gpa'

const STORE = 'gpa.entries'
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
    return { o: [make('o')], a: [make('a')] }
  })

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify(rows)) }, [rows])

  const update = (level: Level, id: number, patch: Partial<Entry>) =>
    setRows((r) => ({ ...r, [level]: r[level].map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
  const remove = (level: Level, id: number) =>
    setRows((r) => ({ ...r, [level]: r[level].filter((e) => e.id !== id) }))
  const add = (level: Level) =>
    setRows((r) => ({ ...r, [level]: [...r[level], make(level, r[level].at(-1)?.board ?? 'edexcel')] }))

  const scales = useMemo(() => allScales(rows.o, rows.a), [rows])
  const oBest = useMemo(() => best(rows.o, 'o'), [rows.o])
  const aBest = useMemo(() => best(rows.a, 'a'), [rows.a])

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="font-display text-3xl sm:text-[2.5rem] font-bold tracking-tight leading-[1.1]">
          Your grades as a{' '}
          <span className="bg-gradient-to-r from-teal-300 via-sky-400 to-fuchsia-500 bg-clip-text text-transparent">
            GPA
          </span>
        </h1>
        <p className="text-muted mt-3 max-w-2xl leading-relaxed">
          O Level, IGCSE and A Level grades on the scales Bangladeshi universities use. Every
          scale updates as you type, and nothing leaves this browser.
        </p>
      </motion.section>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Panel
          level="o" title="O Level / IGCSE" entries={rows.o} counted={oBest}
          onAdd={() => add('o')} onUpdate={update} onRemove={remove}
        />
        <Panel
          level="a" title="A Level / IAL" entries={rows.a} counted={aBest}
          onAdd={() => add('a')} onUpdate={update} onRemove={remove}
        />
      </div>

      <h2 className="font-display text-xl font-semibold tracking-tight mt-8 mb-3">
        Where you stand
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scales.map((s) => (
          <Card key={s.key} className="p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">{s.name}</div>
            {s.combined != null ? (
              <>
                <div className={'font-display font-bold text-4xl leading-none mt-2 ' + TONES.amber.text}>
                  {s.combined.toFixed(2)}
                </div>
                {s.threshold != null && (
                  <div className={'text-xs font-semibold mt-2 ' + (s.combined >= s.threshold ? 'text-emerald-400' : 'text-muted')}>
                    {s.combined >= s.threshold ? 'Meets the ' : 'Below the '}
                    {s.threshold.toFixed(2)} AUST asks for
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-baseline gap-5 mt-2">
                <div>
                  <div className={'font-display font-bold text-4xl leading-none ' + TONES.teal.text}>
                    {s.o.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-muted mt-1">O Level</div>
                </div>
                <div>
                  <div className={'font-display font-bold text-4xl leading-none ' + TONES.violet.text}>
                    {s.a.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-muted mt-1">A Level</div>
                </div>
              </div>
            )}
            <p className="text-xs text-muted/90 mt-3 leading-relaxed">{s.note}</p>
          </Card>
        ))}
      </div>

      <Faq />

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
  onAdd: () => void
  onUpdate: (level: Level, id: number, patch: Partial<Entry>) => void
  onRemove: (level: Level, id: number) => void
}) {
  const take = COUNTS[level]
  const spare = Math.max(0, entries.filter((e) => e.grade).length - take)
  const isCounting = (e: Entry) => counted.counting.some((c) => c.id === e.id)

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted mt-1">
            {entries.filter((e) => e.grade).length} subject{entries.filter((e) => e.grade).length === 1 ? '' : 's'} added
            {spare > 0 && <>, the best {take} count and the other {spare} cannot count against you</>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className={'font-display font-bold text-3xl leading-none ' + TONES.teal.text}>
            {counted.gpa.toFixed(2)}
          </div>
          <div className="text-[10px] uppercase tracking-[.09em] text-muted mt-1">best {take}</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {entries.map((entry, i) => (
          <div key={entry.id} className="rounded-2xl border border-line/70 bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <input
                value={entry.subject}
                onChange={(e) => onUpdate(level, entry.id, { subject: e.target.value })}
                placeholder={`Subject ${i + 1}, e.g. Physics`}
                className="flex-1 min-w-0 h-9 px-3 rounded-xl border border-line bg-black/25 text-sm outline-none focus:border-teal-400/60 transition-colors"
              />
              {entry.grade && (
                <span className={
                  'shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ' +
                  (isCounting(entry)
                    ? 'bg-amber-400/15 text-amber-300 border-amber-400/40'
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

            <div className="flex flex-wrap gap-1">
              {gradesFor(level, entry.scale).map((g) => (
                <button
                  key={g}
                  onClick={() => onUpdate(level, entry.id, { grade: entry.grade === g ? '' : g })}
                  className={
                    'h-8 min-w-8 px-2 rounded-lg text-xs font-bold transition-colors border ' +
                    (entry.grade === g
                      ? 'bg-amber-400 text-black border-amber-400'
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

      <button
        onClick={onAdd}
        className="mt-3 w-full h-10 rounded-xl border border-dashed border-line text-sm font-semibold text-muted hover:text-ink hover:border-muted transition-colors inline-flex items-center justify-center gap-1.5"
      >
        <Plus size={15} /> Add a subject
      </button>

      {counted.counting.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line/60">
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted mb-2">Counting</div>
          <div className="flex flex-wrap gap-1.5">
            {counted.counting.map((c, i) => (
              <span key={c.id} className="text-[11px] px-2 py-1 rounded-md bg-white/[0.05] border border-line">
                {c.subject || `Subject ${i + 1}`} <b className="text-amber-300">{c.grade}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

const QA: { q: string; a: string }[] = [
  {
    q: 'How many of my subjects actually count?',
    a: 'Your best five O Levels and your best two A Levels, which is what most private universities average. Anything beyond that is kept on your list but cannot pull the number down, so there is no harm in adding every subject you sat.',
  },
  {
    q: 'How is my Edexcel 9-1 grade converted?',
    a: 'Numbers are read across to letters first, because universities score the letter. Following Edexcel\'s own comparability: 9 is A*, 8 and 7 are A, 6 and 5 are B, 4 is C, 3 is D and 2 is E. Each card shows the letter and the points it earned.',
  },
  {
    q: 'Why do different universities give me a different GPA?',
    a: 'Because they use different rules on the same grades. Most award an E one point; BRAC removes E subjects before averaging instead. Engineering universities such as AUST add your O and A Level GPAs into a single figure. All of the numbers shown are correct, just for different places.',
  },
  {
    q: 'Do I need an admission test even if I qualify?',
    a: 'Usually yes. The GPA is a threshold to be allowed to sit the test, not an offer. Nearly every university in Bangladesh runs its own admission test or interview afterwards.',
  },
  {
    q: 'Why might a university still reject me when this says I qualify?',
    a: 'Meeting the published minimum only makes your application valid. Places are limited and competitive, departments can ask for specific subjects, and requirements change from year to year. Treat this as a check that you are not below the bar, not a prediction.',
  },
  {
    q: 'What if I did not take Mathematics at A Level?',
    a: 'It rules out most engineering and computer science departments, which ask for it by name, but not business, law, social science or many science programmes. The requirement is set per department, so check the one you want.',
  },
]

function Faq() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <h2 className="font-display text-xl font-semibold tracking-tight mt-8 mb-3">
        Frequently asked questions
      </h2>
      <div className="space-y-2">
        {QA.map((item, i) => (
          <Card key={item.q} className="overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="font-semibold text-sm">{item.q}</span>
              <ChevronDown
                size={16}
                className={'shrink-0 text-muted transition-transform ' + (open === i ? 'rotate-180' : '')}
              />
            </button>
            {open === i && (
              <p className="px-4 pb-4 -mt-1 text-sm text-muted leading-relaxed max-w-3xl">{item.a}</p>
            )}
          </Card>
        ))}
      </div>
    </>
  )
}
