import { resolveIngredientReference, type ItemDetail } from './types'
import type { CraftingPlan } from './planTypes'
import { resolvePlanRoutes, requestedMode, type ResolvedPlan, type RouteIssue } from './planRoutes'
import { selectedRecipe, type RouteKind } from './recipeCatalog'
import { productionEstimate } from './production'
import { predictedCrafts, type YieldPrediction } from './yieldPrediction'

export type PlanRow = {
  id: string
  name: string
  required: number
  owned: number
  shortage: number
  /** User intent, never overwritten by path diagnostics. */
  mode: 'craft' | 'obtain'
  calculationMode: 'craft' | 'obtain'
  requestedMode: 'craft' | 'obtain'
  purchaseRequired: number
  crafts: number
  outputPerCraft: number
  assumedYield: boolean
  isGoal: boolean
  recipeIndex: number
  recipeId?: string
  routeKind?: RouteKind
  enhancementLevel: number
  prediction?: YieldPrediction
  meanCrafts?: number
  automaticYield?: boolean
  issues: RouteIssue[]
  usages: { parentId: string; count: number; slotId: string }[]
}
export type PlanResult = { rows: PlanRow[]; warnings: string[]; routes: ResolvedPlan }
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
    requestedMode(plan, id, detail, selectedRecipe(detail, plan.choices[id])) === 'craft'
  )
}
export function hasPlanDetails(
  plan: CraftingPlan,
  details: ReadonlyMap<string, ItemDetail>,
  names: ReadonlyMap<string, string>,
) {
  try {
    return resolvePlanRoutes(plan, details, names).missing.length === 0
  } catch {
    return false
  } // Limits are reported by the async loader, not thrown during React render.
}
export function samePlanDependencyGraph(
  a: CraftingPlan,
  b: CraftingPlan,
  details: ReadonlyMap<string, ItemDetail>,
  names: ReadonlyMap<string, string>,
) {
  const signature = (plan: CraftingPlan) => {
    const graph = resolvePlanRoutes(plan, details, names)
    if (graph.missing.length) return undefined
    return JSON.stringify(
      [...graph.nodes.values()]
        .map((node) => [node.key, node.calculationMode, node.route?.id, node.inputs])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    )
  }
  const first = signature(a)
  return first !== undefined && first === signature(b)
}

/** Pure arithmetic on a resolved DAG. Inventory is shared by item, never by path. */
export function calculateResolvedPlan(
  plan: CraftingPlan,
  routes: ResolvedPlan,
  names: ReadonlyMap<string, string>,
): PlanResult {
  const warnings = new Set(routes.issues.map((issue) => issue.message))
  const goals = new Set(plan.goals.map((goal) => goal.itemId))
  const nodes = new Map(
    [...routes.nodes].map(([key, node]) => [
      key,
      {
        node,
        required: 0,
        incoming: 0,
        estimate: productionEstimate(node.itemId, node.route, plan.choices[node.itemId], plan),
      },
    ]),
  )
  for (const item of nodes.values())
    for (const input of item.node.inputs) nodes.get(input.key)!.incoming++
  for (const goal of routes.goals) nodes.get(goal.key)!.required += goal.quantity
  const ready = [...nodes.values()].filter((item) => !item.incoming)
  const stock = new Map(Object.entries(plan.inventory))
  const rows = new Map<string, PlanRow>()
  const familySize = [...nodes.values()].filter(
    (item) => item.node.calculationMode === 'craft' && item.estimate.prediction,
  ).length
  const confidence = plan.environment?.confidence ?? 'mean'
  for (let position = 0; position < ready.length; position++) {
    const item = ready[position],
      node = item.node,
      id = node.itemId
    if (!Number.isFinite(item.required) || item.required > Number.MAX_SAFE_INTEGER)
      throw Error('계산 수량이 안전한 숫자 범위를 초과했습니다.')
    const available = stock.get(id) ?? 0,
      allocated = Math.min(available, item.required)
    stock.set(id, available - allocated)
    const shortage = Math.max(item.required - allocated, 0),
      estimate = item.estimate
    const crafts =
      node.calculationMode === 'craft'
        ? estimate.prediction
          ? predictedCrafts(shortage, estimate.prediction, confidence, familySize)
          : Math.ceil(shortage / estimate.outputPerCraft)
        : 0
    if (!Number.isSafeInteger(crafts))
      throw Error('예측 제작 횟수가 너무 큽니다. 생산 범위·목표 수량을 확인하세요.')
    if (item.required > 0 || goals.has(id)) {
      const reference = referenceForPlan(id, names)
      const row: PlanRow = rows.get(id) ?? {
        id,
        name: planItemName(id, names),
        required: 0,
        owned: plan.inventory[id] ?? 0,
        shortage: 0,
        mode: node.requestedMode,
        requestedMode: node.requestedMode,
        calculationMode: node.calculationMode,
        purchaseRequired: 0,
        crafts: 0,
        outputPerCraft: estimate.outputPerCraft,
        assumedYield: estimate.assumedYield,
        isGoal: goals.has(id),
        recipeIndex: node.route?.index ?? plan.choices[id]?.recipeIndex ?? 0,
        recipeId: node.route?.id,
        routeKind: node.route?.kind,
        enhancementLevel: reference.enhancementLevel,
        prediction: estimate.prediction,
        meanCrafts: 0,
        automaticYield: estimate.automatic,
        issues: [],
        usages: [],
      }
      row.required += item.required
      row.shortage = Math.max(row.required - row.owned, 0)
      row.crafts += crafts
      row.meanCrafts! +=
        node.calculationMode === 'craft' ? Math.ceil(shortage / estimate.outputPerCraft) : 0
      if (node.calculationMode === 'obtain') row.purchaseRequired += shortage
      if (!node.external) {
        row.mode = node.requestedMode
        row.requestedMode = node.requestedMode
        row.calculationMode = node.calculationMode
        row.recipeId = node.route?.id
        row.recipeIndex = node.route?.index ?? row.recipeIndex
        row.routeKind = node.route?.kind
      }
      row.issues.push(...node.issues)
      rows.set(id, row)
      if (node.calculationMode === 'craft') {
        for (const warning of estimate.warnings) warnings.add(`${row.name}: ${warning}`)
        if (estimate.assumedYield && crafts > 0)
          warnings.add(`${row.name}: 결과 수량 미확보 · 1회당 1개 가정입니다.`)
        if (confidence !== 'mean' && !estimate.prediction && crafts > 0)
          warnings.add(
            `${row.name}: 확률 분포가 없는 수동 수율이므로 ${confidence}% 하한 계산에서 제외됩니다.`,
          )
        if (node.route?.kind === 'byproduct')
          warnings.add(`${row.name}: 부산물 제작식입니다. 예상 생산량을 확인하세요.`)
      }
    }
    for (const input of node.inputs) {
      const child = nodes.get(input.key)!
      child.required += crafts * input.count
      child.incoming--
      if (!child.incoming) ready.push(child)
    }
  }
  for (const item of nodes.values())
    for (const input of item.node.inputs) {
      const row = rows.get(input.itemId),
        crafts = rows.get(item.node.itemId)?.crafts ?? 0
      if (row && crafts > 0)
        row.usages.push({
          parentId: item.node.itemId,
          count: crafts * input.count,
          slotId: input.slotId,
        })
    }
  for (const row of rows.values())
    row.usages.sort(
      (a, b) => a.parentId.localeCompare(b.parentId) || a.slotId.localeCompare(b.slotId),
    )
  if (ready.length !== nodes.size) throw Error('해석된 제작 경로에 순환이 남아 있습니다.')
  return { rows: [...rows.values()], warnings: [...warnings], routes }
}
export function calculateCraftingPlan(
  plan: CraftingPlan,
  details: ReadonlyMap<string, ItemDetail>,
  names: ReadonlyMap<string, string>,
): PlanResult {
  return calculateResolvedPlan(plan, resolvePlanRoutes(plan, details, names), names)
}
