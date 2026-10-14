import { useEffect, useMemo, useState } from 'react'
import { calculateCraftingPlan } from './planCalculation'
import { loadPlanDetails } from './loadPlanDetails'
import type { CraftingPlan } from './planTypes'
import type { ItemDetail } from './types'

export function useCraftingCalculation(plan: CraftingPlan, names: ReadonlyMap<string, string>) {
  // Stock and sorting are not part of the dependency graph and do not trigger downloads.
  const graphPlan = useMemo<CraftingPlan>(
    () => ({
      version: 1,
      goals: plan.goals,
      choices: plan.choices,
      view: plan.view,
      inventory: {},
      sort: 'name',
    }),
    [plan.goals, plan.choices, plan.view],
  )
  const key = JSON.stringify(graphPlan)
  const [loaded, setLoaded] = useState<{
    key: string
    details?: Map<string, ItemDetail>
    error?: string
  }>()
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!names.size) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      loadPlanDetails(graphPlan, names, () => cancelled)
        .then((details) => {
          if (!cancelled) setLoaded({ key, details })
        })
        .catch((error: unknown) => {
          if (!cancelled)
            setLoaded({ key, error: error instanceof Error ? error.message : '재료 계산 실패' })
        })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [graphPlan, key, names, retry])
  const current = loaded?.key === key ? loaded : undefined
  const result = useMemo(() => {
    if (!current?.details) return undefined
    try {
      return { ...calculateCraftingPlan(plan, current.details, names), error: '' }
    } catch (error) {
      return {
        rows: [],
        warnings: [],
        error: error instanceof Error ? error.message : '수량 계산 실패',
      }
    }
  }, [plan, current, names])
  return { current, result, retry: () => setRetry((value) => value + 1) }
}
