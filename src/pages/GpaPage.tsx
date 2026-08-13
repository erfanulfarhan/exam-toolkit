import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Plus, X } from 'lucide-react'
import { Card, Field, NumInput, Segmented, Select, TONES } from '@/components/ui'

/**
 * Grades to a GPA.
 *
 * Bangladeshi universities take O and A Levels on the national 5.00 scale, the
 * conversion an equivalence certificate applies: A* and A are 5, B is 4, C is
 * 3, D is 2. Most institutions ignore E grades outright, so that is the
 * default here rather than scoring them as a pass. The 4.00 scale is the one
 * universities abroad ask for.
 *
 * Institutions differ on the details, which is why the counted subjects and the
 * treatment of E are both left in the student's hands instead of being fixed.
 */

type Scale = 'bd' | 'us'
type Level = 'olevel' | 'alevel'

const GRADES = ['A*', 'A', 'B', 'C', 'D', 'E', 'U'] as const
type Grade = (typeof GRADES)[number]

const POINTS: Record<Scale, Record<Grade, number>> = {
  bd: { 'A*': 5, A: 5, B: 4, C: 3, D: 2, E: 1, U: 0 },
  us: { 'A*': 4, A: 4, B: 3, C: 2, D: 1, E: 0, U: 0 },
}

const SCALE_MAX: Record<Scale, number> = { bd: 5, us: 4 }

type Row = { id: number; subject: string; grade: Grade }

let nextId = 1
const row = (subject = '', grade: Grade = 'A'): Row => ({ id: nextId++, subject, grade })

export function GpaPage() {
  const [scale, setScale] = useState<Scale>('bd')
  const [level, setLevel] = useState<Level>('olevel')
  const [countE, setCountE] = useState(false)
  const [best, setBest] = useState<string>('5')
  const [rows, setRows] = useState<Row[]>(() => [row('', 'A'), row('', 'A'), row('', 'A'), row('', 'B'), row('', 'B')])

  const update = (id: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const result = useMemo(() => {
    // E and U are dropped unless asked for, matching the universities that say
    // outright that an E grade is not considered.
    const counted = rows.filter((r) => (countE ? r.grade !== 'U' : r.grade !== 'E' && r.grade !== 'U'))
    const scored = counted
      .map((r) => ({ ...r, points: POINTS[scale][r.grade] }))
      .sort((a, b) => b.points - a.points)
    const limit = Math.max(1, Math.min(Number(best) || scored.length, scored.length))
    const used = scored.slice(0, limit)
    const total = used.reduce((s, r) => s + r.points, 0)
    return {
      gpa: used.length ? total / used.length : 0,
      used,
      dropped: scored.length - used.length,
      ignored: rows.length - counted.length,
    }
  }, [rows, scale, best, countE])

  const max = SCALE_MAX[scale]

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
        <p className="text-muted mt-3 max-w-xl leading-relaxed">
          O Level, IGCSE and A Level grades on the 5.00 scale Bangladeshi universities use, or
          the 4.00 scale asked for abroad. Nothing is saved or sent anywhere.
        </p>
      </motion.section>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="p-5">
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <Field label="Scale">
              <Segmented<Scale>
                id="gpa-scale"
                tone="teal"
                value={scale}
                onChange={setScale}
                options={[
                  { value: 'bd', label: 'Bangladesh 5.00' },
                  { value: 'us', label: 'Abroad 4.00' },
                ]}
              />
            </Field>
            <Field label="Level">
              <Segmented<Level>
                id="gpa-level"
                tone="violet"
                value={level}
                onChange={(v) => { setLevel(v); setBest(v === 'olevel' ? '5' : '3') }}
                options={[
                  { value: 'olevel', label: 'O Level / IGCSE' },
                  { value: 'alevel', label: 'A Level / IAL' },
                ]}
              />
            </Field>
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.id} className="flex gap-2">
                <input
                  value={r.subject}
                  onChange={(e) => update(r.id, { subject: e.target.value })}
                  placeholder={`Subject ${i + 1}`}
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-line bg-black/25 text-sm outline-none focus:border-teal-400/60 transition-colors"
                />
                <Select
                  value={r.grade}
                  onChange={(e) => update(r.id, { grade: e.target.value as Grade })}
                  className="h-10 w-24 shrink-0"
                >
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
                <button
                  onClick={() => setRows((x) => (x.length > 1 ? x.filter((y) => y.id !== r.id) : x))}
                  className="shrink-0 h-10 w-10 grid place-items-center rounded-xl border border-line text-muted hover:text-rose-400 transition-colors"
                  aria-label={`Remove subject ${i + 1}`}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setRows((r) => [...r, row()])}
            className="mt-3 w-full h-10 rounded-xl border border-dashed border-line text-sm font-semibold text-muted hover:text-ink hover:border-muted transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={15} /> Add a subject
          </button>

          <div className="mt-5 pt-4 border-t border-line/60 flex flex-wrap items-end gap-4">
            <Field label="Count your best" hint={`of ${rows.length} subjects`}>
              <NumInput
                value={best}
                min={1}
                max={rows.length}
                onChange={(e) => setBest(e.target.value)}
                className="h-10 w-24"
              />
            </Field>
            <label className="flex items-center gap-2 h-10 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={countE}
                onChange={(e) => setCountE(e.target.checked)}
                className="h-4 w-4 rounded accent-teal-400"
              />
              Count E grades
            </label>
          </div>
        </Card>

        <Card className="p-5 lg:sticky lg:top-20">
          <div className="text-[11px] font-semibold uppercase tracking-[.09em] text-muted">
            {scale === 'bd' ? 'GPA (5.00 scale)' : 'GPA (4.00 scale)'}
          </div>
          <div className={'font-display font-bold text-5xl leading-none mt-2 ' + TONES.teal.text}>
            {result.gpa.toFixed(2)}
            <span className="text-muted text-xl font-normal">/{max.toFixed(2)}</span>
          </div>

          <p className="text-xs text-muted mt-3 leading-relaxed">
            Averaged over {result.used.length} subject{result.used.length === 1 ? '' : 's'}
            {result.dropped > 0 && <>, keeping your best and setting aside {result.dropped} lower</>}
            {result.ignored > 0 && <>. {result.ignored} E or U grade{result.ignored === 1 ? '' : 's'} not counted</>}.
          </p>

          {result.used.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line/60 space-y-1.5">
              {result.used.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-muted">{r.subject || `Subject ${i + 1}`}</span>
                  <span className="shrink-0 tabular-nums">
                    <b>{r.grade}</b> <span className="text-muted">· {r.points.toFixed(2)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted/80 mt-4 leading-relaxed">
            The 5.00 scale follows the equivalence universities apply: A* and A are 5, B is 4,
            C is 3, D is 2. Institutions differ on how many subjects count and whether an E is
            considered at all, so check the rules for the one you are applying to.
          </p>
        </Card>
      </div>
    </>
  )
}
