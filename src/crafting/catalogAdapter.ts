import type { ItemDetail } from './types'
import { recipeKind } from './recipeIdentity'

/** Normalize with full index metadata, not whichever detail chunks happened to load first. */
export function adaptItemDetail(
  detail: ItemDetail,
  categories: ReadonlyMap<string, string | undefined>,
): ItemDetail {
  return {
    ...detail,
    recipes: detail.recipes.map((recipe) => ({
      ...recipe,
      routeKindHint: recipeKind(recipe, (id) => categories.get(id)),
    })),
  }
}
