import { describe, expect, it } from 'vitest'
import { getAcquisitions } from './acquisition'
import type { ItemDetail, SourceItem, SourceNpc } from './types'

const detail = (item: SourceItem): ItemDetail => ({ item, recipes: [], usedIn: [] })
describe('item acquisition methods', () => {
  it('does not infer NPC sales or barter availability from a price alone', () => {
    expect(getAcquisitions(detail({ id: 4001, name: '철 광석', buyPrice: 2000 }))).toEqual([])
  })
  it('resolves vendor IDs and unique regions, retaining unavailable vendor names', () => {
    const npcs = new Map<string, SourceNpc>([
      [
        '40013',
        {
          id: 40013,
          name: 'David Finto',
          spawns: [{ regionName: 'Velia' }, { regionName: 'Velia' }],
          itemService: { conditionDsl: 'test-condition' },
        },
      ],
    ])
    const [method] = getAcquisitions(
      detail({
        id: 9002,
        name: '설탕',
        buyPrice: 20,
        vendors: { urns: ['urn::npc:40013', 'urn::npc:40013', 'urn::npc:99999'] },
        unresolvedVendors: ['Unresolved merchant'],
      }),
      npcs,
    )
    expect(method.kind).toBe('npc-purchase')
    expect(method.referencePrice).toBe(20)
    expect(method.vendors).toHaveLength(3)
    expect(method.vendors?.[0]).toMatchObject({
      id: '40013',
      regions: ['Velia'],
      condition: 'test-condition',
    })
    expect(method.vendors?.[1]).toMatchObject({ resolved: false, name: 'NPC 99999' })
  })
  it('keeps multiple acquisition methods and currencies separate', () => {
    const methods = getAcquisitions(
      detail({
        id: 5812,
        name: '짙은 파도빛이 감도는 규격 각목',
        buyPrice: 12345,
        vendors: { urns: ['urn::npc:1'] },
      }),
    )
    expect(methods.map((method) => method.kind)).toEqual(['npc-purchase', 'crow-coin', 'barter'])
    expect(methods[0].referencePrice).toBeUndefined()
    expect(methods[1].unitPrice).toBe(80)
    expect(methods[2].outputQuantities).toEqual([1, 2])
  })
  it('does not turn the barter calculator default into a verified exchange', () => {
    const methods = getAcquisitions(detail({ id: 5824, name: '콕스해적단의 유물 (전투)' }))
    expect(methods.map((method) => method.kind)).toEqual(['crow-coin'])
  })
  it('matches recorded name-only prices including spacing variations', () => {
    const [method] = getAcquisitions(
      detail({ id: 'unknown', name: '콕스해적단의 유물 (협상 하급)' }),
    )
    expect(method).toMatchObject({ kind: 'crow-coin', unitPrice: 120 })
  })
  it('keeps rental cost, currency type and conditions independent of buyPrice', () => {
    const [method] = getAcquisitions(
      detail({
        id: 3001,
        buyPrice: 999,
        rentalOffers: [
          {
            vendor: 'urn::npc:40044',
            pointType: 5,
            pointCost: 10,
            count: 1,
            conditionDsl: '!getitemcount(3001,0)>0;',
          },
        ],
      }),
    )
    expect(method).toMatchObject({ kind: 'rental', pointType: 5, pointCost: 10, count: 1 })
    expect(method.referencePrice).toBeUndefined()
  })
  it('retains crafting and gathering together', () => {
    const data = detail({ id: 1, gatheredFrom: ['Rock', 'Rock'] })
    data.recipes = [{ output: 'urn::item:1', type: 'HEAT', inputs: [] }]
    expect(getAcquisitions(data).map((method) => method.kind)).toEqual(['crafting', 'gathering'])
    expect(getAcquisitions(data)[1].sources).toEqual(['Rock'])
  })
})
