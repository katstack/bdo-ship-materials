import type { AggregateMaterial, MaterialExchangeSortKey, MaterialSortKey } from '../types'
export type BarterRow = AggregateMaterial & {
  exchangeKey: string
  outputQuantity: number
  variableOutput: boolean
  afterExchangeShortage: number
  progressGain: number
  exchangeCrowValue?: number
  priority: number
}
import { materialExchangeKey, materialExchangeOutputOptions } from '../data/materialExchanges'
export const toBarterRows = (
  rows: AggregateMaterial[],
  exchangeCounts: Record<string, number> = {},
): BarterRow[] =>
  rows
    .filter(
      (row) =>
        row.shortage > 0 ||
        materialExchangeOutputOptions(row.id).some((outputQuantity) => {
          const key =
            materialExchangeOutputOptions(row.id).length === 1
              ? row.id
              : materialExchangeKey(row.id, outputQuantity)
          return (exchangeCounts[key] || 0) > 0
        }),
    )
    .flatMap((row) => {
      const outputOptions = materialExchangeOutputOptions(row.id)
      return outputOptions.map((outputQuantity) => {
        const gained = Math.min(outputQuantity, row.shortage)
        const afterExchangeShortage = row.shortage - gained
        const afterProgress = row.required
          ? Math.min(100, Math.round(((row.owned + gained) / row.required) * 100))
          : 100
        const exchangeCrowValue =
          row.crowCoinPrice === undefined ? undefined : gained * row.crowCoinPrice
        return {
          ...row,
          exchangeKey:
            outputOptions.length === 1 ? row.id : materialExchangeKey(row.id, outputQuantity),
          outputQuantity,
          variableOutput: outputOptions.length > 1,
          afterExchangeShortage,
          progressGain: afterProgress - row.progress,
          exchangeCrowValue,
          priority: exchangeCrowValue ?? -1,
        }
      })
    })
export const sortBarterRows = (
  rows: BarterRow[],
  key: MaterialExchangeSortKey,
  direction: 'asc' | 'desc',
) =>
  [...rows].sort((a, b) => {
    const av = key === 'name' ? a.name : a[key]
    const bv = key === 'name' ? b.name : b[key]
    if (av === undefined && bv === undefined) return 0
    if (av === undefined) return 1
    if (bv === undefined) return -1
    const base =
      typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv, 'ko')
        : Number(av) - Number(bv)
    return direction === 'asc' ? base : -base
  })

export const sortMaterials = (
  rows: AggregateMaterial[],
  key: MaterialSortKey,
  direction: 'asc' | 'desc',
) =>
  [...rows].sort((a, b) => {
    const av = key === 'recipes' ? a.recipes.join(', ') : a[key]
    const bv = key === 'recipes' ? b.recipes.join(', ') : b[key]
    if (av === undefined && bv === undefined) return 0
    if (av === undefined) return 1
    if (bv === undefined) return -1
    const base =
      typeof av === 'string' && typeof bv === 'string'
        ? av.localeCompare(bv, 'ko')
        : Number(av) - Number(bv)
    return direction === 'asc' ? base : -base
  })
