import { describe, expect, it } from 'vitest'
import { buildPlanTree, materialPaths } from './planTree'
import { calculateCraftingPlan } from './planCalculation'
import { emptyCraftingPlan } from './planTypes'
import type { ItemDetail } from './types'

const detail = (id: string, inputs: [string, number][] = []): ItemDetail => ({
  item: { id, category: 'Cook' },
  recipes: inputs.length
    ? [
        {
          output: `urn::item:${id}`,
          type: 'COOK',
          inputs: inputs.map(([item, count]) => ({ item: `urn::item:${item}`, count })),
        },
      ]
    : [],
  usedIn: [],
})
const names = new Map([
  ['1', '목표'],
  ['2', '중간 A'],
  ['3', '중간 B'],
  ['4', '공유 원재료'],
])
const plan = () => ({
  ...emptyCraftingPlan(),
  view: 'raw' as const,
  goals: [{ itemId: '1', name: '목표', quantity: 1 }],
})
const details = new Map([
  [
    '1',
    detail('1', [
      ['2', 2],
      ['3', 3],
    ]),
  ],
  ['2', detail('2', [['4', 5]])],
  ['3', detail('3', [['4', 7]])],
  ['4', detail('4')],
])

describe('crafting tree presentation', () => {
  it('keeps parent relationships and shows shared dependencies without double-counting stock', () => {
    const result = calculateCraftingPlan(
      { ...plan(), inventory: { '2': 1, '4': 7 } },
      details,
      names,
    )
    const [root] = buildPlanTree(result)
    expect(root.row.id).toBe('1')
    expect(root.children.map((child) => [child.row.id, child.required])).toEqual([
      ['2', 2],
      ['3', 3],
    ])
    expect(root.children[0].children[0].required).toBe(5)
    expect(root.children[1].children[0].required).toBe(21)
    expect(root.children[1].children[0].shared).toBe(true)
    expect(result.rows.find((row) => row.id === '4')).toMatchObject({
      required: 26,
      owned: 7,
      purchaseRequired: 19,
    })
    expect(materialPaths(result, '4')).toEqual([
      ['1', '2', '4'],
      ['1', '3', '4'],
    ])
  })
  it('does not show zero-demand branches after intermediate stock covers a recipe', () => {
    const result = calculateCraftingPlan({ ...plan(), inventory: { '2': 2 } }, details, names)
    expect(buildPlanTree(result)[0].children[0].children).toEqual([])
    expect(materialPaths(result, '4')).toEqual([['1', '3', '4']])
  })
  it('bounds cyclic paths and keeps the separate external supply leaf', () => {
    const cyclic = new Map([
      ['1', detail('1', [['2', 1]])],
      ['2', detail('2', [['1', 1]])],
    ])
    const result = calculateCraftingPlan(plan(), cyclic, names)
    const leaf = buildPlanTree(result)[0].children[0].children[0]
    expect(leaf.external).toBe(true)
    expect(leaf.children).toEqual([])
    expect(materialPaths(result, '2')).toEqual([['1', '2']])
  })
})
