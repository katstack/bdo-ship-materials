export type CraftingGoal = { itemId: string; name: string; quantity: number }
export type CraftingChoice = {
  mode: 'craft' | 'obtain'
  recipeIndex: number
  outputPerCraft: number
  yieldConfirmed?: boolean
  yieldModel?: YieldModel
  yieldMin?: number
  yieldMax?: number
}
export type CraftingPlan = {
  version: 1
  goals: CraftingGoal[]
  choices: Record<string, CraftingChoice>
  inventory: Record<string, number>
  view: 'direct' | 'raw'
  sort: 'name' | 'shortage'
  environment?: CraftingEnvironment
}
export const emptyCraftingPlan = (): CraftingPlan => ({
  version: 1,
  goals: [],
  choices: {},
  inventory: {},
  view: 'direct',
  sort: 'name',
})
import type { CraftingEnvironment } from './environment'
export const yieldModels = ['manual', 'cooking', 'rare-cooking', 'alchemy', 'processing'] as const
export type YieldModel = (typeof yieldModels)[number]
