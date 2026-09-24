import { sampleData } from './sampleData'
import type { AppData } from './types'
import { clamp } from './utils'
import type { Hull, Stage } from './types'

const STORAGE_KEY = 'bdo-ship-materials:v1'
export const freshSample = (): AppData => ({ ...structuredClone(sampleData), updatedAt: new Date().toISOString() })
export function normalize(input: unknown): AppData {
  if (!input || typeof input !== 'object') throw new Error('데이터 형식이 올바르지 않습니다.')
  const raw = input as Partial<AppData>
  if (!Array.isArray(raw.ships)) throw new Error('함대 목록을 찾을 수 없습니다.')
  const hulls: Hull[] = ['trade','warship','balance','advance','volante','valor']
  return { version: 2, updatedAt: typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : new Date().toISOString(), inventory: Object.fromEntries(Object.entries(raw.inventory || {}).map(([k, v]) => [k, clamp(Number(v))])), ships: raw.ships.map((ship, index) => {
    if (!ship || typeof ship !== 'object') throw new Error(`${index + 1}번 함선 형식이 올바르지 않습니다.`)
    const item = ship as Partial<AppData['ships'][number]>; const hull = hulls.includes(item.hull as Hull) ? item.hull as Hull : 'trade'; const stage = Math.max(1, Math.min(5, Number(item.activeStage) || 1)) as Stage
    return { id: String(item.id || crypto.randomUUID()), name: String(item.name || hull).trim(), hull, activeStage: stage }
  }).filter(ship => ship.name) }
}
export function loadData(): AppData { try { const stored = localStorage.getItem(STORAGE_KEY); return stored ? normalize(JSON.parse(stored)) : freshSample() } catch (error) { console.warn('저장 데이터를 불러오지 못했습니다.', error); return freshSample() } }
export function saveData(data: AppData) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch (error) { console.error('저장에 실패했습니다.', error); throw new Error('브라우저 저장소에 저장하지 못했습니다.') } }
export function clearData() { localStorage.removeItem(STORAGE_KEY) }
