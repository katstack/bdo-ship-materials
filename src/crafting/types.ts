export type SourceItem = {
  id?: number | string
  urn?: string
  name?: string
  nameEn?: string
  description?: string
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
