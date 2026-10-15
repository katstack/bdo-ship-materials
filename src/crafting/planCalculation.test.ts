import { describe, expect, it } from 'vitest'
import {
  calculateCraftingPlan,
  hasPlanDetails,
  planItemName,
  samePlanDependencyGraph,
} from './planCalculation'
import { emptyCraftingPlan } from './planTypes'
import type { ItemDetail, SourceRecipe } from './types'
import { loadPlanDetails } from './loadPlanDetails'

const make = (id: string, inputs: { item: string; count?: number }[] = []): ItemDetail => ({
  item: { id },
  recipes: inputs.length ? [{ output: `urn::item:${id}`, type: 'HEAT', inputs }] : [],
  usedIn: [],
})
const names = new Map([
  ['1', 'A'],
  ['2', 'B'],
  ['3', '중간 재료'],
  ['4', '원재료'],
])
const details = new Map([
  ['1', make('1', [{ item: 'urn::item:3', count: 1 }])],
  ['2', make('2', [{ item: 'urn::item:3', count: 1 }])],
  ['3', make('3', [{ item: 'urn::item:4', count: 3 }])],
  ['4', make('4')],
])
const plan = () => ({
  ...emptyCraftingPlan(),
  goals: [
    { itemId: '1', name: 'A', quantity: 1 },
    { itemId: '2', name: 'B', quantity: 1 },
  ],
  inventory: { '3': 1, '4': 1 },
})
describe('multi-goal crafting calculation', () => {
  it('reuses loaded details when obtaining a material prunes the graph', () => {
    const narrowed = {
      ...plan(),
      view: 'raw' as const,
      choices: { '3': { mode: 'obtain' as const, recipeIndex: 0, outputPerCraft: 1 } },
    }
    const partial = new Map(details)
    partial.delete('4')
    expect(hasPlanDetails(narrowed, partial, names)).toBe(true)
    expect(hasPlanDetails({ ...narrowed, choices: {} }, partial, names)).toBe(false)
    expect(hasPlanDetails({ ...narrowed, choices: {} }, details, names)).toBe(true)
  })
  it('loads only genuinely missing dependencies and keeps the supplied cache intact', async () => {
    const cached = new Map(details)
    cached.delete('4')
    const requested: string[] = []
    const loaded = await loadPlanDetails(
      { ...plan(), view: 'raw' },
      names,
      () => false,
      async (id) => {
        requested.push(id)
        return details.get(id)!
      },
      cached,
    )
    expect(requested).toEqual(['4'])
    expect(loaded.get('3')).toBe(cached.get('3'))
    expect(cached.has('4')).toBe(false)
  })
  it('keeps the same dependency graph when only quantities, yields or equivalent choices change', () => {
    const a = { ...plan(), view: 'raw' as const }
    const b = {
      ...a,
      goals: [{ ...a.goals[0], quantity: 600 }, a.goals[1]],
      choices: { '3': { mode: 'craft' as const, recipeIndex: 0, outputPerCraft: 2.5 } },
    }
    expect(samePlanDependencyGraph(a, b, details, names)).toBe(true)
    expect(
      samePlanDependencyGraph(
        a,
        { ...b, choices: { '3': { mode: 'obtain', recipeIndex: 0, outputPerCraft: 2.5 } } },
        details,
        names,
      ),
    ).toBe(false)
  })
  it('aggregates shared direct material demand and subtracts stock once', () => {
    const result = calculateCraftingPlan(plan(), details, names)
    expect(result.rows.find((row) => row.id === '3')).toMatchObject({
      required: 2,
      owned: 1,
      shortage: 1,
      mode: 'obtain',
    })
    expect(result.rows.some((row) => row.id === '4')).toBe(false)
  })
  it('aggregates before rounding shared intermediate craft counts', () => {
    const data = {
      ...plan(),
      view: 'raw' as const,
      choices: {
        '3': { mode: 'craft' as const, recipeIndex: 0, outputPerCraft: 2, yieldConfirmed: true },
      },
    }
    const result = calculateCraftingPlan(data, details, names)
    expect(result.rows.find((row) => row.id === '3')).toMatchObject({
      required: 2,
      shortage: 1,
      crafts: 1,
      assumedYield: false,
    })
    expect(result.rows.find((row) => row.id === '4')).toMatchObject({ required: 3, shortage: 2 })
    const reverse = calculateCraftingPlan(
      { ...data, goals: [...data.goals].reverse() },
      details,
      names,
    )
    expect([...reverse.rows].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...result.rows].sort((a, b) => a.id.localeCompare(b.id)),
    )
  })
  it('does not demand raw materials for fully stocked goals', () => {
    const data = { ...plan(), view: 'raw' as const, inventory: { '1': 1, '2': 1 } }
    expect(
      calculateCraftingPlan(data, details, names).rows.every((row) => row.shortage === 0),
    ).toBe(true)
  })
  it('stops expanding explicitly obtained intermediate materials', () => {
    const data = {
      ...plan(),
      view: 'raw' as const,
      choices: { '3': { mode: 'obtain' as const, recipeIndex: 0, outputPerCraft: 1 } },
    }
    expect(calculateCraftingPlan(data, details, names).rows.some((row) => row.id === '4')).toBe(
      false,
    )
  })
  it('keeps a target that is also an ingredient in the combined demand', () => {
    const data = {
      ...plan(),
      goals: [
        { itemId: '1', name: 'A', quantity: 1 },
        { itemId: '3', name: '중간 재료', quantity: 2 },
      ],
      inventory: {},
    }
    expect(
      calculateCraftingPlan(data, details, names).rows.find((row) => row.id === '3'),
    ).toMatchObject({ required: 3, crafts: 3 })
  })
  it('keeps crafting intent and cuts only the returning cycle dependency', () => {
    const cycle = new Map(details)
    cycle.set('3', make('3', [{ item: 'urn::item:1', count: 1 }]))
    const result = calculateCraftingPlan({ ...plan(), inventory: {}, view: 'raw' }, cycle, names)
    expect(result.rows.find((row) => row.id === '3')).toMatchObject({
      mode: 'craft',
      required: 2,
      shortage: 2,
      crafts: 2,
    })
    expect(result.rows.find((row) => row.id === '1')).toMatchObject({
      mode: 'craft',
      crafts: 1,
      purchaseRequired: 2,
    })
    expect(result.warnings.some((warning) => warning.includes('순환 경로'))).toBe(true)
  })
  it('keeps self-referential intent and separately counts bootstrap inputs', () => {
    const self = new Map([['1', make('1', [{ item: 'urn::item:1', count: 1 }])]])
    const result = calculateCraftingPlan(
      { ...emptyCraftingPlan(), goals: [{ itemId: '1', name: 'A', quantity: 3 }] },
      self,
      names,
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      mode: 'craft',
      required: 6,
      shortage: 6,
      purchaseRequired: 3,
      crafts: 3,
    })
  })
  it('separates enhanced gear requirements from unenhanced stock', () => {
    const packed = String(10 * 0x1000000 + 3)
    const data = {
      ...emptyCraftingPlan(),
      view: 'raw' as const,
      goals: [{ itemId: packed, name: '+10 중간 재료', quantity: 1 }],
      inventory: { '3': 99 },
    }
    expect(planItemName(packed, names)).toBe('+10 중간 재료')
    expect(calculateCraftingPlan(data, details, names).rows).toEqual([
      expect.objectContaining({ id: packed, owned: 0, shortage: 1, mode: 'obtain' }),
    ])
  })
  it('marks unknown input quantities and assumed production yields', () => {
    const unknown = new Map(details)
    unknown.set('1', make('1', [{ item: 'urn::item:3' }]))
    const warnings = calculateCraftingPlan(plan(), unknown, names).warnings.join(' ')
    expect(warnings).toContain('수량 미확인')
    expect(warnings).toContain('1회당 1개 가정')
  })
  it('prefers ordinary recipes and warns when a byproduct recipe is explicitly selected', () => {
    const variants = new Map(details)
    const recipes: SourceRecipe[] = [
      { ...details.get('1')!.recipes[0], byproductOf: 'urn::item:9' },
      { output: 'urn::item:1', type: 'HEAT', inputs: [{ item: 'urn::item:4', count: 2 }] },
    ]
    variants.set('1', { ...details.get('1')!, recipes })
    const normal = calculateCraftingPlan(plan(), variants, names)
    expect(normal.rows.find((row) => row.id === '1')?.recipeIndex).toBe(1)
    const chosen = {
      ...plan(),
      choices: { '1': { mode: 'craft' as const, recipeIndex: 0, outputPerCraft: 1 } },
    }
    expect(calculateCraftingPlan(chosen, variants, names).warnings.join(' ')).toContain(
      '부산물 제작식',
    )
  })
  it('does not call a default yield user-confirmed just because a recipe was selected', () => {
    const data = {
      ...plan(),
      choices: { '1': { mode: 'craft' as const, recipeIndex: 0, outputPerCraft: 1 } },
    }
    expect(
      calculateCraftingPlan(data, details, names).rows.find((row) => row.id === '1')?.assumedYield,
    ).toBe(true)
  })
  it('fails safely on unsafe numerical totals', () => {
    const large = new Map(details)
    large.set('1', make('1', [{ item: 'urn::item:3', count: 1e9 }]))
    expect(() =>
      calculateCraftingPlan(
        { ...plan(), goals: [{ itemId: '1', name: 'A', quantity: 1e9 }] },
        large,
        names,
      ),
    ).toThrow('안전한 숫자')
  })
  it('loads shared dependencies once and respects cancellation', async () => {
    const calls: string[] = []
    const load = async (id: string) => {
      calls.push(id)
      return details.get(id)!
    }
    await loadPlanDetails({ ...plan(), view: 'raw' }, names, () => false, load)
    expect(calls.sort()).toEqual(['1', '2', '3', '4'])
    calls.length = 0
    expect((await loadPlanDetails(plan(), names, () => true, load)).size).toBe(0)
    expect(calls).toEqual([])
  })
})
