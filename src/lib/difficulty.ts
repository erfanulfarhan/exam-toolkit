// Curated "hardest units" index for IAL, distilled from community consensus
// (r/6thForm, The Student Room, tutor blogs). Subjective by nature — shown as a
// guide, not fact. Score 1 (manageable) … 5 (brutal). Keyed by unit code.
export type Diff = { score: number; note: string }

export const DIFFICULTY: Record<string, Diff> = {
  // Chemistry
  WCH15: { score: 5, note: 'Transition metals + organic nitrogen: dense theory, lots of colours/mechanisms, historically low boundaries. Widely called the hardest IAL unit.' },
  WCH14: { score: 4, note: 'Rates, equilibria and further organic — mechanism- and calculation-heavy.' },
  WCH12: { score: 3, note: 'Energetics & group chemistry; moderate.' },
  // Physics
  WPH15: { score: 5, note: 'Thermodynamics, nuclear, oscillations & particle physics — broad and very mathematical.' },
  WPH14: { score: 4, note: 'Fields & further mechanics; heavy on derivations.' },
  // Biology
  WBI15: { score: 4, note: 'Respiration, photosynthesis, microbiology & ecosystems — huge content load with fine detail.' },
  WBI14: { score: 4, note: 'Energy flow, coordination & gene technology — detail-dense.' },
  // Maths / Further Maths
  WFM02: { score: 5, note: 'Further Pure 2 — abstract, proof-heavy; a common grade-killer.' },
  WFM03: { score: 5, note: 'Further Pure 3 — hyperbolic functions, vectors, tough integration.' },
  WME03: { score: 4, note: 'Mechanics 3 — challenging modelling & calculus of motion.' },
  WMA14: { score: 3, note: 'Pure 4 — integration techniques and vectors ramp up.' },
}

// Fallback: sciences' Unit 5 is generally the toughest A2 paper.
export function getDifficulty(code: string): Diff | null {
  if (DIFFICULTY[code]) return DIFFICULTY[code]
  if (/^W(CH|PH|BI)1?5$/.test(code)) return { score: 4, note: 'A2 Unit 5 — typically the most demanding paper in the science, with the widest content.' }
  return null
}
