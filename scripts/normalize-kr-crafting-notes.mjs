#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const usage = `Usage:
  node scripts/normalize-kr-crafting-notes.mjs \\
    --snapshot <Korean raw snapshot directory> \\
    --catalog <supported full extraction data directory> \\
    --output <crafting-notes.json>

The snapshot must contain data/manufacture.raw.json.
The catalog directory must contain items.json and recipes.json.`

const parseArgs = (argv) => {
  const result = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || !value) throw new Error(usage)
    result[key.slice(2)] = value
  }
  if (!result.snapshot || !result.catalog || !result.output) throw new Error(usage)
  return result
}

const itemId = (value) => {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    const match = value.match(/(?:urn::item:)?(\d+)$/)
    return match?.[1]
  }
  if (value && typeof value === 'object') return itemId(value.id ?? value.key)
  return undefined
}

const recipeSignature = (type, inputs) => {
  const merged = new Map()
  for (const input of inputs || []) {
    const id = itemId(input.item ?? input.itemId)
    const count = Number(input.count ?? input.quantity)
    if (!id || !Number.isFinite(count)) return undefined
    merged.set(id, (merged.get(id) || 0) + count)
  }
  return `${String(type).toUpperCase()}|${[...merged.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([id, count]) => `${id}:${count}`)
    .join(',')}`
}

export function normalizeKoreanManufacture(
  rawRecipes,
  catalogItems,
  catalogRecipes,
  koreanNames = {},
) {
  const names = new Map(
    catalogItems
      .map((item) => [itemId(item.id ?? item.urn), item.name])
      .filter(([id, name]) => id && typeof name === 'string' && name.length > 0),
  )
  for (const [id, name] of Object.entries(koreanNames)) names.set(id, name)
  const outputsBySignature = new Map()
  for (const recipe of catalogRecipes) {
    if (recipe.byproductOf) continue
    const signature = recipeSignature(recipe.type, recipe.inputs)
    const outputItemId = itemId(recipe.output)
    if (!signature || !outputItemId) continue
    const outputs = outputsBySignature.get(signature) || new Set()
    outputs.add(outputItemId)
    outputsBySignature.set(signature, outputs)
  }

  let matched = 0
  let ambiguous = 0
  const recipes = rawRecipes.map((recipe) => {
    const inputs = recipe.inputs.map((input) => {
      const id = itemId(input.item ?? input.itemId)
      return {
        itemId: id,
        name: id ? names.get(id) : undefined,
        count: Number(input.count),
      }
    })
    const candidates = [
      ...(outputsBySignature.get(recipeSignature(recipe.type, recipe.inputs)) || []),
    ]
    const matchState =
      candidates.length === 1 ? 'matched' : candidates.length ? 'ambiguous' : 'unmatched'
    if (matchState === 'matched') matched += 1
    if (matchState === 'ambiguous') ambiguous += 1
    const outputItemId = candidates.length === 1 ? candidates[0] : undefined
    return {
      sourceGroupId: String(recipe.group),
      type: recipe.type,
      successRate: Number(recipe.success),
      inputs,
      outputItemId,
      outputName: outputItemId ? names.get(outputItemId) : undefined,
      matchState,
      candidateOutputItemIds: candidates.length > 1 ? candidates : undefined,
    }
  })

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'Korean client manufacture.bss + versioned full recipe catalog',
    counts: {
      rawManufactureRecipes: rawRecipes.length,
      matched,
      ambiguous,
      unmatched: rawRecipes.length - matched - ambiguous,
    },
    recipes,
  }
}

async function main() {
  const { snapshot, catalog, output } = parseArgs(process.argv.slice(2))
  const [rawText, itemsText, recipesText, namesText] = await Promise.all([
    readFile(join(resolve(snapshot), 'data', 'manufacture.raw.json'), 'utf8'),
    readFile(join(resolve(catalog), 'items.json'), 'utf8'),
    readFile(join(resolve(catalog), 'recipes.json'), 'utf8'),
    readFile(join(resolve(snapshot), 'data', 'item-names.ko.json'), 'utf8'),
  ])
  const catalogItems = JSON.parse(itemsText)
  const catalogRecipes = JSON.parse(recipesText)
  const koreanNames = JSON.parse(namesText).names
  const optionalJson = async (path) => {
    try {
      return JSON.parse(await readFile(path, 'utf8'))
    } catch (error) {
      if (error.code === 'ENOENT') return { items: {} }
      throw error
    }
  }
  const [koreanDetails, koreanTexts, shipDescriptions] = await Promise.all([
    optionalJson(join(resolve(snapshot), 'data', 'item-details.ko.json')),
    optionalJson(join(resolve(catalog), 'item-texts.ko.json')),
    optionalJson(join(dirname(resolve(output)), 'ship-descriptions.ko.json')),
  ])
  const normalized = normalizeKoreanManufacture(
    JSON.parse(rawText),
    catalogItems,
    catalogRecipes,
    koreanNames,
  )
  const destination = resolve(output)
  await mkdir(dirname(destination), { recursive: true })
  try {
    const npcText = await readFile(join(resolve(catalog), 'npcs.json'), 'utf8')
    await writeFile(join(dirname(destination), 'npcs.json'), npcText, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await writeFile(destination, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  const localizedItems = catalogItems.map((item) => {
    const id = itemId(item.id ?? item.urn)
    const detail = koreanDetails.items[id]
    const text = koreanTexts.items[id]
    const codex = shipDescriptions.items[id]
    const description = detail?.description || text?.description || codex?.description
    return {
      ...item,
      name: koreanNames[id] ?? item.name,
      nameEn: item.name,
      nameLocale: koreanNames[id] ? 'ko' : 'en',
      ...(description
        ? {
            descriptionEn: item.description,
            description,
            descriptionLocale: 'ko',
            descriptionSource: detail?.description
              ? 'KR enchantstaticstatus'
              : text?.description
                ? text.sourcePath
                : `bdocodex:${id}`,
            ...(codex && !detail?.description && !text?.description
              ? { descriptionCheckedAt: codex.checkedAt }
              : {}),
          }
        : { descriptionLocale: 'en' }),
      ...(detail?.enhancement
        ? {
            globalEnhancement: item.enhancement,
            enhancement: detail.enhancement,
            enhancementSource: 'KR enchantstaticstatus',
          }
        : {}),
    }
  })
  const counts = {
    items: localizedItems.length,
    koreanNames: localizedItems.filter((item) => item.nameLocale === 'ko').length,
    englishFallbacks: localizedItems.filter((item) => item.nameLocale === 'en').length,
    recipes: catalogRecipes.length,
    koreanDescriptions: localizedItems.filter((item) => item.descriptionLocale === 'ko').length,
    koreanEnhancements: localizedItems.filter((item) => item.enhancementSource).length,
    manufacture: normalized.counts,
  }
  await Promise.all([
    writeFile(join(dirname(destination), 'items.ko.json'), JSON.stringify(localizedItems), 'utf8'),
    writeFile(join(dirname(destination), 'recipes.json'), recipesText, 'utf8'),
    writeFile(
      join(dirname(destination), 'report.json'),
      JSON.stringify(
        {
          generatedAt: normalized.generatedAt,
          sources: { koreanSnapshot: resolve(snapshot), globalCatalog: resolve(catalog) },
          counts,
          limitations: [
            'Korean descriptions come from KR enhancement text or global common item XML; missing descriptions and station names retain English.',
            'Global XML recipes are not all verified against Korean manufacture rows; consult matchState.',
          ],
        },
        null,
        2,
      ),
      'utf8',
    ),
  ])
  console.log(JSON.stringify(counts))
  console.log(
    `Wrote ${normalized.recipes.length.toLocaleString('en-US')} recipes: ` +
      `${normalized.counts.matched.toLocaleString('en-US')} matched, ` +
      `${normalized.counts.ambiguous.toLocaleString('en-US')} ambiguous, ` +
      `${normalized.counts.unmatched.toLocaleString('en-US')} unmatched.`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
