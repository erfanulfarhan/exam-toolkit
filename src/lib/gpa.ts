/**
 * Grades to the GPAs Bangladeshi universities actually use.
 *
 * There is no single conversion. Most private universities award A* and A five
 * points, B four, C three, D two and E one, then average a fixed number of your
 * best subjects. BRAC drops E grades before averaging rather than scoring them.
 * Engineering universities like AUST look at the O and A Level GPAs added
 * together. So the same grades produce several different numbers, all correct,
 * and the calculator shows them side by side rather than pretending one wins.
 *
 * Nothing here is an admissions decision. Universities publish their own rules
 * and change them yearly.
 */

export type Board = 'edexcel' | 'cambridge'
export type Level = 'o' | 'a'

/** Edexcel numbers its International GCSEs 9 to 1; everything else uses letters. */
export type Scale = 'numeric' | 'letter'

export type Entry = {
  id: number
  subject: string
  board: Board
  scale: Scale
  grade: string
  session?: string
  year?: string
}

export const LETTER_O = ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U']
export const LETTER_A = ['A*', 'A', 'B', 'C', 'D', 'E', 'U']
export const NUMERIC = ['9', '8', '7', '6', '5', '4', '3', '2', '1', 'U']

export function gradesFor(level: Level, scale: Scale): string[] {
  if (level === 'a') return LETTER_A
  return scale === 'numeric' ? NUMERIC : LETTER_O
}

/**
 * Edexcel's own comparability puts 9 at A*, 7 at A, 6 at B, 4 at C, 3 at D and
 * 2 at E, with 8 and 5 straddling a boundary. Universities score the letter, so
 * a number is read across to its letter first and the straddling grades take
 * the higher of the two.
 */
const NUMERIC_AS_LETTER: Record<string, string> = {
  '9': 'A*', '8': 'A*', '7': 'A', '6': 'B', '5': 'B', '4': 'C', '3': 'D', '2': 'E', '1': 'F', U: 'U',
}

/**
 * Point sets. `standard` is what nearly every private university applies. IBA
 * at Dhaka University scores a C higher but throws away anything below it, so
 * the same grades land differently.
 */
export const POINT_SETS = {
  standard: { 'A*': 5, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0, G: 0, U: 0 },
  iba: { 'A*': 5, A: 5, B: 4, C: 3, D: 0, E: 0, F: 0, G: 0, U: 0 },
  // BUP publishes its own points and says outright that anything below D is not
  // counted. Seven subjects at five points is the ceiling, so the total tops out
  // at 35 and the pass mark of 26.5 sits just under four fifths of it.
  bup: { 'A*': 5, A: 5, B: 4, C: 3.5, D: 3, E: 0, F: 0, G: 0, U: 0 },
} as const satisfies Record<string, Record<string, number>>

export type PointSet = keyof typeof POINT_SETS

export function asLetter(entry: Entry): string {
  return entry.scale === 'numeric' ? (NUMERIC_AS_LETTER[entry.grade] ?? 'U') : entry.grade
}

export function pointsOf(entry: Entry, set: PointSet = 'standard'): number {
  return (POINT_SETS[set] as Record<string, number>)[asLetter(entry)] ?? 0
}

/** How many subjects count towards each level's GPA. */
export const COUNTS: Record<Level, number> = { o: 5, a: 2 }

export type Counted = {
  counting: Entry[]
  extra: Entry[]
  gpa: number
}

/**
 * The best N subjects, and the ones left over.
 *
 * Extra subjects never drag the average down: a sixth O Level below your best
 * five simply does not count, which is why the panels say the others cannot
 * count against you. `dropE` is BRAC's rule, where an E is removed from the
 * pool entirely instead of scoring a point.
 */
export function best(
  entries: Entry[], level: Level, dropE = false, set: PointSet = 'standard',
): Counted {
  const pool = entries
    .filter((e) => e.grade && (!dropE || asLetter(e) !== 'E'))
    .map((e) => ({ e, p: pointsOf(e, set) }))
    .sort((a, b) => b.p - a.p)
  const take = COUNTS[level]
  const counting = pool.slice(0, take).map((x) => x.e)
  const extra = pool.slice(take).map((x) => x.e)
  const total = pool.slice(0, take).reduce((s, x) => s + x.p, 0)
  return { counting, extra, gpa: counting.length ? total / counting.length : 0 }
}

export type ScaleResult = {
  key: string
  name: string
  note: string
  o: number
  a: number
  /** Set when a university judges one combined figure rather than two. */
  combined?: number
  threshold?: number
}

/** Every scale the calculator knows, applied to one set of grades. */
export function allScales(oLevels: Entry[], aLevels: Entry[]): ScaleResult[] {
  const standardO = best(oLevels, 'o').gpa
  const standardA = best(aLevels, 'a').gpa
  // BRAC discards an E at O Level but scores it a point at A Level: the scales
  // it publishes for the two levels genuinely differ.
  const bracO = best(oLevels, 'o', true).gpa
  const bracA = best(aLevels, 'a').gpa
  const ibaO = best(oLevels, 'o', false, 'iba').gpa
  const ibaA = best(aLevels, 'a', false, 'iba').gpa
  // BUP totals points over the seven counted subjects rather than averaging.
  const bupO = best(oLevels, 'o', false, 'bup')
  const bupA = best(aLevels, 'a', false, 'bup')
  const bupTotal = [...bupO.counting, ...bupA.counting]
    .reduce((sum, e) => sum + pointsOf(e, 'bup'), 0)
  return [
    {
      key: 'standard',
      name: 'Standard private university',
      note: 'Used by NSU, IUB, AIUB and most private universities. A* and A are 5, B is 4, C is 3, D is 2, E is 1.',
      o: standardO,
      a: standardA,
    },
    {
      key: 'brac',
      name: 'BRAC University',
      note: 'BRAC asks for 2.50 at each level. An E is discarded at O Level, but still scores a point at A Level.',
      o: bracO,
      a: bracA,
    },
    {
      key: 'combined',
      name: 'O Level and A Level added together',
      note: 'Engineering universities such as AUST judge the two GPAs as one total.',
      o: standardO,
      a: standardA,
      combined: standardO + standardA,
      threshold: 7,
    },
    {
      key: 'bup',
      name: 'BUP points total',
      note: 'BUP does not average. It totals points over five O Levels and two A Levels on its own scale, where a C is 3.5 and anything below D scores nothing, and asks for 26.5 out of a possible 35.',
      o: bupO.gpa,
      a: bupA.gpa,
      combined: bupTotal,
      threshold: 26.5,
    },
    {
      key: 'iba',
      name: 'IBA, Dhaka University',
      note: "Dhaka University's circular scores A at 5, B at 4, C at 3, and a D at nothing at all.",
      o: ibaO,
      a: ibaA,
    },
  ]
}
