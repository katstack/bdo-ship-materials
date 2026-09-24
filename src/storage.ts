import { sampleData } from './sampleData'
import type { AppData } from './types'
import { clamp, keyOf } from './utils'

const STORAGE_KEY = 'bdo-ship-materials:v1'
export const freshSample = (): AppData => ({ ...structuredClone(sampleData), updatedAt: new Date().toISOString() })
export function normalize(input: unknown): AppData {
  if (!input || typeof input !== 'object') throw new Error('데이터 형식이 올바르지 않습니다.')
  const raw = input as Partial<AppData>
  if (!Array.isArray(raw.equipment)) throw new Error('장비 목록을 찾을 수 없습니다.')
  return { version: 1, updatedAt: typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : new Date().toISOString(), inventory: Object.fromEntries(Object.entries(raw.inventory || {}).map(([k, v]) => [keyOf(k), clamp(Number(v))])), equipment: raw.equipment.map((e, ei) => {
    if (!e || typeof e !== 'object') throw new Error(`${ei + 1}번 장비 형식이 올바르지 않습니다.`)
    const item = e as Partial<AppData['equipment'][number]>
    return { id: String(item.id || crypto.randomUUID()), name: String(item.name || '').trim(), grade: String(item.grade || '').trim(), materials: Array.isArray(item.materials) ? item.materials.map(m => ({ id: String(m.id || crypto.randomUUID()), name: String(m.name || '').trim(), required: clamp(Number(m.required)), note: String(m.note || ''), crowCoinPrice: m.crowCoinPrice === undefined || m.crowCoinPrice === null ? undefined : clamp(Number(m.crowCoinPrice)) })).filter(m => m.name) : [] }
  }).filter(e => e.name) }
}
export function loadData(): AppData { try { const stored = localStorage.getItem(STORAGE_KEY); return stored ? normalize(JSON.parse(stored)) : freshSample() } catch (error) { console.warn('저장 데이터를 불러오지 못했습니다.', error); return freshSample() } }
export function saveData(data: AppData) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch (error) { console.error('저장에 실패했습니다.', error); throw new Error('브라우저 저장소에 저장하지 못했습니다.') } }
export function clearData() { localStorage.removeItem(STORAGE_KEY) }
