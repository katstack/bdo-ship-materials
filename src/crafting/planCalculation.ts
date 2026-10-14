import { resolveIngredientReference, sourceItemId, type ItemDetail } from './types'
import type { CraftingPlan } from './planTypes'
import { defaultRecipeIndex } from './recipeSelection'

export type PlanRow = {
  id: string
  name: string
  required: number
  owned: number
  shortage: number
  mode: 'craft' | 'obtain'
  crafts: number
  outputPerCraft: number
  assumedYield: boolean
  isGoal: boolean
  recipeIndex: number
  enhancementLevel: number
}
export type PlanResult = { rows: PlanRow[]; warnings: string[] }
export const referenceForPlan = (id: string, names: ReadonlyMap<string, string>) =>
  resolveIngredientReference(id, names)
export function planItemName(id: string, names: ReadonlyMap<string, string>) {
  const reference = referenceForPlan(id, names)
  return `${reference.enhancementLevel ? `+${reference.enhancementLevel} ` : ''}${names.get(reference.id) ?? `아이템 ${id}`}`
}
export function shouldExpandPlanItem(
  plan: CraftingPlan,
  id: string,
  detail: ItemDetail,
  names: ReadonlyMap<string, string>,
) {
  return (
    !referenceForPlan(id, names).enhancementLevel &&
    !!detail.recipes.length &&
    (plan.choices[id]?.mode ??
      (plan.goals.some((goal) => goal.itemId === id) || plan.view === 'raw'
        ? 'craft'
        : 'obtain')) === 'craft'
  )
}

/** Sum demand before rounding craft counts or allocating stock. Shared inputs are consumed once. */
export function calculateCraftingPlan(
  plan: CraftingPlan,
  details: ReadonlyMap<string, ItemDetail>,
  names: ReadonlyMap<string, string>,
): PlanResult {
  const nodes = new Map<
    string,
    { row: PlanRow; inputs: { id: string; count: number }[]; incoming: number }
  >()
  const warnings = new Set<string>()
  const goals = new Set(plan.goals.map((goal) => goal.itemId))
  const build = (id: string, depth: number) => {
    if (nodes.has(id)) return
    const reference = referenceForPlan(id, names)
    const name = planItemName(id, names)
    const detail = details.get(reference.id)
    const choice = plan.choices[id]
    const expand = !!detail && shouldExpandPlanItem(plan, id, detail, names)
    const node = {
      row: {
        id,
        name,
        required: 0,
        owned: plan.inventory[id] ?? 0,
        shortage: 0,
        mode: expand ? ('craft' as const) : ('obtain' as const),
        crafts: 0,
        outputPerCraft: choice?.outputPerCraft ?? 1,
        assumedYield: !choice?.yieldConfirmed,
        isGoal: goals.has(id),
        recipeIndex: choice?.recipeIndex ?? (detail ? defaultRecipeIndex(detail) : 0),
        enhancementLevel: reference.enhancementLevel,
      },
      inputs: [] as { id: string; count: number }[],
      incoming: 0,
    }
    nodes.set(id, node)
    if (!detail)
      warnings.add(`${name}: 상세 데이터를 불러오지 못해 하위 재료를 계산하지 않았습니다.`)
    if (!expand) return
    if (depth >= 20) {
      node.row.mode = 'obtain'
      warnings.add(`${name}: 최대 제작 깊이(20)에 도달했습니다.`)
      return
    }
    const recipe = detail!.recipes[node.row.recipeIndex]
    if (!recipe) {
      node.row.mode = 'obtain'
      warnings.add(`${name}: 선택한 제작식이 없어 직접 수급으로 표시합니다.`)
      return
    }
    if (!choice && detail!.recipes.length > 1)
      warnings.add(
        `${name}: 제작식 ${node.row.recipeIndex + 1}을 기본 선택했습니다. 다른 제작식이 있으면 변경하세요.`,
      )
    if (recipe.byproductOf)
      warnings.add(
        `${name}: 부산물 제작식입니다. 목표 아이템의 생산은 보장되지 않으며 예상 생산량을 직접 확인해야 합니다.`,
      )
    const merged = new Map<string, number>()
    for (const input of recipe.inputs) {
      const count = input.count
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
        warnings.add(`${name}: 입력 수량 미확인 재료가 있어 합계가 불완전합니다.`)
        continue
      }
      const key = sourceItemId(input.item)
      merged.set(key, (merged.get(key) ?? 0) + count)
    }
    node.inputs = [...merged].map(([id, count]) => ({ id, count }))
    for (const input of node.inputs) build(input.id, depth + 1)
  }
  for (const goal of plan.goals) build(goal.itemId, 0)
  for (const node of nodes.values())
    for (const input of node.inputs) nodes.get(input.id)!.incoming++
  for (const goal of plan.goals) nodes.get(goal.itemId)!.row.required += goal.quantity
  const ready = [...nodes.values()].filter((node) => !node.incoming)
  const rows: PlanRow[] = []
  for (let position = 0; position < ready.length; position++) {
    const node = ready[position]
    const row = node.row
    if (!Number.isFinite(row.required) || row.required > Number.MAX_SAFE_INTEGER)
      throw new Error(
        '계산 수량이 안전한 숫자 범위를 초과했습니다. 목표 수량이나 제작 경로를 줄여주세요.',
      )
    row.shortage = Math.max(row.required - row.owned, 0)
    if (row.mode === 'craft') {
      row.crafts = Math.ceil(row.shortage / row.outputPerCraft)
      if (row.assumedYield && row.crafts > 0)
        warnings.add(`${row.name}: 결과 수량 미확보 · 1회당 1개 가정입니다.`)
    }
    for (const input of node.inputs) {
      const child = nodes.get(input.id)!
      child.row.required += row.crafts * input.count
      child.incoming--
      if (!child.incoming) ready.push(child)
    }
    if (row.required > 0 || row.isGoal) rows.push(row)
  }
  if (ready.length !== nodes.size)
    throw new Error(
      '순환 제작식이 있어 계산을 중단했습니다. 직접 재료 범위로 돌아가거나 목표 아이템의 획득 방식을 직접 수급으로 바꾸세요.',
    )
  return { rows, warnings: [...warnings] }
}
