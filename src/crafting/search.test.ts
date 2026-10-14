import { describe, expect, it } from 'vitest'
import { displayItemName, searchCatalog } from './search'
import type { SearchItem } from './types'
import { resolveIngredientReference } from './types'

describe('catalog search', () => {
  const koreanItems: SearchItem[] = [
    { id: '9610', name: '특제 발렌시아 정식', nameEn: 'Special Valencia Meal', chunk: 0 },
    { id: '1', name: '규격 각목', chunk: 0 },
    { id: '2', name: '과일', chunk: 0 },
    { id: '3', name: '값', chunk: 0 },
  ]
  it('preserves results throughout Korean syllable composition', () => {
    for (const query of [
      '특제 발렌시아 정',
      '특제 발렌시아 정ㅅ',
      '특제 발렌시아 정시',
      '특제 발렌시아 정식',
    ])
      expect(searchCatalog(koreanItems, query).map((item) => item.id)).toEqual(['9610'])
    expect(searchCatalog(koreanItems, '규격 각ㅁ').map((item) => item.id)).toEqual(['1'])
    expect(searchCatalog(koreanItems, '특제 발렌시아 정ㅁ')).toEqual([])
  })
  it('handles compound vowels/finals and canonical Unicode forms', () => {
    expect(searchCatalog(koreanItems, '고').map((item) => item.id)).toEqual(['2'])
    expect(searchCatalog(koreanItems, '과').map((item) => item.id)).toEqual(['2'])
    expect(searchCatalog(koreanItems, '갑ㅅ').map((item) => item.id)).toEqual(['3'])
    expect(
      searchCatalog(koreanItems, '특제 발렌시아 정식'.normalize('NFD')).map((item) => item.id),
    ).toEqual(['9610'])
  })
  it('supports initial-consonant searches without treating final consonants as initials', () => {
    expect(searchCatalog(koreanItems, 'ㅌㅈ ㅂㄹㅅㅇ ㅈㅅ').map((item) => item.id)).toEqual([
      '9610',
    ])
    expect(searchCatalog(koreanItems, 'ㄱㄱ ㄱㅁ').map((item) => item.id)).toEqual(['1'])
    expect(searchCatalog(koreanItems, 'ㅄ').map((item) => item.id)).toEqual(['3'])
    expect(searchCatalog(koreanItems, 'ㅅ').map((item) => item.id)).toEqual(['9610'])
  })
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
