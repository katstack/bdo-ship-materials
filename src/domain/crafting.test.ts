import { describe, expect, it } from 'vitest'
import { recipes } from '../catalog'
import { freshSample } from '../storage'
import { aggregateMaterialDemand, fleetDemandScope, shipDemandScope } from './materialDemand'
import {
  canCompleteRecipe,
  completeRecipe,
  craftRecordKey,
  isRecipeCompleted,
  undoRecipeCompletion,
} from './crafting'

const shipId = 'trade-a'
const recipe = recipes.find((item) => item.id === 'blue-plating-trade')!

const dataReadyToCraft = () => {
  const data = freshSample()
  data.inventory = Object.fromEntries(
    recipe.requirements.map((requirement) => [requirement.materialId, requirement.quantity]),
  )
  return data
}

describe('crafting domain', () => {
  it('requires every material before a recipe can be completed', () => {
    const data = dataReadyToCraft()
    data.inventory[recipe.requirements[0].materialId] -= 1

    expect(canCompleteRecipe(data.inventory, recipe)).toBe(false)
    expect(() => completeRecipe(data, shipId, recipe, '2026-01-01T00:00:00.000Z')).toThrow(
      '재료 보유량이 부족합니다.',
    )
    expect(data.completedRecipes).toEqual({})
  })

  it('consumes shared inventory and records the completed recipe', () => {
    const data = dataReadyToCraft()
    const completed = completeRecipe(data, shipId, recipe, '2026-01-01T00:00:00.000Z')
    const key = craftRecordKey(shipId, recipe.id)

    expect(isRecipeCompleted(completed, shipId, recipe.id)).toBe(true)
    expect(completed.completedRecipes[key].consumedMaterials).toEqual(
      Object.fromEntries(
        recipe.requirements.map((requirement) => [requirement.materialId, requirement.quantity]),
      ),
    )
    recipe.requirements.forEach((requirement) => {
      expect(completed.inventory[requirement.materialId]).toBe(0)
    })
  })

  it('excludes a completed recipe from material demand and restores it on undo', () => {
    const data = dataReadyToCraft()
    const completed = completeRecipe(data, shipId, recipe, '2026-01-01T00:00:00.000Z')

    expect(
      aggregateMaterialDemand(completed, fleetDemandScope('current')).find(
        (item) => item.id === 'low',
      ),
    ).toBeUndefined()

    const restored = undoRecipeCompletion(completed, shipId, recipe.id)
    expect(isRecipeCompleted(restored, shipId, recipe.id)).toBe(false)
    recipe.requirements.forEach((requirement) => {
      expect(restored.inventory[requirement.materialId]).toBe(requirement.quantity)
    })
    expect(
      aggregateMaterialDemand(restored, fleetDemandScope('current')).find(
        (item) => item.id === 'low',
      )?.required,
    ).toBe(60)
  })

  it('can project one selected ship without mixing the rest of the fleet', () => {
    const data = dataReadyToCraft()
    data.ships.push({ ...data.ships[0], id: 'trade-b', name: '무역선 B' })

    expect(
      aggregateMaterialDemand(data, fleetDemandScope('current')).find((item) => item.id === 'low')
        ?.required,
    ).toBe(120)
    expect(
      aggregateMaterialDemand(data, shipDemandScope(shipId, 'current')).find(
        (item) => item.id === 'low',
      )?.required,
    ).toBe(60)
  })
})
