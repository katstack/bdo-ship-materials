import { resolveIngredientReference, sourceItemId, type ItemDetail } from './types'
import type { CraftingPlan } from './planTypes'
import { defaultRecipeIndex } from './recipeSelection'
import { defaultEnvironment } from './environment'
import { predictYield, predictedCrafts, type YieldPrediction } from './yieldPrediction'

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
  prediction?: YieldPrediction
  blockedReason?: 'cycle'
  meanCrafts?: number
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

/** A smaller/different graph can reuse loaded details without hiding the current tables. */
export function hasPlanDetails(
  plan: CraftingPlan,
  details: ReadonlyMap<string, ItemDetail>,
  names: ReadonlyMap<string, string>,
) {
  const visited = new Set<string>()
  const visit = (id: string, depth: number): boolean => {
    if (visited.has(id)) return true
    visited.add(id)
    if (visited.size > 300) return false
    const detail = details.get(referenceForPlan(id, names).id)
    if (!detail) return false
    if (depth >= 20 || !shouldExpandPlanItem(plan, id, detail, names)) return true
    const recipe = detail.recipes[plan.choices[id]?.recipeIndex ?? defaultRecipeIndex(detail)]
    return (recipe?.inputs ?? []).every((input) => visit(sourceItemId(input.item), depth + 1))
  }
  return plan.goals.every((goal) => visit(goal.itemId, 0))
}

/** Compare actual selected dependencies, not quantities, yields or redundant default choices. */
export function samePlanDependencyGraph(
  a: CraftingPlan,
  b: CraftingPlan,
  details: ReadonlyMap<string, ItemDetail>,
  names: ReadonlyMap<string, string>,
) {
  const signature = (plan: CraftingPlan) => {
    const paths = new Map<string, string>()
    let missing = false
    const visit = (id: string, depth: number) => {
      if (paths.has(id)) return
      const detail = details.get(referenceForPlan(id, names).id)
      if (!detail) {
        missing = true
        return
      }
      const expand = depth < 20 && shouldExpandPlanItem(plan, id, detail, names)
      const index = plan.choices[id]?.recipeIndex ?? defaultRecipeIndex(detail)
      paths.set(id, expand ? `craft:${index}` : 'obtain')
      if (expand)
        for (const input of detail.recipes[index]?.inputs ?? [])
          visit(sourceItemId(input.item), depth + 1)
    }
    for (const goal of plan.goals) visit(goal.itemId, 0)
    return missing ? undefined : JSON.stringify([...paths].sort(([a], [b]) => a.localeCompare(b)))
  }
  const first = signature(a)
  return first !== undefined && first === signature(b)
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
    const node: { row: PlanRow; inputs: { id: string; count: number }[]; incoming: number } = {
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
    const estimate = predictYield(choice, recipe, plan.environment)
    if (estimate.prediction) {
      node.row.prediction = estimate.prediction
      node.row.outputPerCraft = estimate.prediction.mean
      node.row.assumedYield = false
      warnings.add(
        `${name}: ${estimate.prediction.explanation}. 레시피 생산 범위·기본 분포·등급 충족은 사용자 가정이며 실제 게임 확률을 보증하지 않습니다.`,
      )
    } else if (estimate.error) warnings.add(`${name}: ${estimate.error} 수동 수율로 계산합니다.`)
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
  // Recovery recipes can lead back to the equipment that consumes their output.
  // Break cyclic intermediates into explicit shopping leaves, not missing edges.
  const state = new Map<string, number>()
  const path: string[] = []
  const blocked = new Set<string>()
  const inspect = (id: string) => {
    if (state.get(id) === 1) {
      const cycle = path.slice(path.indexOf(id))
      const intermediates = cycle.filter((item) => !goals.has(item))
      for (const item of intermediates.length ? intermediates : cycle.slice(-1)) blocked.add(item)
      return
    }
    if (state.get(id) === 2) return
    state.set(id, 1)
    path.push(id)
    for (const input of nodes.get(id)!.inputs) inspect(input.id)
    path.pop()
    state.set(id, 2)
  }
  for (const goal of plan.goals) inspect(goal.itemId)
  for (const id of blocked) {
    const node = nodes.get(id)!
    node.inputs = []
    node.row.mode = 'obtain'
    node.row.blockedReason = 'cycle'
    node.row.prediction = undefined
  }
  const reachable = new Set<string>()
  const retain = (id: string) => {
    if (reachable.has(id)) return
    reachable.add(id)
    for (const input of nodes.get(id)!.inputs) retain(input.id)
  }
  for (const goal of plan.goals) retain(goal.itemId)
  for (const [id, node] of nodes) {
    if (!reachable.has(id)) nodes.delete(id)
    else if (blocked.has(id))
      warnings.add(
        `${node.row.name}: 장비 회수·재제작 등 순환 경로가 있어 하위 제작 대신 직접 수급·구매할 재료로 계산했습니다. 필요 수량은 합계에 포함됩니다.`,
      )
  }
  for (const node of nodes.values())
    for (const input of node.inputs) nodes.get(input.id)!.incoming++
  for (const goal of plan.goals) nodes.get(goal.itemId)!.row.required += goal.quantity
  const ready = [...nodes.values()].filter((node) => !node.incoming)
  const rows: PlanRow[] = []
  const confidence = plan.environment?.confidence ?? defaultEnvironment().confidence
  const familySize = [...nodes.values()].filter((node) => node.row.prediction).length
  for (let position = 0; position < ready.length; position++) {
    const node = ready[position]
    const row = node.row
    if (!Number.isFinite(row.required) || row.required > Number.MAX_SAFE_INTEGER)
      throw new Error(
        '계산 수량이 안전한 숫자 범위를 초과했습니다. 목표 수량이나 제작 경로를 줄여주세요.',
      )
    row.shortage = Math.max(row.required - row.owned, 0)
    if (row.mode === 'craft') {
      row.meanCrafts = Math.ceil(row.shortage / row.outputPerCraft)
      row.crafts = row.prediction
        ? predictedCrafts(row.shortage, row.prediction, confidence, familySize)
        : row.meanCrafts
      if (!Number.isSafeInteger(row.crafts))
        throw Error('예측 제작 횟수가 너무 큽니다. 확률·생산 범위·목표 수량을 확인하세요.')
      if (confidence !== 'mean' && !row.prediction && row.crafts > 0)
        warnings.add(
          `${row.name}: 확률 분포가 없는 수동 수율이므로 ${confidence}% 하한 계산에서 제외됩니다.`,
        )
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
    throw new Error('제작 경로를 정리하지 못했습니다. 계산 데이터의 순환 참조를 확인해야 합니다.')
  return { rows, warnings: [...warnings] }
}
