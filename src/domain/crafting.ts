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
  areRecipePrerequisitesComplete(data, shipId, recipe)

export function completeRecipe(
  data: AppData,
  shipId: string,
  recipe: Recipe,
  completedAt = new Date().toISOString(),
): AppData {
  const key = craftRecordKey(shipId, recipe.id)
  if (data.completedRecipes[key]) throw new Error('이미 완료한 제작입니다.')
  if (!areRecipePrerequisitesComplete(data, shipId, recipe))
    throw new Error('선행 제작이 완료되지 않았습니다.')

  const inventory = { ...data.inventory }
  const consumedMaterials: Record<string, number> = {}
  recipe.requirements.forEach((requirement) => {
    const available = quantity(inventory[requirement.materialId])
    inventory[requirement.materialId] = Math.max(available - requirement.quantity, 0)
    // 완료 기록은 요구 수량 전체를 남긴다. 취소 시 같은 수량을 되돌릴 수 있다.
    consumedMaterials[requirement.materialId] = requirement.quantity
  })
  const producedMaterials: Record<string, number> = {}
  recipe.produces?.forEach((product) => {
    inventory[product.materialId] = quantity(inventory[product.materialId]) + product.quantity
    producedMaterials[product.materialId] = product.quantity
  })

  return {
    ...data,
    inventory,
    completedRecipes: {
      ...data.completedRecipes,
      [key]: {
        completedAt,
        consumedMaterials,
        ...(Object.keys(producedMaterials).length ? { producedMaterials } : {}),
      },
    },
  }
}

export function undoRecipeCompletion(data: AppData, shipId: string, recipeId: string): AppData {
  const key = craftRecordKey(shipId, recipeId)
  const record = data.completedRecipes[key]
  if (!record) throw new Error('완료 기록을 찾을 수 없습니다.')

  const inventory = { ...data.inventory }
  Object.entries(record.producedMaterials || {}).forEach(([materialId, produced]) => {
    inventory[materialId] = Math.max(0, quantity(inventory[materialId]) - quantity(produced))
  })
  Object.entries(record.consumedMaterials).forEach(([materialId, consumed]) => {
    inventory[materialId] = quantity(inventory[materialId]) + quantity(consumed)
  })
  const completedRecipes = { ...data.completedRecipes }
  delete completedRecipes[key]
  return { ...data, inventory, completedRecipes }
}
