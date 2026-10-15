import { loadItemDetail } from './catalogClient'
import { resolveIngredientReference } from './types'
import type { CraftingPlan } from './planTypes'
import type { ItemDetail } from './types'
import { selectedRecipe, routeInputs } from './recipeCatalog'
import { requestedMode } from './planRoutes'

export async function loadPlanDetails(
  plan: CraftingPlan,
  names: ReadonlyMap<string, string>,
  cancelled: () => boolean,
  load = loadItemDetail,
  cached: ReadonlyMap<string, ItemDetail> = new Map(),
) {
  const details = new Map<string, ItemDetail>()
  const seen = new Set<string>()
  const visit = async (id: string, depth: number): Promise<void> => {
    if (cancelled()) return
    const reference = resolveIngredientReference(id, names)
    if (seen.has(id)) return
    seen.add(id)
    if (seen.size > 300)
      throw new Error(
        '제작 경로가 300개를 초과했습니다. 일부 재료를 직접 수급으로 선택해 범위를 줄여주세요.',
      )
    let detail = details.get(reference.id)
    if (!detail) {
      detail = cached.get(reference.id) ?? (await load(reference.id))
      details.set(reference.id, detail)
    }
    const route = selectedRecipe(detail, plan.choices[id], details)
    if (
      depth >= 20 ||
      reference.enhancementLevel ||
      requestedMode(plan, id, detail, route) !== 'craft' ||
      !route
    )
      return
    for (const input of routeInputs(route, plan.choices[id])) {
      if (cancelled()) return
      const inputReference = resolveIngredientReference(input.selectedItemId, names)
      if (!details.has(inputReference.id)) {
        if (details.size >= 300)
          throw Error('제작 경로가 300개를 초과했습니다. 일부 경로를 직접 수급으로 선택하세요.')
        details.set(
          inputReference.id,
          cached.get(inputReference.id) ?? (await load(inputReference.id)),
        )
      }
    }
    const classified = selectedRecipe(detail, plan.choices[id], details)
    if (requestedMode(plan, id, detail, classified) !== 'craft') return
    for (const input of routeInputs(classified ?? route, plan.choices[id]))
      if (classified?.kind !== 'recovery' || plan.choices[input.selectedItemId]?.mode === 'craft')
        await visit(input.selectedItemId, depth + 1)
  }
  for (const goal of plan.goals) await visit(goal.itemId, 0)
  return details
}
