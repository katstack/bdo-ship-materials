import type { AppData, Recipe } from '../types'

const quantity = (value: number) => Math.max(0, Math.floor(Number(value) || 0))

export const craftRecordKey = (shipId: string, recipeId: string) => `${shipId}:${recipeId}`

export const isRecipeCompleted = (data: AppData, shipId: string, recipeId: string) =>
  Boolean(data.completedRecipes[craftRecordKey(shipId, recipeId)])

export const canCompleteRecipe = (inventory: Record<string, number>, recipe: Recipe) =>
  recipe.requirements.every(
    (requirement) => quantity(inventory[requirement.materialId]) >= requirement.quantity,
  )

export const areRecipePrerequisitesComplete = (data: AppData, shipId: string, recipe: Recipe) =>
  recipe.prerequisiteRecipeIds?.every((recipeId) => isRecipeCompleted(data, shipId, recipeId)) ??
  true

export const canCompleteRecipeForShip = (data: AppData, shipId: string, recipe: Recipe) =>
  canCompleteRecipe(data.inventory, recipe) && areRecipePrerequisitesComplete(data, shipId, recipe)

export function completeRecipe(
  data: AppData,
  shipId: string,
  recipe: Recipe,
  completedAt = new Date().toISOString(),
): AppData {
  const key = craftRecordKey(shipId, recipe.id)
  if (data.completedRecipes[key]) throw new Error('이미 완료한 제작입니다.')
  if (!canCompleteRecipe(data.inventory, recipe)) throw new Error('재료 보유량이 부족합니다.')
  if (!areRecipePrerequisitesComplete(data, shipId, recipe))
    throw new Error('선행 제작이 완료되지 않았습니다.')

  const inventory = { ...data.inventory }
  const consumedMaterials: Record<string, number> = {}
  recipe.requirements.forEach((requirement) => {
    inventory[requirement.materialId] =
      quantity(inventory[requirement.materialId]) - requirement.quantity
    consumedMaterials[requirement.materialId] = requirement.quantity
  })

  return {
    ...data,
    inventory,
    completedRecipes: {
      ...data.completedRecipes,
      [key]: { completedAt, consumedMaterials },
    },
  }
}

export function undoRecipeCompletion(data: AppData, shipId: string, recipeId: string): AppData {
  const key = craftRecordKey(shipId, recipeId)
  const record = data.completedRecipes[key]
  if (!record) throw new Error('완료 기록을 찾을 수 없습니다.')

  const inventory = { ...data.inventory }
  Object.entries(record.consumedMaterials).forEach(([materialId, consumed]) => {
    inventory[materialId] = quantity(inventory[materialId]) + quantity(consumed)
  })
  const completedRecipes = { ...data.completedRecipes }
  delete completedRecipes[key]
  return { ...data, inventory, completedRecipes }
}
