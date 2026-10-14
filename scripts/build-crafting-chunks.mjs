import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { zstdCompressSync, zstdDecompressSync, constants } from 'node:zlib'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (index % 2 === 0) pairs.push([value.replace(/^--/, ''), all[index + 1]])
    return pairs
  }, []),
)
if (!args.catalog || !args.output)
  throw new Error(
    'Usage: node scripts/build-crafting-chunks.mjs --catalog <catalog dir> --output <public/crafting dir>',
  )
const catalog = resolve(args.catalog)
const output = resolve(args.output)
const [items, recipes] = await Promise.all(
  ['items.ko.json', 'recipes.json'].map(async (name) =>
    JSON.parse(await readFile(join(catalog, name), 'utf8')),
  ),
)
const idOf = (value) => String(value?.id ?? value?.urn ?? value ?? '').replace(/^urn::item:/, '')
const records = new Map(items.map((item) => [idOf(item), { item, recipes: [], usedIn: [] }]))
for (const recipe of recipes) {
  const outputId = idOf(recipe.output)
  if (!records.has(outputId))
    records.set(outputId, {
      item: { id: outputId, name: `아이템 ${outputId}`, nameLocale: 'en' },
      recipes: [],
      usedIn: [],
    })
  records.get(outputId).recipes.push(recipe)
  for (const input of recipe.inputs ?? []) {
    const inputId = idOf(input.item)
    const record = records.get(inputId)
    if (record && !record.usedIn.includes(outputId)) record.usedIn.push(outputId)
  }
}
await mkdir(output, { recursive: true })
const index = []
const chunks = []
let batch = {}
let bytes = 2
const maxBytes = Number(args['chunk-bytes'] ?? 1024 * 1024)
if (!Number.isFinite(maxBytes) || maxBytes < 1024)
  throw new Error('chunk-bytes must be at least 1024')
let originalBytes = 0
let compressedBytes = 0
async function save(value, prefix) {
  const raw = Buffer.from(JSON.stringify(value))
  const compressed = zstdCompressSync(raw, { params: { [constants.ZSTD_c_compressionLevel]: 9 } })
  if (!zstdDecompressSync(compressed).equals(raw)) throw new Error('Zstd roundtrip failed')
  const hash = createHash('sha256').update(compressed).digest('hex')
  const file = `${prefix}-${hash.slice(0, 16)}.json.zst`
  await writeFile(join(output, file), compressed)
  originalBytes += raw.length
  compressedBytes += compressed.length
  return { file, sha256: hash, bytes: compressed.length, decodedBytes: raw.length }
}
async function flush() {
  if (!Object.keys(batch).length) return
  chunks.push(await save(batch, `items-${String(chunks.length).padStart(3, '0')}`))
  batch = {}
  bytes = 2
}
for (const [id, record] of [...records].sort(([a], [b]) => Number(a) - Number(b))) {
  const recordBytes = Buffer.byteLength(JSON.stringify(record)) + id.length + 4
  if (bytes + recordBytes > maxBytes) await flush()
  batch[id] = record
  bytes += recordBytes
  index.push({
    id,
    name: record.item.name,
    nameEn: record.item.nameEn,
    grade: record.item.grade,
    category: record.item.category,
    chunk: chunks.length,
  })
}
await flush()
const searchIndex = await save(index, 'index')
let provenance
try {
  const report = JSON.parse(await readFile(join(catalog, 'report.json'), 'utf8'))
  provenance = {
    generatedAt: report.generatedAt,
    counts: report.counts,
    limitations: report.limitations,
  }
} catch {
  /* optional source report */
}
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  codec: 'zstd',
  itemCount: index.length,
  recipeCount: recipes.length,
  searchIndex,
  chunks,
  provenance,
  originalBytes,
  compressedBytes,
}
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(
  JSON.stringify({
    items: index.length,
    recipes: recipes.length,
    chunks: chunks.length,
    originalBytes,
    compressedBytes,
    indexBytes: searchIndex.bytes,
  }),
)
