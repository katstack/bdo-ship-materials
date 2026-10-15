import { loadItemDetail } from './catalogClient'
import { referenceForPlan, shouldExpandPlanItem } from './planCalculation'
import type { CraftingPlan } from './planTypes'
import type { ItemDetail } from './types'
import { defaultRecipeIndex } from './recipeSelection'

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
    const reference = referenceForPlan(id, names)
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
    if (depth >= 20 || !shouldExpandPlanItem(plan, id, detail, names)) return
    const recipe = detail.recipes[plan.choices[id]?.recipeIndex ?? defaultRecipeIndex(detail)]
    for (const input of recipe?.inputs ?? [])
      await visit(input.item.replace(/^urn::item:/, ''), depth + 1)
  }
  for (const goal of plan.goals) await visit(goal.itemId, 0)
  return details
}
