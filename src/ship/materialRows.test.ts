import { describe, expect, it } from 'vitest'
import { freshSample } from '../storage'
import { aggregateMaterialDemand, fleetDemandScope } from '../domain/materialDemand'
import { sortMaterials, sortBarterRows, toBarterRows } from './materialRows'

const row = () => ({
  ...aggregateMaterialDemand(freshSample(), fleetDemandScope('all'))[0],
  id: 'unregistered',
  required: 10,
  owned: 9,
  shortage: 1,
  progress: 90,
  crowCoinPrice: 30,
})
describe('material and barter selectors', () => {
  it('defaults unknown exchange ratios to 1:1 and caps useful value at shortage', () => {
    expect(toBarterRows([row()])[0]).toMatchObject({
      outputQuantity: 1,
      afterExchangeShortage: 0,
      progressGain: 10,
      priority: 30,
    })
  })
  it('keeps a fully stocked row when a transaction is still planned', () => {
    const full = { ...row(), owned: 10, shortage: 0, progress: 100 }
    expect(toBarterRows([full])).toEqual([])
    expect(toBarterRows([full], { unregistered: 1 })[0]).toMatchObject({
      progressGain: 0,
      priority: 0,
    })
  })
  it('sorts without mutating demand rows and keeps unknown estimates last', () => {
    const rows = [
      { ...row(), id: 'unknown', estimatedDays: undefined },
      { ...row(), id: 'known', estimatedDays: 2 },
    ]
    expect(sortMaterials(rows, 'estimatedDays', 'asc').map((x) => x.id)).toEqual([
      'known',
      'unknown',
    ])
    expect(sortMaterials(rows, 'estimatedDays', 'desc').map((x) => x.id)).toEqual([
      'known',
      'unknown',
    ])
    expect(rows[0].id).toBe('unknown')
  })
  it('sorts barter by useful crow coin value without changing the source', () => {
    const rows = toBarterRows([
      { ...row(), id: 'a', crowCoinPrice: 10 },
      { ...row(), id: 'b', crowCoinPrice: 40 },
    ])
    expect(sortBarterRows(rows, 'priority', 'desc').map((x) => x.id)).toEqual(['b', 'a'])
    expect(rows.map((x) => x.id)).toEqual(['a', 'b'])
  })
})
