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

  it('moves a legacy trade ship carrack-upgrade stage into the combined second step', () => {
    const saved = structuredClone(sampleData)
    saved.ships[0].activeStage = 3

    const restored = normalize(saved)

    expect(restored.ships[0].activeStage).toBe(2)
    expect(restored.ships[1].activeStage).toBe(3)
  })

  it('moves legacy wave barter listings to the 1:1 variable-rate listing', () => {
    const saved = structuredClone(sampleData)
    saved.barterSession.exchangeCounts = { wave: 2 }

    expect(normalize(saved).barterSession.exchangeCounts).toEqual({ 'wave@1': 2 })
  })
})
