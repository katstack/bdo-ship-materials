export type Hull = 'trade' | 'warship' | 'balance' | 'advance' | 'volante' | 'valor'
export type Stage = 1 | 2 | 3 | 4 | 5
export interface MaterialDefinition { id: string; name: string; crowCoinPrice?: number; sources: string[] }
export interface Requirement { materialId: string; quantity: number }
export interface Recipe { id: string; name: string; stage: Stage; hulls: Hull[]; requirements: Requirement[]; description: string }
export interface Ship { id: string; name: string; hull: Hull; activeStage: Stage }
export interface AppData { version: 2; updatedAt: string; inventory: Record<string, number>; ships: Ship[] }
export interface AggregateMaterial extends MaterialDefinition { required: number; owned: number; shortage: number; progress: number; crowCoinTotal?: number; recipes: string[] }
