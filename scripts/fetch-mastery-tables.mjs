import { writeFile } from 'node:fs/promises'
import { load } from 'cheerio'
const result = {
  checkedAt: new Date().toISOString(),
  source: 'https://bdocodex.com/kr/cookingmastery/',
  officialSource: 'https://www.kr.playblackdesert.com/ko-KR/News/Detail?groupContentNo=13398',
  cooking: [],
  alchemy: [],
  processing: [],
}
for (const kind of ['cooking', 'alchemy']) {
  const response = await fetch(`https://bdocodex.com/query.php?a=${kind}mastery&l=kr`)
  if (!response.ok) throw new Error(`Mastery fetch failed: ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data.aaData)) throw new Error('Mastery table format changed')
  result[kind] = data.aaData
    .map((row) => {
      if (row.length !== 6) throw new Error('Unexpected mastery columns')
      const values = row.map((value) => Number(String(value).replace('%', '')))
      if (
        values.some((value) => !Number.isFinite(value)) ||
        values[0] < 0 ||
        values[0] > 3000 ||
        values.slice(1, 5).some((value) => value < 0 || value > 100)
      )
        throw new Error('Invalid mastery row')
      return {
        mastery: values[0],
        maxProc: values[1] / 100,
        ...(kind === 'cooking'
          ? {
              rareMaxProc: values[2] / 100,
              rareBonus: values[3] / 100,
              massChance: values[4] / 100,
            }
          : {}),
      }
    })
    .sort((a, b) => a.mastery - b.mastery)
  if (
    result[kind].length !== 61 ||
    new Set(result[kind].map((row) => row.mastery)).size !== 61 ||
    result[kind].some((row) => row.mastery % 50 !== 0)
  )
    throw new Error('Expected mastery 0..3000 in steps of 50')
}
const official = await fetch(result.officialSource)
if (!official.ok) throw new Error('Official mastery table fetch failed')
const $ = load(await official.text())
const processing = new Map()
$('table').each((_, table) => {
  if (!$(table).text().includes('대량 가공 횟수')) return
  $(table).find('br').replaceWith('\n')
  $(table)
    .find('tr')
    .each((_, tr) => {
      const cells = $(tr).find('td')
      for (let i = 0; i + 1 < cells.length; i += 2) {
        const mastery = $(cells[i]).text().match(/\d+/g)?.map(Number) ?? []
        const counts =
          $(cells[i + 1])
            .text()
            .match(/\d+/g)
            ?.map(Number) ?? []
        if (mastery.length !== counts.length) throw new Error('Processing table layout changed')
        mastery.forEach((value, index) => {
          if (processing.has(value) && processing.get(value) !== counts[index])
            throw new Error('Conflicting processing mastery brackets')
          processing.set(value, counts[index])
        })
      }
    })
})
result.processing = [...processing]
  .map(([mastery, batch]) => ({ mastery, batch }))
  .sort((a, b) => a.mastery - b.mastery)
if (
  result.processing.length < 70 ||
  result.processing[0].mastery !== 0 ||
  result.processing.at(-1).mastery !== 3000 ||
  result.processing.some((row) => row.batch < 1 || row.batch > 1000)
)
  throw new Error('Official processing table validation failed')
await writeFile('src/data/masteryTables.json', JSON.stringify(result, null, 2) + '\n')
console.log('Saved cooking/alchemy mastery brackets, source and check timestamp.')
