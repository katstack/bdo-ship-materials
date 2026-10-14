import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { load } from 'cheerio'

const directory = resolve(process.argv[2] ?? '')
if (!process.argv[2])
  throw new Error('Usage: node scripts/fetch-ship-descriptions.mjs <catalog directory>')
const items = JSON.parse(await readFile(join(directory, 'items.ko.json'), 'utf8'))
const destination = join(directory, 'ship-descriptions.ko.json')
let saved = { items: {} }
try {
  saved = JSON.parse(await readFile(destination, 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const targets = items.filter(
  (item) =>
    /팔라시의|치로의|토로의/.test(item.name ?? '') &&
    item.category === 'Vehicle' &&
    item.descriptionLocale !== 'ko',
)
for (const item of targets) {
  if (saved.items[item.id]) continue
  const url = `https://bdocodex.com/tip.php?id=item--${item.id}&enchant=0&l=kr&nf=on`
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error(`Codex ${item.id}: HTTP ${response.status}`)
  const html = await response.text()
  const page = load(html)
  if (!page('.card-header .clearfix').text().includes(`ID: ${item.id} `))
    throw new Error(`Unexpected tooltip for ${item.id}; stopped without guessing`)
  const begin = html.indexOf('- 설명 :')
  const end = html.indexOf('<div id="ed_box"', begin)
  if (begin < 0 || end < begin) throw new Error(`Description structure changed: ${item.id}`)
  const fragment = load(html.slice(begin + '- 설명 :'.length, end))
  fragment('br').replaceWith('\n')
  const description = fragment.root().text().trim()
  if (!/[가-힣]/.test(description)) throw new Error(`Korean description absent: ${item.id}`)
  saved.items[item.id] = {
    description,
    source: 'bdocodex',
    itemId: String(item.id),
    checkedAt: new Date().toISOString(),
  }
  await mkdir(directory, { recursive: true })
  await writeFile(destination, JSON.stringify(saved, null, 2), 'utf8')
  console.log(`${item.id} ${item.name}: saved`)
  await new Promise((done) => setTimeout(done, 300))
}
console.log(`Verified Korean ship descriptions: ${Object.keys(saved.items).length}`)
