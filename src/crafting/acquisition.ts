import { crowCoinPriceSource, items, latestCrowCoinPricesByName } from '../data/items'
import { materialExchangeOutputs } from '../data/materialExchanges'
import type { ItemDetail, SourceNpc } from './types'

type Vendor = {
  id?: string
  name: string
  regions: string[]
  condition?: string
  resolved: boolean
}
type Evidence = 'client-item-info' | 'client-dialogue' | 'official-update' | 'app-catalog'
export type Acquisition = {
  kind: 'npc-purchase' | 'crow-coin' | 'barter' | 'rental' | 'crafting' | 'gathering'
  evidence: Evidence
  sourceUrl?: string
  /** This is not a shop-specific offer or an assertion about its currency. */
  referencePrice?: number
  unitPrice?: number
  outputQuantities?: number[]
  vendors?: Vendor[]
  count?: number
  pointType?: number
  pointCost?: number
  condition?: string
  sources?: string[]
}

const normalizeName = (name: string) => name.replace(/\s+/g, '')
const coinPrices = new Map(
  Object.entries(latestCrowCoinPricesByName).map(([name, price]) => [normalizeName(name), price]),
)
const itemById = new Map(
  items.filter((item) => item.codexItemId).map((item) => [item.codexItemId!, item]),
)
const itemByName = new Map(items.map((item) => [normalizeName(item.name), item]))

function vendor(reference: string, npcs: ReadonlyMap<string, SourceNpc>): Vendor {
  const id = reference.replace(/^urn::npc:/, '')
  const npc = npcs.get(id)
  return {
    id,
    name: npc?.name ?? `NPC ${id}`,
    regions: [
      ...new Set(
        npc?.spawns?.map((spawn) => spawn.regionName).filter((name): name is string => !!name),
      ),
    ],
    condition: npc?.itemService?.conditionDsl,
    resolved: !!npc,
  }
}

/** Multiple acquisition methods can coexist. Never infer availability from buyPrice alone. */
export function getAcquisitions(
  detail: ItemDetail,
  npcs: ReadonlyMap<string, SourceNpc> = new Map(),
): Acquisition[] {
  const { item, recipes } = detail
  const id = String(item.id ?? item.urn ?? '').replace(/^urn::item:/, '')
  const name = normalizeName(item.name ?? '')
  const local = itemById.get(id) ?? itemByName.get(name)
  const price = local?.crowCoinPrice ?? coinPrices.get(name)
  const result: Acquisition[] = []
  const vendors = [...new Set(item.vendors?.urns ?? [])].map((reference) => vendor(reference, npcs))
  vendors.push(
    ...[...new Set(item.unresolvedVendors ?? [])].map((name) => ({
      name,
      regions: [],
      resolved: false,
    })),
  )
  if (vendors.length)
    result.push({
      kind: 'npc-purchase',
      evidence: 'client-item-info',
      vendors,
      // A known special-currency price must not be confused with OriginalPrice.
      referencePrice:
        price === undefined && Number.isFinite(item.buyPrice) && item.buyPrice! > 0
          ? item.buyPrice
          : undefined,
    })
  if (price !== undefined)
    result.push({
      kind: 'crow-coin',
      evidence: 'official-update',
      unitPrice: price,
      sourceUrl: crowCoinPriceSource.url,
    })
  // The barter calculator's unregistered 1:1 default is an assumption, not an acquisition source.
  const exchange = local && materialExchangeOutputs[local.materialId]
  if (exchange !== undefined)
    result.push({
      kind: 'barter',
      evidence: 'app-catalog',
      outputQuantities: Array.isArray(exchange) ? exchange : [exchange],
    })
  for (const offer of item.rentalOffers ?? [])
    result.push({
      kind: 'rental',
      evidence: 'client-dialogue',
      vendors: [vendor(offer.vendor, npcs)],
      count: offer.count,
      pointType: offer.pointType,
      pointCost: offer.pointCost,
      condition: offer.conditionDsl,
    })
  if (recipes.length)
    result.push({ kind: 'crafting', evidence: 'client-item-info', count: recipes.length })
  if (item.gatheredFrom?.length)
    result.push({
      kind: 'gathering',
      evidence: 'client-item-info',
      sources: [...new Set(item.gatheredFrom)],
    })
  return result
}
