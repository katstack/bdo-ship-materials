export type SourceItem = {
  id?: number | string
  urn?: string
  name?: string
  nameEn?: string
  description?: string
  descriptionLocale?: string
  descriptionSource?: string
  enhancementSource?: string
  enhancement?: {
    levels?: EnhancementLevel[]
    [key: string]: unknown
  }
  grade?: string
  category?: string
  [key: string]: unknown
}
export type SourceRecipe = {
  output: string
  type: string
  station?: string
  inputs: { item: string; count?: number }[]
  [key: string]: unknown
}
export type ItemDetail = { item: SourceItem; recipes: SourceRecipe[]; usedIn: string[] }
export type EnhancementStat = {
  func: string
  stat?: string
  value?: number
  op?: string
  unit?: string
}
export type EnhancementLevel = {
  level: number
  durability?: number
  effects?: { stats?: EnhancementStat[] }[]
}
export type SearchItem = {
  id: string
  name: string
  nameEn?: string
  grade?: string
  category?: string
  chunk: number
}
export type ChunkFile = { file: string; sha256: string; bytes: number; decodedBytes: number }
export type CatalogManifest = {
  schemaVersion: number
  generatedAt: string
  itemCount: number
  recipeCount: number
  searchIndex: ChunkFile
  chunks: ChunkFile[]
}
export const sourceItemId = (reference: string) => reference.replace(/^urn::item:/, '')

export function resolveIngredientReference(id: string, knownNames: ReadonlyMap<string, string>) {
  const packed = Number(id)
  const level = Math.floor(packed / 0x1000000)
  const baseId = String(packed % 0x1000000)
  if (Number.isSafeInteger(packed) && level >= 1 && level <= 20 && knownNames.has(baseId)) {
    return { id: baseId, enhancementLevel: level }
  }
  return { id, enhancementLevel: 0 }
}
