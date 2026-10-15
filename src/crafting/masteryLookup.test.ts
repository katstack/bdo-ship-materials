import { describe, expect, it } from 'vitest'
import { lookupMasteryBracket, masteryEvidence } from './masteryLookup'
import { masteryBracket, processingBatch } from './yieldPrediction'

describe('documented mastery lookup policy', () => {
  it('preserves official and reverse-engineering evidence as separate sources', () => {
    expect(masteryEvidence.official.kind).toBe('official')
    expect(masteryEvidence.official.url).toContain('groupContentNo=13398')
    expect(masteryEvidence.clientFormat.kind).toBe('community-reverse-engineering')
    expect(masteryEvidence.clientFormat.url).toContain('FORMATS.md#')
    expect(masteryEvidence.lookupPolicy.interpolate).toBe(false)
    expect(masteryEvidence.lookupPolicy.extrapolate).toBe(false)
  })
  it('uses lower brackets rather than interpolated percentages', () => {
    expect(masteryBracket('cooking', 1480).mastery).toBe(1450)
    expect(masteryBracket('cooking', 1480).maxProc).toBe(0.3411)
    expect(masteryBracket('cooking', 1500).mastery).toBe(1500)
    expect(masteryBracket('alchemy', 1472).mastery).toBe(1450)
    expect(processingBatch(1540)).toBe(178)
  })
  it('clamps ends, rejects invalid values and handles nonuniform thresholds', () => {
    const rows = [{ mastery: 0 }, { mastery: 20 }, { mastery: 75 }]
    expect(lookupMasteryBracket(rows, 74)).toBe(rows[1])
    expect(lookupMasteryBracket(rows, -1)).toBe(rows[0])
    expect(lookupMasteryBracket(rows, 999)).toBe(rows[2])
    expect(() => lookupMasteryBracket(rows, NaN)).toThrow()
    expect(() => lookupMasteryBracket([], 100)).toThrow()
  })
})
