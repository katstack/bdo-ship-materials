import type { SearchItem } from './types'

const initials = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const vowels = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const finals = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ']
const compounds: Record<string, string> = {
  ㄳ: 'ㄱㅅ',
  ㄵ: 'ㄴㅈ',
  ㄶ: 'ㄴㅎ',
  ㄺ: 'ㄹㄱ',
  ㄻ: 'ㄹㅁ',
  ㄼ: 'ㄹㅂ',
  ㄽ: 'ㄹㅅ',
  ㄾ: 'ㄹㅌ',
  ㄿ: 'ㄹㅍ',
  ㅀ: 'ㄹㅎ',
  ㅄ: 'ㅂㅅ',
  ㅘ: 'ㅗㅏ',
  ㅙ: 'ㅗㅐ',
  ㅚ: 'ㅗㅣ',
  ㅝ: 'ㅜㅓ',
  ㅞ: 'ㅜㅔ',
  ㅟ: 'ㅜㅣ',
  ㅢ: 'ㅡㅣ',
}

/** Match Korean IME intermediate text (정ㅅ / 정시) against completed syllables (정식). */
function decompose(text: string): string {
  let result = ''
  for (const char of text) {
    const code = char.codePointAt(0)!
    const offset = code - 0xac00
    const parts =
      offset >= 0 && offset < 11172
        ? initials[Math.floor(offset / 588)] +
          vowels[Math.floor((offset % 588) / 28)] +
          finals[offset % 28]
        : code >= 0x1100 && code <= 0x1112
          ? initials[code - 0x1100]
          : code >= 0x1161 && code <= 0x1175
            ? vowels[code - 0x1161]
            : code >= 0x11a8 && code <= 0x11c2
              ? finals[code - 0x11a7]
              : char
    for (const part of parts) result += compounds[part] ?? part
  }
  return result
}

const normalize = (text: string) => text.normalize('NFC').toLocaleLowerCase()
const isInitialQuery = (text: string) => /^[ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ\s]+$/.test(text)
const initialText = (text: string) =>
  [...text]
    .map((char) => {
      const offset = char.codePointAt(0)! - 0xac00
      return offset >= 0 && offset < 11172 ? initials[Math.floor(offset / 588)] : char
    })
    .join('')

// The 75k-item index is normalized once, not decomposed again on every keystroke.
const cache = new WeakMap<
  SearchItem[],
  { item: SearchItem; names: string[]; decomposed: string; initials: string }[]
>()

export function displayItemName(item: { name?: unknown; nameEn?: unknown }, id: string): string {
  if (typeof item.name === 'string' && item.name.trim()) return item.name
  if (typeof item.nameEn === 'string' && item.nameEn.trim()) return item.nameEn
  return `아이템 ${id}`
}

export function searchCatalog(items: SearchItem[], query: string): SearchItem[] {
  const text = normalize(query.trim())
  if (!text) return items
  let prepared = cache.get(items)
  if (!prepared) {
    prepared = items.map((item) => {
      const name = normalize(displayItemName(item, item.id))
      return {
        item,
        names: [name, ...(typeof item.nameEn === 'string' ? [normalize(item.nameEn)] : [])],
        decomposed: decompose(name),
        initials: initialText(name),
      }
    })
    cache.set(items, prepared)
  }
  const initialOnly = isInitialQuery(text)
  const partial = decompose(text)
  return prepared
    .filter(
      ({ item, names, decomposed, initials }) =>
        item.id === text ||
        names.some((name) => name.includes(text)) ||
        (initialOnly ? initials.includes(text) : decomposed.includes(partial)),
    )
    .map(({ item }) => item)
}
