import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const input = process.argv[2] ?? 'data/sources/garmoth-mastery.snapshot.json'
const content = await readFile(input, 'utf8')
const snapshot = JSON.parse(content)
const definitions = {
  cooking: [
    'productIncrease',
    'byProductIncrease',
    'rareProductIncrease',
    'massProductChance',
    'imperialSilverBonus',
  ],
  alchemy: [
    'productIncrease',
    'commonItemChance',
    'specialItemChance',
    'rareItemChance',
    'imperialSilverBonus',
  ],
  gathering: [
    'commonItemChance',
    'commonDropIncrease',
    'specialItemChance',
    'specialDropIncrease',
    'rareItemChance',
    'rareDropIncrease',
  ],
  fishing: ['prizeFishRate', 'prizeHarpoonLevel'],
  hunting: ['dropIncrease'],
  training: ['captureHorseRate', 'mountExpGain', 'breedingChance'],
  sailing: ['acceleration', 'brake', 'turn', 'speed'],
  processing: ['materialCount'],
}
if (snapshot.version !== 1 || !Number.isFinite(Date.parse(snapshot.checkedAt)))
  throw Error('Invalid snapshot metadata')
if (snapshot.tables.length !== Object.keys(definitions).length)
  throw Error('Expected all eight mastery tables')
const tables = {}
const parseCell = (cell) => {
  const match = /^([+-]?\d+(?:\.\d+)?)(%)?(?:\+(\d+(?:\.\d+)?)%)?$/.exec(cell)
  if (!match) throw Error(`Unknown numeric cell: ${cell}`)
  return {
    value: Number(match[1]),
    unit: match[2] ? 'percent' : 'count',
    delta: match[3] === undefined ? null : Number(match[3]),
  }
}
for (const table of snapshot.tables) {
  const keys = definitions[table.id]
  if (!keys || tables[table.id]) throw Error('Unknown or duplicate table')
  if (table.headers.length !== keys.length + 1) throw Error(`Column count changed: ${table.id}`)
  const rows = table.rows.map((cells) => {
    if (cells.length !== keys.length + 1) throw Error('Ragged table row')
    const mastery = Number(cells[0])
    if (!Number.isInteger(mastery) || mastery < 0 || mastery > 3000)
      throw Error('Invalid threshold')
    return {
      mastery,
      values: Object.fromEntries(keys.map((key, i) => [key, parseCell(cells[i + 1]).value])),
    }
  })
  const expected = table.id === 'processing' ? 76 : 61
  if (rows.length !== expected || rows.at(-1).mastery !== 3000)
    throw Error('Incomplete mastery table')
  if (rows.some((row, i) => i > 0 && row.mastery <= rows[i - 1].mastery))
    throw Error('Unsorted or duplicate thresholds')
  if (table.id !== 'processing' && rows.some((row, i) => row.mastery !== i * 50))
    throw Error('Missing mastery bracket')
  const columns = keys.map((key, i) => {
    const unit = parseCell(table.rows[0][i + 1]).unit
    if (table.rows.some((cells) => parseCell(cells[i + 1]).unit !== unit))
      throw Error('Mixed column units')
    return { key, sourceLabel: table.headers[i + 1], unit }
  })
  const result = { source: table.url, columns, rows }
  if (table.extra) {
    if (table.extra.rows.length !== rows.length) throw Error('Incomplete extra display table')
    result.extraSource = table.extra.url
    result.displayDeltas = table.extra.rows.map((cells, i) => {
      if (cells.length !== keys.length + 1 || Number(cells[0]) !== rows[i].mastery)
        throw Error('Extra thresholds differ')
      const deltas = {}
      keys.forEach((key, j) => {
        const cell = parseCell(cells[j + 1])
        if (cell.value !== rows[i].values[key]) throw Error('Extra display changes base value')
        deltas[key] = cell.delta
      })
      return { mastery: rows[i].mastery, values: deltas }
    })
  }
  tables[table.id] = result
}
const previous = JSON.parse(await readFile('src/data/masteryTables.json', 'utf8'))
const comparisons = []
for (const [kind, mappings] of Object.entries({
  cooking: {
    productIncrease: 'maxProc',
    byProductIncrease: 'rareMaxProc',
    rareProductIncrease: 'rareBonus',
    massProductChance: 'massChance',
  },
  alchemy: { productIncrease: 'maxProc' },
  processing: { materialCount: 'batch' },
})) {
  const discrepancies = []
  let matched = 0
  for (const row of tables[kind].rows) {
    const old = previous[kind].find((entry) => entry.mastery === row.mastery)
    if (!old) {
      discrepancies.push({
        mastery: row.mastery,
        reason: 'No identical threshold in existing source',
      })
      continue
    }
    for (const [field, oldField] of Object.entries(mappings)) {
      const oldValue = old[oldField] * (kind === 'processing' ? 1 : 100)
      if (Math.abs(row.values[field] - oldValue) > 0.000001)
        discrepancies.push({
          mastery: row.mastery,
          field,
          garmoth: row.values[field],
          existing: oldValue,
        })
      else matched++
    }
  }
  comparisons.push({ table: kind, matchedCells: matched, discrepancies })
}
const output = {
  version: 1,
  checkedAt: snapshot.checkedAt,
  publisher: 'Garmoth',
  upstreamSource: null,
  retrieval: snapshot.retrieval,
  snapshotSha256: createHash('sha256').update(content).digest('hex'),
  percentConvention:
    'Display percent: 34.11 means 34.11%, not 0.3411. Increase percentages may exceed 100; do not clamp.',
  notes: [
    'Column names retain source meaning; increase percentages are not automatically absolute probabilities.',
    'Processing starts at mastery 2 on Garmoth; preserved as published, not silently changed to 0.',
    'Only gathering extra display was retrievable. Other extra variants were unavailable and are not fabricated.',
    'No change to crafting yield assumptions or recipe output rules.',
  ],
  tables,
  comparisons,
}
await writeFile('src/data/garmothMastery.json', JSON.stringify(output, null, 2) + '\n')
console.log(
  JSON.stringify(
    {
      tables: Object.keys(tables).length,
      rows: Object.values(tables).reduce((sum, table) => sum + table.rows.length, 0),
      comparisons,
    },
    null,
    2,
  ),
)
