import { describe, expect, it } from 'vitest'
import { defaultEnvironment, parseEnvironment } from './environment'
import { masteryBracket, predictYield, predictedCrafts, processingBatch } from './yieldPrediction'
import { calculateCraftingPlan } from './planCalculation'
import { emptyCraftingPlan } from './planTypes'
import { parseCraftingPlan } from './planStorage'
const cook = { output: 'urn::item:1', type: 'COOK', inputs: [{ item: 'urn::item:2', count: 5 }] }
const choice = {
  mode: 'craft' as const,
  recipeIndex: 0,
  outputPerCraft: 1,
  yieldModel: 'cooking' as const,
}
const environment = () => ({
  ...defaultEnvironment(),
  cooking: { rank: 'master' as const, level: 1, mastery: 1480 },
  processing: { rank: 'master' as const, level: 15, mastery: 475, methods: { FIREWOOD: 1540 } },
})
describe('mastery-based conditional production predictions', () => {
  it('uses the lower bracket, never adds skill-level mastery twice', () => {
    expect(masteryBracket('cooking', 1480).mastery).toBe(1450)
    expect(masteryBracket('cooking', 1480).maxProc).toBe(0.3411)
    expect(predictYield(choice, cook, environment()).prediction?.mean).toBeCloseTo(
      2.5 + 1.5 * 0.3411,
    )
  })
  it('uses per-method processing mastery and does not multiply material yield by mass count', () => {
    const recipe = { ...cook, type: 'FIREWOOD' }
    const selected = { ...choice, yieldModel: 'processing' as const }
    expect(predictYield(selected, recipe, environment()).prediction).toMatchObject({
      mean: 2.5,
      batchGroup: 1,
    })
    expect(processingBatch(1540)).toBe(178)
    expect(
      predictYield(selected, recipe, { ...environment(), massProcessing: true }).prediction,
    ).toMatchObject({ mean: 2.5, batchGroup: 178 })
  })
  it('requires explicit rank/mastery and never applies cooking to workshop recipes', () => {
    expect(predictYield(choice, cook, defaultEnvironment()).error).toBeTruthy()
    expect(predictYield(choice, { ...cook, type: 'HOUSE' }, environment()).error).toBeTruthy()
    expect(
      predictYield(choice, { ...cook, byproductOf: 'urn::item:9' }, environment()).error,
    ).toContain('부산물')
  })
  it('does not guess the rare base chance from an item name or life rank', () => {
    const rare = { ...choice, yieldModel: 'rare-cooking' as const }
    expect(predictYield(rare, cook, environment()).error).toContain('기본 상위')
    const prediction = predictYield(rare, cook, {
      ...environment(),
      rareBaseChance: 0.2,
    }).prediction!
    expect(prediction.min).toBe(0)
    expect(prediction.mean).toBeCloseTo((1.5 + 0.5 * 0.3411) * (0.2 + 0.1089))
  })
  it('increases the recommended count for confidence, multiple nodes and batch correlations', () => {
    const prediction = predictYield(choice, cook, environment()).prediction!
    const mean = predictedCrafts(600, prediction, 'mean')
    const p95 = predictedCrafts(600, prediction, '95')
    const p99 = predictedCrafts(600, prediction, '99')
    expect(mean).toBe(Math.ceil(600 / prediction.mean))
    expect(p95).toBeGreaterThanOrEqual(mean)
    expect(p99).toBeGreaterThanOrEqual(p95)
    expect(predictedCrafts(600, prediction, '95', 5)).toBeGreaterThanOrEqual(p95)
    expect(predictedCrafts(600, { ...prediction, batchGroup: 1 }, '95')).toBeLessThanOrEqual(p95)
  })
  it('satisfies the Hoeffding lower-tail condition or the deterministic worst-case bound', () => {
    const prediction = {
      mean: 2.5,
      min: 1,
      max: 4,
      batchGroup: 1,
      model: 'processing' as const,
      explanation: '',
    }
    for (const target of [1, 2, 20, 600, 800])
      for (const confidence of ['95', '99'] as const) {
        const n = predictedCrafts(target, prediction, confidence, 3)
        const alpha = (confidence === '95' ? 0.05 : 0.01) / 3
        const lower = n * prediction.mean - 3 * Math.sqrt((n * Math.log(1 / alpha)) / 2)
        expect(lower >= target - 1e-9 || n * prediction.min >= target).toBe(true)
      }
    expect(predictedCrafts(600, { ...prediction, mean: 2, min: 2, max: 2 }, '99')).toBe(300)
    expect(predictedCrafts(0, prediction, '99')).toBe(0)
  })
  it('propagates conservative counts into combined material demand', () => {
    const data = {
      ...emptyCraftingPlan(),
      goals: [{ itemId: '1', name: '요리', quantity: 600 }],
      choices: { '1': choice },
      environment: { ...environment(), confidence: '95' as const },
    }
    const details = new Map([
      ['1', { item: { id: 1 }, recipes: [cook], usedIn: [] }],
      ['2', { item: { id: 2 }, recipes: [], usedIn: [] }],
    ])
    const result = calculateCraftingPlan(
      data,
      details,
      new Map([
        ['1', '요리'],
        ['2', '재료'],
      ]),
    )
    const row = result.rows.find((row) => row.id === '1')!
    expect(row.crafts).toBeGreaterThan(row.meanCrafts!)
    expect(result.rows.find((row) => row.id === '2')?.required).toBe(row.crafts * 5)
  })
  it('backs up environment and models, rejects invalid ranges and preserves legacy plans', () => {
    const data = {
      ...emptyCraftingPlan(),
      environment: environment(),
      choices: { '1': { ...choice, yieldConfirmed: false, yieldMin: 1, yieldMax: 4 } },
    }
    expect(parseCraftingPlan(JSON.parse(JSON.stringify(data)))).toEqual(data)
    expect(parseCraftingPlan(emptyCraftingPlan()).environment).toBeUndefined()
    expect(() =>
      parseCraftingPlan({ ...data, choices: { '1': { ...choice, yieldMin: 5, yieldMax: 4 } } }),
    ).toThrow()
    expect(() =>
      parseEnvironment({ ...environment(), cooking: { rank: 'invalid', level: 1, mastery: 1500 } }),
    ).toThrow()
    expect(() => parseEnvironment({ ...environment(), rareBaseChance: 5 })).toThrow()
  })
})
