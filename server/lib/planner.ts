import { IalCashin, IalUnit, StarRule, baseGrade, rawTable } from './engine'

/**
 * Retake planner.
 *
 * Given the UMS a student already holds, work out the cheapest way to reach a
 * target grade, where cheapest means fewest brutal papers at the lowest marks.
 *
 * Two things make one extra UMS expensive in a given unit:
 *   1. the raw marks it costs, which the published boundaries tell us exactly
 *      (a unit whose UMS curve is steep near the student's current mark needs
 *      far more extra raw marks than one where they still have easy headroom);
 *   2. how hard the student finds the paper, a 1-5 effort weight they control.
 *
 * The planner enumerates which papers to re-sit, and for each combination
 * pours UMS into whichever unit is cheapest at the margin. Re-sitting a paper
 * carries a fixed cost of its own, so a plan that squeezes two more UMS out of
 * one paper always beats one that spreads a mark across four.
 */

export type PlannerUnit = {
  key: string
  code: string
  title: string
  type: 'AS' | 'A2'
  unit: IalUnit
  /** UMS already banked, or null if the unit has not been sat yet. */
  currentUms: number | null
  /** 1 = easy for me … 5 = brutal for me. */
  effort: number
}

export type PlanStep = {
  key: string
  code: string
  title: string
  type: 'AS' | 'A2'
  retake: boolean
  fromUms: number
  toUms: number
  gain: number
  rawNeeded: number
  rawMax: number
  pct: number
  effort: number
}

export type Plan = {
  status: 'secured' | 'planned' | 'impossible' | 'idle'
  target: string
  needOverall: number
  starRule: StarRule | null
  currentTotal: number
  currentRuleUms: number
  projectedTotal: number
  projectedRuleUms: number
  steps: PlanStep[]
  /** UMS still missing when even full marks everywhere fall short. */
  shortfall: number
  retakeCount: number
}

/** Sitting another paper has a cost of its own, independent of the marks. */
const RESIT_COST = 0.9
const MAX_ENUMERATED = 10

function weightFor(effort: number) {
  return 1 + 0.3 * (effort - 3)
}

/**
 * Marks near the top of a paper cost far more than marks in the middle, which
 * the raw-to-UMS curve alone does not capture, because the last 10% of a paper is a
 * different exam from the first 10%. Without this the planner happily suggests
 * "just get 80/80", which is not a plan.
 */
function stretch(pct: number) {
  return 1 / Math.pow(Math.max(0.06, 1.04 - pct), 1.25)
}

type Slot = {
  u: PlannerUnit
  table: number[]
  base: number
  headroom: number
  weight: number
  alloc: number
}

function marginalCost(s: Slot) {
  const at = s.base + s.alloc
  if (at >= s.u.unit.ums_max) return Infinity
  const raw = s.table[at + 1]
  const dRaw = raw - s.table[at]
  return ((dRaw || 0.01) / s.u.unit.raw_max) * s.weight * stretch(raw / s.u.unit.raw_max)
}

/** Pour UMS into the cheapest slot until `amount` is covered. Mutates allocs. */
function pour(slots: Slot[], amount: number): number | null {
  let cost = 0
  for (let i = 0; i < amount; i++) {
    let best: Slot | null = null
    let bestCost = Infinity
    for (const s of slots) {
      if (s.alloc >= s.headroom) continue
      const c = marginalCost(s)
      if (c < bestCost) {
        bestCost = c
        best = s
      }
    }
    if (!best) return null
    best.alloc++
    cost += bestCost
  }
  return cost
}

export function plan(
  units: PlannerUnit[],
  cashin: IalCashin,
  target: string,
  starRule: StarRule | null,
): Plan {
  const wantsStar = target === 'A*'
  const needOverall = cashin.ums[wantsStar ? 'A' : target] ?? 0
  const inRule = (u: PlannerUnit) => !!starRule && starRule.codes.includes(u.code)

  const currentTotal = units.reduce((s, u) => s + (u.currentUms ?? 0), 0)
  const currentRuleUms = units.reduce((s, u) => s + (inRule(u) ? u.currentUms ?? 0 : 0), 0)

  const base: Omit<Plan, 'status' | 'steps' | 'projectedTotal' | 'projectedRuleUms' | 'shortfall' | 'retakeCount'> = {
    target, needOverall, starRule, currentTotal, currentRuleUms,
  }

  const untaken = units.filter((u) => u.currentUms == null)
  const ruleSatisfied = !wantsStar || !starRule || currentRuleUms >= starRule.need

  if (!untaken.length && currentTotal >= needOverall && ruleSatisfied) {
    return {
      ...base, status: 'secured', steps: [], shortfall: 0, retakeCount: 0,
      projectedTotal: currentTotal, projectedRuleUms: currentRuleUms,
    }
  }

  // Is the target reachable at all, re-sitting everything?
  const ceiling = units.reduce((s, u) => s + Math.max(u.currentUms ?? 0, u.unit.ums_max), 0)
  const ruleCeiling = units.reduce((s, u) => s + (inRule(u) ? u.unit.ums_max : 0), 0)
  if (ceiling < needOverall || (wantsStar && starRule && ruleCeiling < starRule.need)) {
    return {
      ...base, status: 'impossible', steps: [], retakeCount: 0,
      projectedTotal: ceiling, projectedRuleUms: ruleCeiling,
      shortfall: Math.max(0, needOverall - ceiling),
    }
  }

  const makeSlots = (resitKeys: Set<string>): Slot[] =>
    units
      .filter((u) => u.currentUms == null || resitKeys.has(u.key))
      .map((u) => {
        const start = u.currentUms ?? 0
        return {
          u,
          table: rawTable(u.unit),
          base: start,
          headroom: u.unit.ums_max - start,
          weight: weightFor(u.effort),
          alloc: 0,
        }
      })
      .filter((s) => s.headroom > 0)

  const evaluate = (resitKeys: Set<string>) => {
    const slots = makeSlots(resitKeys)
    let cost = resitKeys.size * RESIT_COST

    // The A* sub-total is the binding constraint, so satisfy it first: it can
    // only be filled from the units the rule counts.
    if (wantsStar && starRule) {
      const ruleSlots = slots.filter((s) => inRule(s.u))
      const have = units.reduce((sum, u) => sum + (inRule(u) ? u.currentUms ?? 0 : 0), 0)
      const gap = starRule.need - have
      if (gap > 0) {
        const c = pour(ruleSlots, gap)
        if (c == null) return null
        cost += c
      }
    }

    const allocated = slots.reduce((s, x) => s + x.alloc, 0)
    const gap = needOverall - currentTotal - allocated
    if (gap > 0) {
      const c = pour(slots, gap)
      if (c == null) return null
      cost += c
    }
    return { slots, cost }
  }

  // Enumerate which already-sat papers to re-sit; untaken units are always in.
  const candidates = units.filter((u) => u.currentUms != null && u.currentUms < u.unit.ums_max)
  const pool = candidates.slice(0, MAX_ENUMERATED)
  let best: { slots: Slot[]; cost: number; keys: Set<string> } | null = null

  for (let mask = 0; mask < 1 << pool.length; mask++) {
    const keys = new Set<string>()
    for (let i = 0; i < pool.length; i++) if (mask & (1 << i)) keys.add(pool[i].key)
    const res = evaluate(keys)
    if (res && (!best || res.cost < best.cost)) best = { ...res, keys }
  }

  if (!best) {
    return {
      ...base, status: 'impossible', steps: [], retakeCount: 0,
      projectedTotal: ceiling, projectedRuleUms: ruleCeiling,
      shortfall: Math.max(0, needOverall - ceiling),
    }
  }

  const steps: PlanStep[] = best.slots
    .filter((s) => s.alloc > 0 || s.u.currentUms == null)
    .map((s) => {
      const toUms = s.base + s.alloc
      const rawNeeded = s.table[toUms]
      return {
        key: s.u.key,
        code: s.u.code,
        title: s.u.title,
        type: s.u.type,
        retake: s.u.currentUms != null,
        fromUms: s.base,
        toUms,
        gain: s.alloc,
        rawNeeded,
        rawMax: s.u.unit.raw_max,
        pct: Math.round((rawNeeded / s.u.unit.raw_max) * 100),
        effort: s.u.effort,
      }
    })
    .sort((a, b) => b.gain - a.gain || a.code.localeCompare(b.code))

  const projectedTotal = units.reduce((sum, u) => {
    const step = steps.find((s) => s.key === u.key)
    return sum + (step ? step.toUms : u.currentUms ?? 0)
  }, 0)
  const projectedRuleUms = units.reduce((sum, u) => {
    if (!inRule(u)) return sum
    const step = steps.find((s) => s.key === u.key)
    return sum + (step ? step.toUms : u.currentUms ?? 0)
  }, 0)

  return {
    ...base,
    status: 'planned',
    steps,
    shortfall: 0,
    retakeCount: steps.filter((s) => s.retake).length,
    projectedTotal,
    projectedRuleUms,
  }
}

/** The best grade this plan lands on, for the summary line. */
export function planGrade(p: Plan, cashin: IalCashin): string {
  const g = baseGrade(cashin, p.projectedTotal)
  if (g === 'A' && p.starRule && p.projectedRuleUms >= p.starRule.need) return 'A*'
  return g
}
