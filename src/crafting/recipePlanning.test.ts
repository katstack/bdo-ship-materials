import { describe, it, expect } from 'vitest'
import { recipeId, recipeRoutes, selectedRecipe, routeInputs } from './recipeCatalog'
import { calculateCraftingPlan } from './planCalculation'
import { resolvePlanRoutes } from './planRoutes'
import { emptyCraftingPlan } from './planTypes'
import { parseCraftingPlan } from './planStorage'
import { defaultEnvironment } from './environment'
import { loadPlanDetails } from './loadPlanDetails'
import { adaptItemDetail } from './catalogAdapter'
import { hasPlanDetails } from './planCalculation'
import type { ItemDetail, SourceRecipe } from './types'
const recipe = (id: string, inputs: SourceRecipe['inputs'], type = 'COOK'): SourceRecipe => ({
  output: `urn::item:${id}`,
  type,
  inputs,
})
const detail = (id: string, recipes: SourceRecipe[] = [], category = 'Cook'): ItemDetail => ({
  item: { id, category },
  recipes,
  usedIn: [],
})
const cabbage = recipe('9202', [{ item: 'urn::item:7318', count: 8 }])
const names = new Map([
  ['9202', '채소 절임'],
  ['7318', '양배추'],
  ['7306', '호박'],
  ['7312', '파프리카'],
  ['2', '두 번째 요리'],
])
const base = () => ({
  ...emptyCraftingPlan(),
  goals: [{ itemId: '9202', name: '채소 절임', quantity: 10 }],
})
describe('recipe-centric planning boundaries', () => {
  it('classifies recovery from complete index metadata without mutating raw records', () => {
    const raw = detail('3', [recipe('3', [{ item: 'urn::item:10006', count: 1 }], 'HEAT')], 'Mine')
    const adapted = adaptItemDetail(raw, new Map([['10006', 'MainWeapon']]))
    expect(recipeRoutes(adapted)[0].kind).toBe('recovery')
    expect(raw.recipes[0].routeKindHint).toBeUndefined()
    expect(recipeId(raw.recipes[0])).toBe(recipeId(adapted.recipes[0]))
  })
  it('reports oversized graph coverage as incomplete instead of crashing render', () => {
    const large = new Map<string, ItemDetail>()
    for (let i = 1; i < 303; i++)
      large.set(
        String(i),
        detail(
          String(i),
          i === 302 ? [] : [recipe(String(i), [{ item: `urn::item:${i + 1}`, count: 1 }])],
        ),
      )
    // Wide graphs exceed the cap; depth is independently bounded.
    large.set(
      '1',
      detail('1', [
        recipe(
          '1',
          Array.from({ length: 301 }, (_, i) => ({ item: `urn::item:${i + 2}`, count: 1 })),
        ),
      ]),
    )
    expect(
      hasPlanDetails(
        { ...emptyCraftingPlan(), view: 'raw', goals: [{ itemId: '1', name: 'A', quantity: 1 }] },
        large,
        names,
      ),
    ).toBe(false)
  })
  it('identifies recipes independently of source array and ingredient order', () => {
    const a = recipe('1', [
      { item: 'urn::item:2', count: 1 },
      { item: 'urn::item:3', count: 2 },
    ])
    expect(recipeId(a)).toBe(
      recipeId({ ...a, inputs: [...a.inputs].reverse(), urn: 'changed-index' }),
    )
    const route = selectedRecipe(detail('1', [recipe('1', []), a]), {
      mode: 'craft',
      recipeIndex: 0,
      recipeId: recipeId(a),
      outputPerCraft: 1,
    })
    expect(route?.index).toBe(1)
    expect(
      selectedRecipe(detail('1', [a]), {
        mode: 'craft',
        recipeIndex: 0,
        recipeId: 'recipe-1-deadbeef',
        outputPerCraft: 1,
      }),
    ).toBeUndefined()
  })
  it('scopes substitutions to a recipe slot and sums selected items before stock', () => {
    const first = recipeRoutes(detail('9202', [cabbage]))[0],
      slot = first.slots[0]
    const second = recipe('2', [{ item: 'urn::item:7318', count: 2 }])
    const data = {
      ...base(),
      goals: [...base().goals, { itemId: '2', name: '두 번째 요리', quantity: 2 }],
      choices: {
        '9202': {
          mode: 'craft' as const,
          recipeIndex: 0,
          recipeId: first.id,
          outputPerCraft: 1,
          substitutions: { [first.id]: { [slot.id]: '7306' } },
        },
      },
      inventory: { '7306': 5 },
    }
    const details = new Map([
      ['9202', detail('9202', [cabbage])],
      ['2', detail('2', [second])],
      ['7318', detail('7318')],
      ['7306', detail('7306')],
    ])
    const result = calculateCraftingPlan(data, details, names)
    expect(result.rows.find((row) => row.id === '7306')).toMatchObject({
      required: 80,
      shortage: 75,
      purchaseRequired: 75,
    })
    expect(result.rows.find((row) => row.id === '7318')).toMatchObject({ required: 4 })
    expect(parseCraftingPlan(JSON.parse(JSON.stringify(data)))).toMatchObject(data)
  })
  it('rejects arbitrary substitution values and uses a diagnosed default for invalid candidates', () => {
    const route = recipeRoutes(detail('9202', [cabbage]))[0]
    expect(
      routeInputs(route, {
        mode: 'craft',
        recipeIndex: 0,
        outputPerCraft: 1,
        substitutions: { [route.id]: { [route.slots[0].id]: '99999' } },
      })[0],
    ).toMatchObject({ selectedItemId: '7318', invalidSelection: true })
    expect(() =>
      parseCraftingPlan({
        ...base(),
        choices: {
          '9202': {
            mode: 'craft',
            recipeIndex: 0,
            outputPerCraft: 1,
            substitutions: { bad: { x: 1 } },
          },
        },
      }),
    ).toThrow()
  })
  it('loads selected substitute details rather than only the original ingredient', async () => {
    const route = recipeRoutes(detail('9202', [cabbage]))[0],
      calls: string[] = []
    const data = {
      ...base(),
      choices: {
        '9202': {
          mode: 'craft' as const,
          recipeIndex: 0,
          outputPerCraft: 1,
          substitutions: { [route.id]: { [route.slots[0].id]: '7306' } },
        },
      },
    }
    await loadPlanDetails(
      data,
      names,
      () => false,
      async (id) => {
        calls.push(id)
        return detail(id, id === '9202' ? [cabbage] : [])
      },
    )
    expect(calls).toEqual(['9202', '7306'])
  })
  it('labels equipment recovery and does not auto-manufacture equipment for a recovery input', () => {
    const recovery = recipe('3', [{ item: 'urn::item:4', count: 1 }], 'HEAT')
    const data = {
      ...emptyCraftingPlan(),
      view: 'raw' as const,
      goals: [{ itemId: '3', name: '회수 재료', quantity: 2 }],
    }
    const details = new Map([
      ['3', detail('3', [recovery], 'Mine')],
      ['4', detail('4', [recipe('4', [{ item: 'urn::item:3', count: 1 }], 'HOUSE')], 'MainWeapon')],
    ])
    const result = calculateCraftingPlan(data, details, names)
    expect(result.rows.find((row) => row.id === '3')).toMatchObject({
      mode: 'craft',
      crafts: 2,
      routeKind: 'recovery',
    })
    expect(result.rows.find((row) => row.id === '4')).toMatchObject({
      purchaseRequired: 2,
      crafts: 0,
    })
  })
  it('preserves intent in a cycle and shares inventory with external bootstrap demand', () => {
    const details = new Map([
      ['1', detail('1', [recipe('1', [{ item: 'urn::item:2', count: 1 }])])],
      ['2', detail('2', [recipe('2', [{ item: 'urn::item:1', count: 1 }])])],
    ])
    const data = {
      ...emptyCraftingPlan(),
      view: 'raw' as const,
      goals: [{ itemId: '1', name: 'A', quantity: 2 }],
      inventory: { '1': 1 },
    }
    const result = calculateCraftingPlan(data, details, names)
    expect(result.rows.find((row) => row.id === '1')).toMatchObject({
      mode: 'craft',
      crafts: 1,
      purchaseRequired: 1,
      required: 3,
      owned: 1,
    })
    expect(
      result.routes.issues.some(
        (issue) => issue.kind === 'cycle' && issue.path?.join(',') === '1,2,1',
      ),
    ).toBe(true)
    expect(data.choices).toEqual({})
  })
  it('keeps route interpretation independent of quantity and stock', () => {
    const details = new Map([
      ['9202', detail('9202', [cabbage])],
      ['7318', detail('7318')],
    ])
    expect([...resolvePlanRoutes(base(), details, names).nodes]).toEqual([
      ...resolvePlanRoutes(
        { ...base(), goals: [{ ...base().goals[0], quantity: 999 }], inventory: { '7318': 100 } },
        details,
        names,
      ).nodes,
    ])
  })
  it('automatically applies only covered output ranges at eligible ranks and respects overrides', () => {
    const environment = defaultEnvironment()
    environment.cooking = { rank: 'master', level: 1, mastery: 1480 }
    const fullRecipe = recipe('9202', [
      { item: 'urn::item:7318', count: 8 },
      { item: 'urn::item:9066', count: 4 },
      { item: 'urn::item:9005', count: 2 },
      { item: 'urn::item:9002', count: 2 },
    ])
    const details = new Map([
      ['9202', detail('9202', [fullRecipe])],
      ['7318', detail('7318')],
    ])
    expect(
      calculateCraftingPlan({ ...base(), environment }, details, names).rows.find(
        (row) => row.id === '9202',
      ),
    ).toMatchObject({ automaticYield: true })
    expect(
      calculateCraftingPlan({ ...base(), environment }, details, names).rows.find(
        (row) => row.id === '9202',
      )?.outputPerCraft,
    ).toBeCloseTo(3.01165)
    const alternate = new Map(details)
    alternate.set('9202', detail('9202', [cabbage]))
    expect(
      calculateCraftingPlan({ ...base(), environment }, alternate, names).rows.find(
        (row) => row.id === '9202',
      )?.automaticYield,
    ).toBe(false)
    const manual = calculateCraftingPlan(
      {
        ...base(),
        environment,
        choices: {
          '9202': {
            mode: 'craft',
            recipeIndex: 0,
            outputPerCraft: 2,
            yieldModel: 'manual',
            yieldConfirmed: true,
          },
        },
      },
      details,
      names,
    )
    expect(manual.rows.find((row) => row.id === '9202')).toMatchObject({
      outputPerCraft: 2,
      automaticYield: false,
    })
  })
})
