// Starting effort ratings for IAL units, distilled from community consensus
// (r/6thForm, The Student Room, tutor write-ups). Difficulty is subjective, so
// these are only the planner's opening guess: every unit can be re-rated in
// the UI, and the plan re-solves against the student's own ratings.
//
// 1 = comfortable … 5 = brutal. Keyed by unit code.
export type Diff = { score: number; note: string }

export const DEFAULT_EFFORT = 3

export const DIFFICULTY: Record<string, Diff> = {
  // Chemistry
  WCH11: { score: 3, note: 'Structure, bonding and moles: heavy on calculations but very predictable.' },
  WCH12: { score: 3, note: 'Energetics, group chemistry and intro organic; moderate.' },
  WCH13: { score: 2, note: 'Practical skills paper: a small syllabus you can drill.' },
  WCH14: { score: 4, note: 'Rates, equilibria and further organic: mechanism- and calculation-heavy.' },
  WCH15: { score: 5, note: 'Transition metals and organic nitrogen: dense theory, colours and mechanisms, historically low boundaries. Widely called the hardest IAL unit.' },
  WCH16: { score: 2, note: 'Practical skills II: narrow content, generous boundaries.' },
  // Physics
  WPH11: { score: 3, note: 'Mechanics and materials; standard first-unit fare.' },
  WPH12: { score: 3, note: 'Waves and electricity: long-answer heavy.' },
  WPH13: { score: 2, note: 'Practical skills: short syllabus.' },
  WPH14: { score: 4, note: 'Fields and further mechanics; heavy on derivations.' },
  WPH15: { score: 5, note: 'Thermodynamics, nuclear, oscillations and particle physics: broad and very mathematical.' },
  WPH16: { score: 2, note: 'Practical skills II.' },
  // Biology
  WBI11: { score: 3, note: 'Molecules, diet and transport: a lot of recall.' },
  WBI12: { score: 3, note: 'Cells, development and biodiversity.' },
  WBI13: { score: 2, note: 'Practical skills in Biology I.' },
  WBI14: { score: 4, note: 'Energy, environment, microbiology and immunity: detail-dense.' },
  WBI15: { score: 4, note: 'Respiration, photosynthesis, coordination and gene technology: the biggest content load in the course.' },
  WBI16: { score: 2, note: 'Practical skills in Biology II.' },
  // Mathematics
  WMA11: { score: 2, note: 'Pure 1: the most approachable maths unit.' },
  WMA12: { score: 3, note: 'Pure 2: trigonometry and series step up.' },
  WMA13: { score: 3, note: 'Pure 3: counts toward the Mathematics A* rule.' },
  WMA14: { score: 4, note: 'Pure 4: integration techniques and vectors; counts toward the A* rule.' },
  WST01: { score: 2, note: 'Statistics 1: formulaic and very drillable.' },
  WST02: { score: 3, note: 'Statistics 2: distributions and hypothesis testing.' },
  WME01: { score: 3, note: 'Mechanics 1: straightforward once the modelling clicks.' },
  WME02: { score: 3, note: 'Mechanics 2.' },
  WME03: { score: 4, note: 'Mechanics 3: challenging modelling and calculus of motion.' },
  WDM11: { score: 2, note: 'Decision 1: algorithmic and quick to score on.' },
  // Further Mathematics
  WFM01: { score: 4, note: 'Further Pure 1: complex numbers and matrices.' },
  WFM02: { score: 5, note: 'Further Pure 2: abstract and proof-heavy; a common grade-killer.' },
  WFM03: { score: 5, note: 'Further Pure 3: hyperbolic functions, vectors, tough integration.' },
  // Economics / Business
  WEC11: { score: 2, note: 'Markets in action: short answers, generous boundaries.' },
  WEC12: { score: 3, note: 'Macroeconomic performance and policy.' },
  WEC13: { score: 4, note: 'Business behaviour: essay-heavy with tight marking.' },
  WEC14: { score: 4, note: 'Developments in the global economy: synoptic essays.' },
  WBS11: { score: 2, note: 'Marketing and people.' },
  WBS12: { score: 3, note: 'Managing business activities.' },
  WBS13: { score: 4, note: 'Business decisions and strategy: synoptic.' },
  WBS14: { score: 4, note: 'Global business: extended evaluation.' },
}

/** Sciences' A2 unit 5 is the toughest paper wherever we have no explicit entry. */
export function getDifficulty(code: string): Diff | null {
  if (DIFFICULTY[code]) return DIFFICULTY[code]
  if (/^W(CH|PH|BI)\d*5$/.test(code)) {
    return { score: 4, note: 'A2 Unit 5: typically the most demanding paper in the science, with the widest content.' }
  }
  return null
}

export function defaultEffort(code: string): number {
  return getDifficulty(code)?.score ?? DEFAULT_EFFORT
}

export const EFFORT_LABELS: Record<number, string> = {
  1: 'Easy for me',
  2: 'Fairly easy',
  3: 'Average',
  4: 'Hard',
  5: 'Brutal',
}
