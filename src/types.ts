export interface MaterialRequirement { id: string; name: string; required: number; note: string; crowCoinPrice?: number }
export interface Equipment { id: string; name: string; grade: string; materials: MaterialRequirement[] }
export interface AppData { version: 1; updatedAt: string; equipment: Equipment[]; inventory: Record<string, number> }
export interface AggregateMaterial { key: string; name: string; required: number; owned: number; shortage: number; progress: number; note: string; crowCoinPrice?: number }
