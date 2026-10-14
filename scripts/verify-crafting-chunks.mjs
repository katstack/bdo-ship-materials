import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { decompress } from 'fzstd'
import { deepStrictEqual } from 'node:assert'

const directory = resolve(process.argv[2] ?? 'public/crafting')
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'))
async function decode(file) {
  const encoded = await readFile(join(directory, file.file))
  if (createHash('sha256').update(encoded).digest('hex') !== file.sha256)
    throw new Error(`Hash mismatch: ${file.file}`)
  const raw = decompress(encoded)
  if (raw.byteLength !== file.decodedBytes) throw new Error(`Size mismatch: ${file.file}`)
  return JSON.parse(new TextDecoder().decode(raw))
}
const index = await decode(manifest.searchIndex)
const chunks = []
for (const file of manifest.chunks) chunks.push(await decode(file))
let recipeCount = 0
for (const entry of index) {
  const record = chunks[entry.chunk]?.[entry.id]
  const name =
    record &&
    (typeof record.item.name === 'string' && record.item.name.trim()
      ? record.item.name
      : typeof record.item.nameEn === 'string' && record.item.nameEn.trim()
        ? record.item.nameEn
        : `아이템 ${entry.id}`)
  if (!record || name !== entry.name || typeof entry.name !== 'string')
    throw new Error(`Index mismatch: ${entry.id}`)
  recipeCount += record.recipes.length
}
if (index.length !== manifest.itemCount || recipeCount !== manifest.recipeCount)
  throw new Error('Catalog counts mismatch')
if (process.argv[3]) {
  const original = resolve(process.argv[3])
  const [items, recipes] = await Promise.all(
    ['items.ko.json', 'recipes.json'].map(async (name) =>
      JSON.parse(await readFile(join(original, name), 'utf8')),
    ),
  )
  const byId = new Map(index.map((entry) => [entry.id, chunks[entry.chunk][entry.id]]))
  const idOf = (value) => String(value?.id ?? value?.urn ?? value).replace(/^urn::item:/, '')
  for (const item of items) deepStrictEqual(byId.get(idOf(item))?.item, item)
  const recipesByOutput = new Map()
  for (const recipe of recipes) {
    const id = idOf(recipe.output)
    const list = recipesByOutput.get(id) ?? []
    list.push(recipe)
    recipesByOutput.set(id, list)
  }
  for (const [id, list] of recipesByOutput) deepStrictEqual(byId.get(id)?.recipes, list)
  console.log('All original item fields and recipe records are preserved.')
}
console.log(
  `Browser decoder verified ${index.length} items, ${recipeCount} recipes and ${chunks.length} chunks.`,
)
