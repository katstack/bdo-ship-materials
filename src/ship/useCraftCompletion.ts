import { useState } from 'react'
import type { AppData, Ship } from '../types'
import { hullLabel } from '../catalog'
import { shipRecipes } from '../utils'
import {
  canCompleteRecipeForShip,
  completeRecipe,
  craftRecordKey,
  isRecipeCompleted,
  purchaseRecipe,
  undoRecipeCompletion,
} from '../domain/crafting'

/** UI confirmation owns no inventory logic; domain commands remain the source of truth. */
export function useCraftCompletion(
  data: AppData,
  update: (next: AppData) => void,
  setNotice: (message: string) => void,
) {
  const [craftConfirm, setCraftConfirm] = useState<{
    shipId: string
    recipeId: string
    method: 'crafted' | 'purchased'
  } | null>(null)
  const completeCraft = () => {
    if (!craftConfirm) return
    const ship = data.ships.find((item) => item.id === craftConfirm.shipId)
    const recipe = ship && shipRecipes(ship).find((item) => item.id === craftConfirm.recipeId)
    if (!ship || !recipe || isRecipeCompleted(data, ship.id, recipe.id))
      return setCraftConfirm(null)
    if (!canCompleteRecipeForShip(data, ship.id, recipe)) {
      setNotice('선행 에페리아 함선 장비 제작을 모두 완료해야 증축할 수 있습니다.')
      return setCraftConfirm(null)
    }
    const purchased = craftConfirm.method === 'purchased'
    update(
      purchased ? purchaseRecipe(data, ship.id, recipe) : completeRecipe(data, ship.id, recipe),
    )
    setCraftConfirm(null)
    setNotice(
      recipe.resultHull
        ? `${recipe.name} 완료 · ${hullLabel[recipe.resultHull]}으로 선박 단계를 전환${purchased ? '했습니다.' : '하고 요구 재료를 차감했습니다.'}`
        : purchased
          ? `${recipe.name} 구매 처리 완료 · 재료 재고는 변경하지 않았습니다.`
          : `${recipe.name} 제작 완료 · 요구 재료를 공유 재고에서 차감 처리했습니다.`,
    )
  }
  const undoCraft = (ship: Ship, recipeId: string) => {
    const key = craftRecordKey(ship.id, recipeId)
    const record = data.completedRecipes[key]
    const purchased = record?.completionMethod === 'purchased'
    if (
      !record ||
      !confirm(
        purchased
          ? '구매 완료 처리를 취소할까요? 재료 재고는 변경되지 않습니다.'
          : '제작 완료를 취소하고 당시 차감한 재료를 재고에 복구할까요?',
      )
    )
      return
    update(undoRecipeCompletion(data, ship.id, recipeId))
    setNotice(
      purchased
        ? '구매 완료 처리를 취소했습니다.'
        : '제작 완료를 취소하고 재료를 공유 재고에 복구했습니다.',
    )
  }

  return { craftConfirm, setCraftConfirm, completeCraft, undoCraft }
}
