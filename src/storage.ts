import { sampleData } from './sampleData'
import type { AppData, MaterialSortKey } from './types'
import { clamp } from './utils'
import type { Hull, Stage } from './types'
import { defaultEquipmentOrder, defaultUpgradeHull, upgradeTargets } from './catalog'

const STORAGE_KEY = 'bdo-ship-materials:v1'
export const freshSample = (): AppData => ({ ...structuredClone(sampleData), updatedAt: new Date().toISOString() })
export function normalize(input: unknown): AppData {
  if (!input || typeof input !== 'object') throw new Error('데이터 형식이 올바르지 않습니다.')
  const raw = input as Partial<AppData>
  if (!Array.isArray(raw.ships)) throw new Error('함대 목록을 찾을 수 없습니다.')
  const hulls: Hull[] = ['trade','warship','balance','advance','volante','valor']
  const sortKeys: MaterialSortKey[] = ['name','required','owned','shortage','progress','dailySupply','weeklySupply','estimatedDays','crowCoinPrice','crowCoinTotal','recipes']; const savedSort = raw.materialSort
  const completedTasks = Object.fromEntries(Object.entries(raw.completedTasks || {}).filter(([, value]) => typeof value === 'string')) as Record<string, string>
  // 2025년 5월에 활기찬 일리야 섬 I~III가 하나의 의뢰로 통합되었다.
  // 이전 화면에서 이미 체크한 날에는 새 통합 의뢰를 다시 수령하지 않도록 한다.
  const legacyLivelyDates = ['lively-iliya-1', 'lively-iliya-2', 'lively-iliya-3']
    .map((id) => completedTasks[id])
    .filter((date): date is string => Boolean(date))
  if (legacyLivelyDates.length > 0 && !completedTasks['lively-iliya']) {
    completedTasks['lively-iliya'] = legacyLivelyDates.sort()[legacyLivelyDates.length - 1]
  }
  for (const id of ['lively-iliya-1', 'lively-iliya-2', 'lively-iliya-3']) delete completedTasks[id]
  const supplyPlans = Object.fromEntries(Object.entries(raw.supplyPlans || {}).flatMap(([id, value]) => {
    if (!value || typeof value !== 'object') return []
    const plan = value as { enabled?: unknown; choiceId?: unknown }
    return [[id, { enabled: plan.enabled === true, ...(typeof plan.choiceId === 'string' ? { choiceId: plan.choiceId } : {}) }]]
  }))
  return { version: 2, updatedAt: typeof raw.updatedAt === 'string' && !Number.isNaN(Date.parse(raw.updatedAt)) ? raw.updatedAt : new Date().toISOString(), materialSort: savedSort && sortKeys.includes(savedSort.key) ? { key: savedSort.key, direction: savedSort.direction === 'asc' ? 'asc' : 'desc' } : { key: 'crowCoinTotal', direction: 'desc' }, completedTasks, supplyPlans, inventory: Object.fromEntries(Object.entries(raw.inventory || {}).map(([k, v]) => [k, clamp(Number(v))])), ships: raw.ships.map((ship, index) => {
    if (!ship || typeof ship !== 'object') throw new Error(`${index + 1}번 함선 형식이 올바르지 않습니다.`)
    const item = ship as Partial<AppData['ships'][number]>; const hull = hulls.includes(item.hull as Hull) ? item.hull as Hull : 'trade'; const stage = Math.max(1, Math.min(5, Number(item.activeStage) || 1)) as Stage
    const sourceHull = hull==='trade'||hull==='warship'?hull:null; const upgradeHull = sourceHull && upgradeTargets[sourceHull].includes(item.upgradeHull as typeof upgradeTargets[typeof sourceHull][number]) ? item.upgradeHull as typeof upgradeTargets[typeof sourceHull][number] : sourceHull ? defaultUpgradeHull[sourceHull] : undefined
    return { id: String(item.id || crypto.randomUUID()), name: String(item.name || hull).trim(), hull, activeStage: stage, upgradeHull, equipmentOrder: Array.isArray(item.equipmentOrder) && item.equipmentOrder.length === 4 ? item.equipmentOrder as AppData['ships'][number]['equipmentOrder'] : [...defaultEquipmentOrder[hull]] }
  }).filter(ship => ship.name) }
}
export function loadData(): AppData { try { const stored = localStorage.getItem(STORAGE_KEY); return stored ? normalize(JSON.parse(stored)) : freshSample() } catch (error) { console.warn('저장 데이터를 불러오지 못했습니다.', error); return freshSample() } }
export function saveData(data: AppData) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch (error) { console.error('저장에 실패했습니다.', error); throw new Error('브라우저 저장소에 저장하지 못했습니다.') } }
export function clearData() { localStorage.removeItem(STORAGE_KEY) }
