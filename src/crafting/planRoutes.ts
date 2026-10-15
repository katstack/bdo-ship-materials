import type { CraftingPlan } from './planTypes'
import { resolveIngredientReference, type ItemDetail } from './types'
import { selectedRecipe, routeInputs, type RecipeRoute } from './recipeCatalog'

export type RouteIssue = {
  kind: 'cycle' | 'recovery' | 'missing' | 'depth' | 'quantity' | 'substitution'
  itemId: string
  message: string
  path?: string[]
}
export type RouteNode = {
  key: string
  itemId: string
  requestedMode: 'craft' | 'obtain'
  calculationMode: 'craft' | 'obtain'
  route?: RecipeRoute
  inputs: { key: string; itemId: string; count: number; slotId: string }[]
  issues: RouteIssue[]
  external: boolean
}
export type ResolvedPlan = {
  nodes: Map<string, RouteNode>
  goals: { key: string; quantity: number }[]
  issues: RouteIssue[]
  missing: string[]
}
export function requestedMode(
  plan: CraftingPlan,
  id: string,
  detail?: ItemDetail,
  route?: RecipeRoute,
): 'craft' | 'obtain' {
  if (plan.choices[id]) return plan.choices[id].mode
  if (!detail?.recipes.length) return 'obtain'
  if (plan.goals.some((goal) => goal.itemId === id)) return 'craft'
  return plan.view === 'raw' && route?.kind === 'production' ? 'craft' : 'obtain'
}
/** Route interpretation only: no stock allocation, yields or quantity propagation. */
export function resolvePlanRoutes(
  plan: CraftingPlan,
  details: ReadonlyMap<string, ItemDetail>,
  names: ReadonlyMap<string, string>,
): ResolvedPlan {
  const nodes = new Map<string, RouteNode>(),
    issues: RouteIssue[] = [],
    missing = new Set<string>()
  const label = (id: string) => names.get(resolveIngredientReference(id, names).id) ?? id
  const external = (id: string, kind: 'cycle' | 'recovery', path: string[]) => {
    const key = `external:${id}`
    const issue: RouteIssue = {
      kind,
      itemId: id,
      path,
      message:
        kind === 'cycle'
          ? `순환 경로: ${path.map(label).join(' → ')}. 마지막 ${label(id)}은 별도 수급이 필요합니다. 제작 선택은 유지합니다.`
          : `${label(id)}: 장비 회수에 투입할 원본 장비는 별도 수급합니다.`,
    }
    issues.push(issue)
    if (!nodes.has(key)) {
      if (nodes.size >= 300)
        throw Error('제작 경로가 300개를 초과했습니다. 일부 경로를 직접 수급으로 선택하세요.')
      nodes.set(key, {
        key,
        itemId: id,
        requestedMode: 'obtain',
        calculationMode: 'obtain',
        inputs: [],
        issues: [issue],
        external: true,
      })
    }
    return key
  }
  const visit = (id: string, path: string[]): string => {
    if (path.includes(id)) return external(id, 'cycle', [...path, id])
    if (nodes.has(id)) return id
    if (nodes.size >= 300)
      throw new Error('제작 경로가 300개를 초과했습니다. 일부 경로를 직접 수급으로 선택하세요.')
    const reference = resolveIngredientReference(id, names)
    const detail = details.get(reference.id)
    const route = detail && selectedRecipe(detail, plan.choices[id], details)
    const intent = reference.enhancementLevel ? 'obtain' : requestedMode(plan, id, detail, route)
    const node: RouteNode = {
      key: id,
      itemId: id,
      requestedMode: intent,
      calculationMode: intent,
      route,
      inputs: [],
      issues: [],
      external: false,
    }
    nodes.set(id, node)
    const problem = (kind: RouteIssue['kind'], message: string) => {
      const issue = { kind, itemId: id, message }
      node.issues.push(issue)
      issues.push(issue)
    }
    if (!detail) {
      missing.add(reference.id)
      problem('missing', `${label(id)}: 상세 데이터 로딩이 필요합니다.`)
    }
    if (!detail || reference.enhancementLevel || intent === 'obtain') {
      node.calculationMode = 'obtain'
      return id
    }
    if (!route) {
      node.calculationMode = 'obtain'
      problem('missing', `${label(id)}: 선택한 제작식을 찾지 못했습니다. 다른 제작식을 선택하세요.`)
      return id
    }
    if (path.length >= 20) {
      node.calculationMode = 'obtain'
      problem(
        'depth',
        `${label(id)}: 최대 제작 깊이(20)에 도달해 이 항목은 별도 수급이 필요합니다.`,
      )
      return id
    }
    for (const slot of routeInputs(route, plan.choices[id])) {
      if (slot.invalidSelection)
        problem(
          'substitution',
          `${label(id)}: 저장된 대체재가 이 재료 칸에 유효하지 않아 기본 재료를 사용합니다.`,
        )
      if (slot.count === undefined || !Number.isFinite(slot.count) || slot.count <= 0) {
        problem('quantity', `${label(id)}: 입력 수량 미확인 재료가 있어 합계가 불완전합니다.`)
        continue
      }
      const itemId = slot.selectedItemId
      const key =
        route.kind === 'recovery' && plan.choices[itemId]?.mode !== 'craft'
          ? external(itemId, 'recovery', [...path, id, itemId])
          : visit(itemId, [...path, id])
      node.inputs.push({ key, itemId, count: slot.count, slotId: slot.id })
    }
    return id
  }
  const goals = plan.goals.map((goal) => ({ key: visit(goal.itemId, []), quantity: goal.quantity }))
  return { nodes, goals, issues, missing: [...missing] }
}
