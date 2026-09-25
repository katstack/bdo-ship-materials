export type Hull = 'trade' | 'warship' | 'balance' | 'advance' | 'volante' | 'valor'
export type CarrackHull = 'balance' | 'advance' | 'volante' | 'valor'
export type Stage = 1 | 2 | 3 | 4 | 5
export type EquipmentSlot = 'figurehead' | 'plating' | 'cannon' | 'sail'
export interface MaterialDefinition { id: string; name: string; crowCoinPrice?: number; sources: string[] }
export interface Requirement { materialId: string; quantity: number }
export interface Recipe { id: string; name: string; stage: Stage; hulls: Hull[]; requirements: Requirement[]; description: string; slot?: EquipmentSlot }
export interface Ship { id: string; name: string; hull: Hull; activeStage: Stage; upgradeHull?: CarrackHull; equipmentOrder: EquipmentSlot[] }
export type MaterialSortKey = 'name' | 'required' | 'owned' | 'shortage' | 'progress' | 'estimatedDays' | 'crowCoinPrice' | 'crowCoinTotal' | 'recipes'
export interface MaterialSort { key: MaterialSortKey; direction: 'asc' | 'desc' }
export interface QuestRewardOption { id: string; label: string; rewards: Requirement[] }
export interface DailyTask { id: string; name: string; period: 'daily' | 'weekly'; rewards: Requirement[]; choices?: QuestRewardOption[]; note: string }
export interface AppData { version: 2; updatedAt: string; inventory: Record<string, number>; ships: Ship[]; materialSort: MaterialSort; completedTasks: Record<string, string> }
export interface AggregateMaterial extends MaterialDefinition { required: number; owned: number; shortage: number; progress: number; crowCoinTotal?: number; estimatedDays?: number; recipes: string[] }
