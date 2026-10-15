import type { PlanResult, PlanRow } from './planCalculation'

export interface PlanTreeNode {
  key: string
  row: PlanRow
  required: number
  external: boolean
  shared: boolean
  children: PlanTreeNode[]
}

/** A bounded presentation of the resolved DAG, not another material calculator.
 * Shared subtrees are expanded once; subsequent appearances point to that same item.
 */
export function buildPlanTree(result: PlanResult): PlanTreeNode[] {
  const rows = new Map(result.rows.map((row) => [row.id, row]))
  const expanded = new Set<string>()
  const visit = (key: string, required: number): PlanTreeNode | undefined => {
    const route = result.routes.nodes.get(key)
    const row = route && rows.get(route.itemId)
    if (!route || !row) return undefined
    const shared = expanded.has(key)
    expanded.add(key)
    return {
      key,
      row,
      required,
      shared,
      external: route.external,
      children: shared
        ? []
        : route.inputs.flatMap((input) => {
            if (row.crafts === 0) return []
            const child = visit(input.key, row.crafts * input.count)
            return child ? [child] : []
          }),
    }
  }
  return result.routes.goals.flatMap((goal) => {
    const root = visit(goal.key, goal.quantity)
    return root ? [root] : []
  })
}

/** Find a few explanatory goal paths without exponentially expanding a shared DAG. */
export function materialPaths(result: PlanResult, itemId: string, limit = 5): string[][] {
  const paths: string[][] = []
  const craftsByItem = new Map(result.rows.map((row) => [row.id, row.crafts]))
  let remaining = 2000
  const visit = (key: string, path: string[]) => {
    if (--remaining < 0 || paths.length >= limit) return
    const node = result.routes.nodes.get(key)
    if (!node || path.length > 21) return
    const next = [...path, node.itemId]
    if (node.itemId === itemId) {
      paths.push(next)
      return
    }
    const crafts = craftsByItem.get(node.itemId) ?? 0
    if (crafts > 0) for (const child of node.inputs) visit(child.key, next)
  }
  for (const goal of result.routes.goals) visit(goal.key, [])
  return paths
}
