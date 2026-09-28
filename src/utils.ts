import { recipes } from './data/recipes'
import type { AppData, Recipe, Ship } from './types'
import { isRecipeCompleted } from './domain/crafting'
export { estimatedSupplyDays, materialSupply } from './domain/supply'

export const number = (n: number) => new Intl.NumberFormat('ko-KR').format(n)
export const clamp = (n: number) => Math.max(0, Math.floor(Number(n) || 0))
export const progress = (owned: number, required: number) =>
  required ? Math.min(100, Math.round((owned / required) * 100)) : 100

const recipeHull = (ship: Ship, recipe: Recipe) =>
  recipe.usesUpgradeHull && ship.upgradeHull ? ship.upgradeHull : ship.hull
export const shipRecipes = (ship: Ship) =>
  recipes.filter(
    (recipe) =>
      recipe.hulls.includes(recipeHull(ship, recipe)) && recipe.stage === ship.activeStage,
  )
export const recipeProgress = (recipe: Recipe, inventory: Record<string, number>) =>
  recipe.requirements.length
    ? Math.round(
        recipe.requirements.reduce(
          (sum, x) => sum + progress(clamp(inventory[x.materialId]), x.quantity),
          0,
        ) / recipe.requirements.length,
      )
    : 0

export const stageProgress = (data: AppData, ship: Ship) => {
  const list = shipRecipes(ship)
  return list.length
    ? Math.round(
        list.reduce(
          (sum, recipe) =>
            sum +
            (isRecipeCompleted(data, ship.id, recipe.id)
              ? 100
              : recipeProgress(recipe, data.inventory)),
          0,
        ) / list.length,
      )
    : 0
}
