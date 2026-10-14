import { describe, expect, it } from 'vitest'
import { displayItemName, searchCatalog } from './search'
import type { SearchItem } from './types'
import { resolveIngredientReference } from './types'

describe('catalog search', () => {
  it('resolves a +10 Chiro cannon ingredient only when its base item exists', () => {
    expect(resolveIngredientReference('167821906', new Map([['49746', '치로의 함포']]))).toEqual({
      id: '49746',
      enhancementLevel: 10,
    })
    expect(resolveIngredientReference('167821906', new Map())).toEqual({
      id: '167821906',
      enhancementLevel: 0,
    })
  })
  it('searches historical indexes containing missing and invalid names without crashing', () => {
    const items = [
      { id: '16263', chunk: 13 },
      { id: '1', name: '규격 각목', nameEn: 'Standardized Timber', chunk: 0 },
      { id: '2', name: null, nameEn: 123, chunk: 0 },
    ] as unknown as SearchItem[]
    expect(searchCatalog(items, '각목').map((item) => item.id)).toEqual(['1'])
    expect(searchCatalog(items, 'TIMBER').map((item) => item.id)).toEqual(['1'])
    expect(searchCatalog(items, '16263').map((item) => item.id)).toEqual(['16263'])
    expect(searchCatalog(items, '없는재료')).toEqual([])
    expect(displayItemName(items[0], '16263')).toBe('아이템 16263')
  })
})
