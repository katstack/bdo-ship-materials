import { describe, expect, it } from 'vitest'
import { recipes } from '../data/recipes'
import { freshSample } from '../storage'
import { aggregateMaterialDemand, fleetDemandScope, shipDemandScope } from './materialDemand'
import {
  canCompleteRecipe,
  canCompleteRecipeForShip,
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
  it('allows completion with insufficient materials and clamps inventory at zero', () => {
    const data = dataReadyToCraft()
    data.inventory[recipe.requirements[0].materialId] -= 1

    expect(canCompleteRecipe(data.inventory, recipe)).toBe(false)
    const completed = completeRecipe(data, shipId, recipe, '2026-01-01T00:00:00.000Z')
    expect(completed.inventory[recipe.requirements[0].materialId]).toBe(0)
    expect(completed.completedRecipes[craftRecordKey(shipId, recipe.id)].consumedMaterials).toEqual(
      Object.fromEntries(
        recipe.requirements.map((requirement) => [requirement.materialId, requirement.quantity]),
      ),
    )
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

  it('uses completed blue gear as a carrack prerequisite without adding it to material demand', () => {
    const data = freshSample()
    const upgrade = recipes.find((item) => item.id === 'advance')!
    data.inventory = Object.fromEntries(
      upgrade.requirements.map((requirement) => [requirement.materialId, requirement.quantity]),
    )

    expect(
      upgrade.requirements.some((requirement) => requirement.materialId === 'blue-cannon'),
    ).toBe(false)
    expect(canCompleteRecipeForShip(data, shipId, upgrade)).toBe(false)

    upgrade.prerequisiteRecipeIds!.forEach((recipeId) => {
      data.completedRecipes[craftRecordKey(shipId, recipeId)] = {
        completedAt: '2026-01-01T00:00:00.000Z',
        consumedMaterials: {},
      }
    })
    expect(canCompleteRecipeForShip(data, shipId, upgrade)).toBe(true)
  })

  it('adds a crafted carrack part to inventory and removes it again when undone', () => {
    const data = freshSample()
    const chiro = recipes.find(
      (item) => item.id === '3-치로의 함포' && item.hulls[0] === 'advance',
    )!
    data.inventory = Object.fromEntries(
      chiro.requirements.map((requirement) => [requirement.materialId, requirement.quantity]),
    )

    const completed = completeRecipe(data, 'advance-a', chiro, '2026-01-01T00:00:00.000Z')
    expect(completed.inventory['chiro-advance-cannon']).toBe(1)

    const restored = undoRecipeCompletion(completed, 'advance-a', chiro.id)
    expect(restored.inventory['chiro-advance-cannon']).toBe(0)
  })
})
