import type { SearchItem } from './types'

export function displayItemName(item: { name?: unknown; nameEn?: unknown }, id: string): string {
  if (typeof item.name === 'string' && item.name.trim()) return item.name
  if (typeof item.nameEn === 'string' && item.nameEn.trim()) return item.nameEn
  return `아이템 ${id}`
}

export function searchCatalog(items: SearchItem[], query: string): SearchItem[] {
  const text = query.trim().toLocaleLowerCase()
  return items.filter(
    (item) =>
      !text ||
      displayItemName(item, item.id).toLocaleLowerCase().includes(text) ||
      (typeof item.nameEn === 'string' && item.nameEn.toLocaleLowerCase().includes(text)) ||
      item.id === text,
  )
}
