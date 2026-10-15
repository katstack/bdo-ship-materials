import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateCraftingPlan, hasPlanDetails } from './planCalculation'
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
    plan: CraftingPlan
    details?: Map<string, ItemDetail>
    error?: string
  }>()
  const [retry, setRetry] = useState(0)
  const detailsRef = useRef<Map<string, ItemDetail>>(new Map())
  const compatible = !!loaded?.details && hasPlanDetails(graphPlan, loaded.details, names)
  useEffect(() => {
    if (!names.size || compatible) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      loadPlanDetails(graphPlan, names, () => cancelled, undefined, detailsRef.current)
        .then((details) => {
          if (!cancelled) {
            detailsRef.current = details
            setLoaded({ key, plan: graphPlan, details })
          }
        })
        .catch((error: unknown) => {
          if (!cancelled)
            setLoaded((previous) => ({
              key,
              plan: previous?.details ? previous.plan : graphPlan,
              details: previous?.details,
              error: error instanceof Error ? error.message : '재료 계산 실패',
            }))
        })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [graphPlan, key, names, retry, compatible])
  // Keep the last complete graph mounted while a genuinely new branch downloads.
  const current = useMemo(
    () => (compatible && loaded?.error ? { ...loaded, error: undefined } : loaded),
    [compatible, loaded],
  )
  const updating = !!loaded?.details && !compatible && !loaded.error
  const result = useMemo(() => {
    if (!current?.details) return undefined
    try {
      const displayPlan = compatible
        ? plan
        : {
            ...plan,
            goals: current.plan.goals,
            choices: current.plan.choices,
            view: current.plan.view,
          }
      return { ...calculateCraftingPlan(displayPlan, current.details, names), error: '' }
    } catch (error) {
      return {
        rows: [],
        warnings: [],
        routes: undefined,
        error: error instanceof Error ? error.message : '수량 계산 실패',
      }
    }
  }, [plan, current, names, compatible])
  return { current, result, updating, retry: () => setRetry((value) => value + 1) }
}
