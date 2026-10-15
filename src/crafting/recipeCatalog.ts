import type { CraftingChoice } from './planTypes'
import { ingredientGroups } from '../data/craftingRules'
import { sourceItemId, type ItemDetail, type SourceRecipe } from './types'

import { recipeId, recipeKind, type RouteKind } from './recipeIdentity'
export { recipeId } from './recipeIdentity'
export type { RouteKind } from './recipeIdentity'
export type IngredientSlot = {
  id: string
  itemId: string
  count?: number
  group?: (typeof ingredientGroups)[number]
}
export type RecipeRoute = {
  id: string
  index: number
  kind: RouteKind
  source: SourceRecipe
  slots: IngredientSlot[]
}
export function recipeRoutes(
  detail: ItemDetail,
  details: ReadonlyMap<string, ItemDetail> = new Map(),
): RecipeRoute[] {
  return detail.recipes.map((source, index) => {
    const kind = source.routeKindHint ?? recipeKind(source, (id) => details.get(id)?.item.category)
    const occurrences = new Map<string, number>()
    const slots = source.inputs.map((input) => {
      const itemId = sourceItemId(input.item)
      const signature = `${itemId}-${input.count ?? 'unknown'}`
      const occurrence = occurrences.get(signature) ?? 0
      occurrences.set(signature, occurrence + 1)
      return {
        id: `slot-${signature}-${occurrence}`,
        itemId,
        count: input.count,
        group:
          source.type === 'COOK'
            ? ingredientGroups.find((group) =>
                (group.members as readonly string[]).includes(itemId),
              )
            : undefined,
      }
    })
    return { id: recipeId(source), index, kind, source, slots }
  })
}
export function selectedRecipe(
  detail: ItemDetail,
  choice?: CraftingChoice,
  details?: ReadonlyMap<string, ItemDetail>,
) {
  const routes = recipeRoutes(detail, details)
  // A missing stable ID must not silently select a different recipe.
  if (choice?.recipeId) return routes.find((route) => route.id === choice.recipeId)
  if (choice) return routes[choice.recipeIndex]
  return routes.find((route) => route.kind === 'production') ?? routes[0]
}
export function routeInputs(route: RecipeRoute, choice?: CraftingChoice) {
  return route.slots.map((slot) => {
    const selected = choice?.substitutions?.[route.id]?.[slot.id]
    const valid =
      !selected ||
      selected === slot.itemId ||
      slot.group?.members.some((member) => member === selected)
    return {
      ...slot,
      selectedItemId: valid && selected ? selected : slot.itemId,
      invalidSelection: !valid,
    }
  })
}
