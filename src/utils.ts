import { dailyTasks, materialById, recipes } from './catalog'
import type { AggregateMaterial, AppData, MaterialSupply, Recipe, Ship, Stage, SupplyContribution } from './types'

export const number = (n: number) => new Intl.NumberFormat('ko-KR').format(n)
export const clamp = (n: number) => Math.max(0, Math.floor(Number(n) || 0))
export const progress = (owned: number, required: number) => required ? Math.min(100, Math.round(owned / required * 100)) : 100

const recipeHull = (ship: Ship, stage: Stage) => stage >= 3 && ship.upgradeHull ? ship.upgradeHull : ship.hull
export const shipRecipes = (ship: Ship) => recipes.filter(recipe => recipe.hulls.includes(recipeHull(ship, recipe.stage)) && recipe.stage === ship.activeStage)
export const recipeProgress = (recipe: Recipe, inventory: Record<string, number>) => recipe.requirements.length ? Math.round(recipe.requirements.reduce((sum, x) => sum + progress(clamp(inventory[x.materialId]), x.quantity), 0) / recipe.requirements.length) : 0
export const craftRecordKey = (shipId: string, recipeId: string) => `${shipId}:${recipeId}`
export const isRecipeCompleted = (data: AppData, shipId: string, recipeId: string) => Boolean(data.completedRecipes[craftRecordKey(shipId, recipeId)])

export function materialSupply(data: AppData, materialId: string): MaterialSupply {
  const result: MaterialSupply = { daily: 0, weekly: 0, dailySources: [], weeklySources: [] }
  dailyTasks.forEach(task => {
    const plan = data.supplyPlans[task.id]
    if (!plan?.enabled) return
    const selectedChoice = task.choices?.find(choice => choice.id === plan.choiceId)
    const rewards = [...task.rewards, ...(selectedChoice?.rewards || [])]
    const quantity = rewards.filter(reward => reward.materialId === materialId).reduce((sum, reward) => sum + reward.quantity, 0)
    if (!quantity) return
    const contribution: SupplyContribution = { taskId: task.id, taskName: task.name, quantity, period: task.period }
    if (task.period === 'daily') {
      result.daily += quantity
      result.dailySources.push(contribution)
    } else {
      result.weekly += quantity
      result.weeklySources.push(contribution)
    }
  })
  return result
}

export const estimatedSupplyDays = (shortage: number, daily: number, weekly: number) => {
  const averageDaily = daily + weekly / 7
  return shortage > 0 && averageDaily > 0 ? Math.ceil(shortage / averageDaily) : undefined
}

export function aggregate(data: AppData, scope: 'current' | 'all' = 'all'): AggregateMaterial[] {
  const map = new Map<string, AggregateMaterial>()
  data.ships.forEach(ship => recipes
    .filter(recipe => recipe.hulls.includes(recipeHull(ship, recipe.stage)) && (scope === 'all' ? recipe.stage >= ship.activeStage : recipe.stage === ship.activeStage) && !isRecipeCompleted(data, ship.id, recipe.id))
    .forEach(recipe => recipe.requirements.forEach(req => {
      const base = materialById[req.materialId]
      if (!base) return
      const old = map.get(req.materialId)
      if (old) {
        old.required += req.quantity
        old.recipes.push(`${ship.name} · ${recipe.name}`)
      } else {
        map.set(req.materialId, { ...base, required: req.quantity, owned: clamp(data.inventory[req.materialId]), shortage: 0, progress: 0, dailySupply: 0, weeklySupply: 0, crowCoinTotal: undefined, recipes: [`${ship.name} · ${recipe.name}`] })
      }
    })))
  return [...map.values()].map(item => {
    const shortage = Math.max(0, item.required - item.owned)
    const supply = materialSupply(data, item.id)
    return { ...item, shortage, progress: progress(item.owned, item.required), dailySupply: supply.daily, weeklySupply: supply.weekly, estimatedDays: estimatedSupplyDays(shortage, supply.daily, supply.weekly), crowCoinTotal: item.crowCoinPrice === undefined ? undefined : shortage * item.crowCoinPrice }
  })
}

export const stageProgress = (data: AppData, ship: Ship) => {
  const list = shipRecipes(ship)
  return list.length ? Math.round(list.reduce((sum, recipe) => sum + (isRecipeCompleted(data, ship.id, recipe.id) ? 100 : recipeProgress(recipe, data.inventory)), 0) / list.length) : 0
}
