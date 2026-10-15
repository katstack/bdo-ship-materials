import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib'
import { recipeId, recipeKind } from '../src/crafting/recipeIdentity.ts'

const outputArg = process.argv.indexOf('--output')
const root = resolve(outputArg >= 0 ? process.argv[outputArg + 1] : 'public/crafting')
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
async function decode(file) {
  const encoded = await readFile(join(root, file.file))
  if (createHash('sha256').update(encoded).digest('hex') !== file.sha256)
    throw Error('Invalid catalog hash')
  return JSON.parse(zstdDecompressSync(encoded).toString())
}
const index = await decode(manifest.searchIndex),
  byId = new Map(index.map((entry) => [entry.id, entry]))
const recipes = new Map()
for (const file of manifest.chunks) {
  const items = await decode(file)
  for (const [outputId, detail] of Object.entries(items))
    for (const recipe of detail.recipes) {
      const id = recipeId(recipe),
        item = byId.get(outputId)
      const entry = {
        id,
        outputId,
        name: item.name,
        nameEn: item.nameEn,
        category: recipe.type,
        chunk: item.chunk,
        type: recipe.type,
        station: recipe.station,
        kind: recipeKind(recipe, (id) => byId.get(id)?.category),
        inputs: recipe.inputs,
      }
      if (recipes.has(id) && JSON.stringify(recipes.get(id)) !== JSON.stringify(entry))
        throw Error('Recipe identity collision')
      recipes.set(id, entry)
    }
}
const entries = [...recipes.values()].sort((a, b) => a.id.localeCompare(b.id))
const raw = Buffer.from(JSON.stringify(entries)),
  encoded = zstdCompressSync(raw, { params: { [constants.ZSTD_c_compressionLevel]: 9 } })
const sha256 = createHash('sha256').update(encoded).digest('hex'),
  file = `recipes-${sha256.slice(0, 16)}.json.zst`
await writeFile(join(root, file), encoded)
manifest.recipeIndex = { file, sha256, bytes: encoded.length, decodedBytes: raw.length }
manifest.recipeIndexCount = entries.length
await writeFile(join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(
  `Recipe browser index: ${entries.length} unique recipes, ${encoded.length} compressed bytes. Item chunks unchanged.`,
)
