import { materialById, recipes } from '../catalog'
import type { AggregateMaterial, AppData, Ship, Stage } from '../types'
import { isRecipeCompleted } from './crafting'
import { estimatedSupplyDays, materialSupply } from './supply'

export type FleetDemandScope = 'current' | 'all'

const quantity = (value: number) => Math.max(0, Math.floor(Number(value) || 0))
const progress = (owned: number, required: number) =>
  required ? Math.min(100, Math.round((owned / required) * 100)) : 100
const recipeHull = (ship: Ship, stage: Stage) =>
  stage >= 3 && ship.upgradeHull ? ship.upgradeHull : ship.hull

/** Shared inventory requirements for one fleet projection. Completed recipes are excluded. */
export function aggregateMaterialDemand(
  data: AppData,
  scope: FleetDemandScope = 'all',
): AggregateMaterial[] {
  const map = new Map<string, AggregateMaterial>()
  data.ships.forEach((ship) =>
    recipes
      .filter(
        (recipe) =>
          recipe.hulls.includes(recipeHull(ship, recipe.stage)) &&
          (scope === 'all'
            ? recipe.stage >= ship.activeStage
            : recipe.stage === ship.activeStage) &&
          !isRecipeCompleted(data, ship.id, recipe.id),
      )
      .forEach((recipe) =>
        recipe.requirements.forEach((requirement) => {
          const material = materialById[requirement.materialId]
          if (!material) return
          const existing = map.get(requirement.materialId)
          if (existing) {
            existing.required += requirement.quantity
            existing.recipes.push(`${ship.name} · ${recipe.name}`)
            return
          }
          map.set(requirement.materialId, {
            ...material,
            required: requirement.quantity,
            owned: quantity(data.inventory[requirement.materialId]),
            shortage: 0,
            progress: 0,
            dailySupply: 0,
            weeklySupply: 0,
            crowCoinTotal: undefined,
            recipes: [`${ship.name} · ${recipe.name}`],
          })
        }),
      ),
  )

  return [...map.values()].map((material) => {
    const shortage = Math.max(0, material.required - material.owned)
    const supply = materialSupply(data, material.id)
    return {
      ...material,
      shortage,
      progress: progress(material.owned, material.required),
      dailySupply: supply.daily,
      weeklySupply: supply.weekly,
      estimatedDays: estimatedSupplyDays(shortage, supply.daily, supply.weekly),
      crowCoinTotal:
        material.crowCoinPrice === undefined ? undefined : shortage * material.crowCoinPrice,
    }
  })
}
