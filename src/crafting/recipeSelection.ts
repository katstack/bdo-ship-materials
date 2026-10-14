import type { ItemDetail, SourceRecipe } from './types'
import { craftingMethods } from './methods'

export function defaultRecipeIndex(detail: ItemDetail): number {
  const index = detail.recipes.findIndex((recipe) => !recipe.byproductOf)
  return index >= 0 ? index : 0
}
export function recipeLabel(recipe: SourceRecipe, index: number) {
  return `${index + 1}. ${craftingMethods[recipe.type] ?? recipe.type}${recipe.station ? ` · ${recipe.station}` : ''}${recipe.byproductOf ? ' · 부산물' : ''}`
}
