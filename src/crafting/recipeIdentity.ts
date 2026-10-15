import type { SourceRecipe } from './types'

export type RouteKind = 'production' | 'recovery' | 'byproduct' | 'exchange'
export function recipeId(recipe: SourceRecipe) {
  const canonical = JSON.stringify([
    recipe.output,
    recipe.type,
    recipe.station ?? '',
    recipe.byproductOf ?? '',
    [...recipe.inputs]
      .map((input) => [input.item, input.count ?? null])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ])
  let a = 2166136261,
    b = 5381
  for (const char of canonical) {
    a = Math.imul(a ^ char.charCodeAt(0), 16777619)
    b = Math.imul(b, 33) ^ char.charCodeAt(0)
  }
  return `recipe-${recipe.output.replace(/^urn::item:/, '')}-${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`
}
export function recipeKind(recipe: SourceRecipe, category: (id: string) => unknown): RouteKind {
  if (recipe.byproductOf) return 'byproduct'
  if (recipe.type === 'EXCHANGE') return 'exchange'
  const equipment = new Set([
    'MainWeapon',
    'SubWeapon',
    'AwakeningWeapon',
    'Armor',
    'Helmet',
    'Gloves',
    'Shoes',
    'Accessory',
  ])
  return recipe.type === 'HEAT' &&
    recipe.inputs.some((input) =>
      equipment.has(String(category(input.item.replace(/^urn::item:/, '')))),
    )
    ? 'recovery'
    : 'production'
}
