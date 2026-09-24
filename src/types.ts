export type Hull = 'trade' | 'warship' | 'balance' | 'advance' | 'volante' | 'valor'
export type Stage = 1 | 2 | 3 | 4 | 5
export type EquipmentSlot = 'figurehead' | 'plating' | 'cannon' | 'sail'
export interface MaterialDefinition { id: string; name: string; crowCoinPrice?: number; sources: string[] }
export interface Requirement { materialId: string; quantity: number }
export interface Recipe { id: string; name: string; stage: Stage; hulls: Hull[]; requirements: Requirement[]; description: string; slot?: EquipmentSlot }
export interface Ship { id: string; name: string; hull: Hull; activeStage: Stage; equipmentOrder: EquipmentSlot[] }
export type MaterialSortKey = 'name' | 'required' | 'owned' | 'shortage' | 'progress' | 'crowCoinPrice' | 'crowCoinTotal' | 'recipes'
export interface MaterialSort { key: MaterialSortKey; direction: 'asc' | 'desc' }
export interface AppData { version: 2; updatedAt: string; inventory: Record<string, number>; ships: Ship[]; materialSort: MaterialSort }
export interface AggregateMaterial extends MaterialDefinition { required: number; owned: number; shortage: number; progress: number; crowCoinTotal?: number; recipes: string[] }
