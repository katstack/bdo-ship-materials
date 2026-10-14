export type CraftingGoal = { itemId: string; name: string; quantity: number }
export type CraftingChoice = {
  mode: 'craft' | 'obtain'
  recipeIndex: number
  outputPerCraft: number
  yieldConfirmed?: boolean
}
export type CraftingPlan = {
  version: 1
  goals: CraftingGoal[]
  choices: Record<string, CraftingChoice>
  inventory: Record<string, number>
  view: 'direct' | 'raw'
  sort: 'name' | 'shortage'
}
export const emptyCraftingPlan = (): CraftingPlan => ({
  version: 1,
  goals: [],
  choices: {},
  inventory: {},
  view: 'direct',
  sort: 'name',
})
