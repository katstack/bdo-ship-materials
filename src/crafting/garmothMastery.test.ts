import { describe, expect, it } from 'vitest'
import data from '../data/garmothMastery.json'
import snapshot from '../../data/sources/garmoth-mastery.snapshot.json'

describe('Garmoth mastery snapshot', () => {
  it('retains all eight tables, 503 thresholds and every source column', () => {
    expect(Object.keys(data.tables).sort()).toEqual([
      'alchemy',
      'cooking',
      'fishing',
      'gathering',
      'hunting',
      'processing',
      'sailing',
      'training',
    ])
    expect(Object.values(data.tables).reduce((sum, table) => sum + table.rows.length, 0)).toBe(503)
    for (const table of Object.values(data.tables)) {
      const original = snapshot.tables.find((entry) => entry.url === table.source)!
      expect(table.columns.map((column) => column.sourceLabel)).toEqual(original.headers.slice(1))
      expect(table.rows.length).toBe(original.rows.length)
      table.rows.forEach((row, index) => {
        expect(row.mastery).toBe(Number(original.rows[index][0]))
        expect(Object.keys(row.values)).toEqual(table.columns.map((column) => column.key))
        expect(Object.values(row.values).every(Number.isFinite)).toBe(true)
      })
    }
  })
  it('preserves percentage points, increases over 100, integer units and source anomalies', () => {
    expect(
      data.tables.cooking.rows.find((row) => row.mastery === 1450)?.values.productIncrease,
    ).toBe(34.11)
    expect(data.tables.gathering.rows.at(-1)?.values.commonDropIncrease).toBe(500)
    expect(data.tables.processing.rows[0]).toEqual({ mastery: 2, values: { materialCount: 10 } })
    expect(data.tables.processing.columns[0].unit).toBe('count')
    expect(data.tables.fishing.columns[1].unit).toBe('count')
    expect(data.tables.gathering.displayDeltas[1].values.commonDropIncrease).toBe(16)
    expect(data.tables.gathering.displayDeltas[0].values.commonDropIncrease).toBeNull()
  })
  it('records unknown upstream attribution and differences instead of guessing', () => {
    expect(data.upstreamSource).toBeNull()
    expect(data.snapshotSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(data.comparisons.find((entry) => entry.table === 'cooking')?.discrepancies).toEqual([])
    expect(data.comparisons.find((entry) => entry.table === 'processing')?.discrepancies).toEqual([
      { mastery: 2, reason: 'No identical threshold in existing source' },
    ])
  })
})
