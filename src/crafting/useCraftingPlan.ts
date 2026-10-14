import { useState } from 'react'
import { loadCraftingPlan, saveCraftingPlan } from './planStorage'
import type { CraftingPlan } from './planTypes'

export function useCraftingPlan() {
  const [initial] = useState(loadCraftingPlan)
  const [plan, setPlan] = useState(initial.plan)
  const [error, setError] = useState(initial.error ?? '')
  const [unreadable, setUnreadable] = useState(!!initial.error)
  const update = (next: CraftingPlan) => {
    if (
      unreadable &&
      !window.confirm(
        '읽을 수 없는 기존 제작 계획이 있습니다. 기존 파일을 새 계획으로 덮어쓰시겠습니까?',
      )
    )
      return false
    try {
      saveCraftingPlan(next)
      setPlan(next)
      setError('')
      setUnreadable(false)
      return true
    } catch (error) {
      setError(error instanceof Error ? error.message : '제작 계획 저장 실패')
      return false
    }
  }
  return { plan, update, error }
}
