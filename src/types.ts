export type Hull = 'trade' | 'warship' | 'balance' | 'advance' | 'volante' | 'valor'
export type CarrackHull = 'balance' | 'advance' | 'volante' | 'valor'
export type Stage = 1 | 2 | 3 | 4 | 5
export type EquipmentSlot = 'figurehead' | 'plating' | 'cannon' | 'sail'
export interface MaterialDefinition { id: string; name: string; codexItemId?: string; crowCoinPrice?: number; sources: string[] }
export interface Requirement { materialId: string; quantity: number }
export interface Recipe { id: string; name: string; stage: Stage; hulls: Hull[]; requirements: Requirement[]; description: string; slot?: EquipmentSlot }
export interface Ship { id: string; name: string; hull: Hull; activeStage: Stage; upgradeHull?: CarrackHull; equipmentOrder: EquipmentSlot[] }
export type MaterialSortKey = 'name' | 'required' | 'owned' | 'shortage' | 'progress' | 'dailySupply' | 'weeklySupply' | 'estimatedDays' | 'crowCoinPrice' | 'crowCoinTotal' | 'recipes'
export interface MaterialSort { key: MaterialSortKey; direction: 'asc' | 'desc' }
export type MaterialExchangeSortKey = 'priority' | 'name' | 'shortage' | 'outputQuantity' | 'afterExchangeShortage' | 'progressGain' | 'exchangeCrowValue' | 'crowCoinTotal'
export interface MaterialExchangeSort { key: MaterialExchangeSortKey; direction: 'asc' | 'desc' }
export interface QuestRewardOption { id: string; label: string; rewards: Requirement[] }
export interface DailyTask { id: string; name: string; period: 'daily' | 'weekly'; rewards: Requirement[]; otherRewards?: string[]; choices?: QuestRewardOption[]; note: string; codexQuestId?: string; startLocationId?: string; giverId?: string; objective?: string; incompatibleQuestIds?: string[] }
export interface QuestRecord extends DailyTask { codexQuestId: string; startLocationId: string; objective: string }
export interface NpcDefinition { id: string; name: string; codexNpcId?: string }
export interface LocationDefinition { id: string; name: string }
export interface QuestRouteOption { id: string; label: string; questIds: string[] }
export interface QuestRoute { id: string; startLocationId: string; giverId?: string; name: string; description: string; options: QuestRouteOption[] }
export interface SupplyPlan { enabled: boolean; choiceId?: string }
export interface SupplyContribution { taskId: string; taskName: string; quantity: number; period: 'daily' | 'weekly' }
export interface MaterialSupply { daily: number; weekly: number; dailySources: SupplyContribution[]; weeklySources: SupplyContribution[] }
export interface AppData { version: 2; updatedAt: string; inventory: Record<string, number>; ships: Ship[]; materialSort: MaterialSort; materialExchangeSort: MaterialExchangeSort; completedTasks: Record<string, string>; supplyPlans: Record<string, SupplyPlan> }
export interface AggregateMaterial extends MaterialDefinition { required: number; owned: number; shortage: number; progress: number; dailySupply: number; weeklySupply: number; crowCoinTotal?: number; estimatedDays?: number; recipes: string[] }
