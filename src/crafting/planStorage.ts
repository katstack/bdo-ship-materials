import { emptyCraftingPlan, type CraftingPlan } from './planTypes'

export const craftingPlanStorageKey = 'bdo-crafting-plan-v1'
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown, minimum: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= 1e9
export function parseCraftingPlan(value: unknown): CraftingPlan {
  if (
    !object(value) ||
    value.version !== 1 ||
    !Array.isArray(value.goals) ||
    value.goals.length > 100 ||
    !object(value.choices) ||
    !object(value.inventory)
  )
    throw new Error('지원하지 않거나 손상된 제작 계획입니다.')
  if (
    (value.view !== 'direct' && value.view !== 'raw') ||
    (value.sort !== 'name' && value.sort !== 'shortage')
  )
    throw new Error('제작 계획의 표시 설정이 올바르지 않습니다.')
  const goals = value.goals.map((goal: unknown) => {
    if (
      !object(goal) ||
      typeof goal.itemId !== 'string' ||
      !/^\d+$/.test(goal.itemId) ||
      typeof goal.name !== 'string' ||
      !finite(goal.quantity, 1)
    )
      throw new Error('목표 아이템 또는 수량이 올바르지 않습니다.')
    if (!Number.isSafeInteger(goal.quantity)) throw new Error('목표 수량은 양의 정수여야 합니다.')
    return { itemId: goal.itemId, name: goal.name, quantity: goal.quantity }
  })
  if (new Set(goals.map((goal) => goal.itemId)).size !== goals.length)
    throw new Error('목표 아이템이 중복되었습니다.')
  const choices: CraftingPlan['choices'] = {}
  for (const [id, choice] of Object.entries(value.choices)) {
    if (
      !/^\d+$/.test(id) ||
      !object(choice) ||
      (choice.mode !== 'craft' && choice.mode !== 'obtain') ||
      !finite(choice.recipeIndex, 0) ||
      !Number.isInteger(choice.recipeIndex) ||
      !finite(choice.outputPerCraft, 0.000001)
    )
      throw new Error('제작식 선택 또는 결과 수량이 올바르지 않습니다.')
    if (choice.yieldConfirmed !== undefined && typeof choice.yieldConfirmed !== 'boolean')
      throw new Error('생산량 확인 설정이 올바르지 않습니다.')
    choices[id] = {
      mode: choice.mode,
      recipeIndex: choice.recipeIndex,
      outputPerCraft: choice.outputPerCraft,
      yieldConfirmed: choice.yieldConfirmed === true,
    }
  }
  const inventory: Record<string, number> = {}
  for (const [id, count] of Object.entries(value.inventory)) {
    if (!/^\d+$/.test(id) || !finite(count, 0) || !Number.isSafeInteger(count))
      throw new Error('제작 재고가 올바르지 않습니다.')
    inventory[id] = count
  }
  return { version: 1, goals, choices, inventory, view: value.view, sort: value.sort }
}
export function loadCraftingPlan(): { plan: CraftingPlan; error?: string } {
  try {
    const text = localStorage.getItem(craftingPlanStorageKey)
    return { plan: text ? parseCraftingPlan(JSON.parse(text)) : emptyCraftingPlan() }
  } catch (error) {
    return {
      plan: emptyCraftingPlan(),
      error: error instanceof Error ? error.message : '제작 계획을 읽지 못했습니다.',
    }
  }
}
export function saveCraftingPlan(plan: CraftingPlan) {
  localStorage.setItem(craftingPlanStorageKey, JSON.stringify(parseCraftingPlan(plan)))
}
