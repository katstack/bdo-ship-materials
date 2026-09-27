import { describe, expect, it } from 'vitest'
import { sampleData } from './sampleData'
import { normalize } from './storage'

describe('stored progress normalization', () => {
  it('rejects a payload that does not contain a fleet', () => {
    expect(() => normalize({ inventory: {} })).toThrow('함대 목록')
  })

  it('keeps valid progress while safely restoring invalid presentation preferences', () => {
    const restored = normalize({
      ...structuredClone(sampleData),
      materialSort: { key: 'not-a-sort-key', direction: 'sideways' },
      materialExchangeSort: { key: 'not-a-sort-key', direction: 'sideways' },
      barterSession: { costPerExchange: -1, addToInventory: false, exchangeCounts: { rock: -3 } },
      completedRecipes: { invalid: { completedAt: 3, consumedMaterials: 'bad' } },
    })

    expect(restored.materialSort).toEqual({ key: 'crowCoinTotal', direction: 'desc' })
    expect(restored.materialExchangeSort).toEqual({ key: 'priority', direction: 'desc' })
    expect(restored.barterSession).toEqual({
      costPerExchange: 0,
      addToInventory: false,
      exchangeCounts: { rock: 0 },
    })
    expect(restored.completedRecipes).toEqual({})
    expect(restored.ships).toHaveLength(sampleData.ships.length)
  })
})
