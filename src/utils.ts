import type { AggregateMaterial, AppData, Equipment } from './types'

export const number = (value: number) => new Intl.NumberFormat('ko-KR').format(value)
export const clamp = (value: number) => Math.max(0, Math.floor(Number(value) || 0))
export const progress = (owned: number, required: number) => required > 0 ? Math.min(100, Math.round((owned / required) * 100)) : 100
export const keyOf = (name: string) => name.trim().toLocaleLowerCase()
export function aggregate(data: AppData): AggregateMaterial[] {
  const map = new Map<string, AggregateMaterial>()
  data.equipment.forEach(e => e.materials.forEach(m => {
    const key = keyOf(m.name); const existing = map.get(key)
    if (existing) existing.required += m.required
    else map.set(key, { key, name: m.name.trim(), required: m.required, owned: clamp(data.inventory[key]), shortage: 0, progress: 0, note: m.note, crowCoinPrice: m.crowCoinPrice })
  }))
  return [...map.values()].map(m => ({ ...m, shortage: Math.max(m.required - m.owned, 0), progress: progress(m.owned, m.required) }))
}
export function equipmentProgress(equipment: Equipment, inventory: Record<string, number>) {
  if (!equipment.materials.length) return 0
  return Math.round(equipment.materials.reduce((total, m) => total + progress(clamp(inventory[keyOf(m.name)]), m.required), 0) / equipment.materials.length)
}
export function isComplete(equipment: Equipment, inventory: Record<string, number>) { return equipment.materials.length > 0 && equipmentProgress(equipment, inventory) === 100 }
export function overallProgress(data: AppData) { const all = data.equipment.flatMap(e => e.materials); return all.length ? Math.round(all.reduce((sum, m) => sum + progress(clamp(data.inventory[keyOf(m.name)]), m.required), 0) / all.length) : 0 }
