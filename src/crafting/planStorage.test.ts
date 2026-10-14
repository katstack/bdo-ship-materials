import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  craftingPlanStorageKey,
  loadCraftingPlan,
  parseCraftingPlan,
  saveCraftingPlan,
} from './planStorage'
import { emptyCraftingPlan } from './planTypes'

afterEach(() => vi.unstubAllGlobals())
describe('independent crafting plan storage', () => {
  it('round-trips goals, path choices, stock and sort preferences', () => {
    const data = {
      ...emptyCraftingPlan(),
      goals: [{ itemId: '1', name: '목표', quantity: 2 }],
      inventory: { '2': 10 },
      choices: {
        '1': { mode: 'craft' as const, recipeIndex: 1, outputPerCraft: 2.5, yieldConfirmed: true },
      },
      sort: 'shortage' as const,
      view: 'raw' as const,
    }
    expect(parseCraftingPlan(JSON.parse(JSON.stringify(data)))).toEqual(data)
  })
  it('rejects corrupt, negative, fractional, duplicate and unknown-version backups', () => {
    for (const data of [
      null,
      { ...emptyCraftingPlan(), version: 99 },
      { ...emptyCraftingPlan(), inventory: { '1': -1 } },
      { ...emptyCraftingPlan(), goals: [{ itemId: '1', name: 'A', quantity: 1.5 }] },
      {
        ...emptyCraftingPlan(),
        choices: { '1': { mode: 'craft', recipeIndex: 0, outputPerCraft: 0 } },
      },
      {
        ...emptyCraftingPlan(),
        goals: [
          { itemId: '1', name: 'A', quantity: 1 },
          { itemId: '1', name: 'A', quantity: 2 },
        ],
      },
    ])
      expect(() => parseCraftingPlan(data)).toThrow()
  })
  it('does not overwrite corrupt stored content while loading', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => '{invalid', setItem })
    expect(loadCraftingPlan().error).toBeTruthy()
    expect(setItem).not.toHaveBeenCalled()
  })
  it('uses its own key rather than touching ship progress', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem })
    saveCraftingPlan(emptyCraftingPlan())
    expect(setItem).toHaveBeenCalledExactlyOnceWith(
      craftingPlanStorageKey,
      JSON.stringify(emptyCraftingPlan()),
    )
  })
  it('reports unavailable storage and quota failures', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(loadCraftingPlan().error).toBe('blocked')
    expect(() => saveCraftingPlan(emptyCraftingPlan())).toThrow('quota')
  })
})
