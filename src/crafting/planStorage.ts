import { emptyCraftingPlan, type CraftingPlan } from './planTypes'
import { yieldModels } from './planTypes'
import { parseEnvironment } from './environment'

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
      ...(choice.recipeId !== undefined ? { recipeId: choice.recipeId as string } : {}),
      outputPerCraft: choice.outputPerCraft,
      yieldConfirmed: choice.yieldConfirmed === true,
      ...(choice.yieldModel !== undefined
        ? { yieldModel: choice.yieldModel as CraftingPlan['choices'][string]['yieldModel'] }
        : {}),
      ...(choice.yieldMin !== undefined ? { yieldMin: choice.yieldMin as number } : {}),
      ...(choice.yieldMax !== undefined ? { yieldMax: choice.yieldMax as number } : {}),
    }
    if (
      choice.recipeId !== undefined &&
      (typeof choice.recipeId !== 'string' || !/^recipe-\d+-[a-f0-9]+$/.test(choice.recipeId))
    )
      throw Error('제작식 ID가 올바르지 않습니다.')
    if (choice.substitutions !== undefined) {
      if (!object(choice.substitutions) || Object.keys(choice.substitutions).length > 100)
        throw Error('대체재 선택이 올바르지 않습니다.')
      const substitutions: Record<string, Record<string, string>> = {}
      for (const [recipe, slots] of Object.entries(choice.substitutions)) {
        if (
          !/^recipe-\d+-[a-f0-9]+$/.test(recipe) ||
          !object(slots) ||
          Object.keys(slots).length > 100
        )
          throw Error('대체재 제작식이 올바르지 않습니다.')
        substitutions[recipe] = {}
        for (const [slot, item] of Object.entries(slots)) {
          if (
            !/^slot-\d+-(?:\d+(?:\.\d+)?|unknown)-\d+$/.test(slot) ||
            typeof item !== 'string' ||
            !/^\d+$/.test(item)
          )
            throw Error('대체 재료 칸이 올바르지 않습니다.')
          substitutions[recipe][slot] = item
        }
      }
      choices[id].substitutions = substitutions
    }
    if (
      (choice.yieldModel !== undefined &&
        !yieldModels.includes(choice.yieldModel as (typeof yieldModels)[number])) ||
      (choice.yieldMin !== undefined &&
        (!finite(choice.yieldMin, 0) ||
          !Number.isInteger(choice.yieldMin) ||
          choice.yieldMin > 100)) ||
      (choice.yieldMax !== undefined &&
        (!finite(choice.yieldMax, 1) ||
          !Number.isInteger(choice.yieldMax) ||
          choice.yieldMax > 100)) ||
      ((choice.yieldMin as number | undefined) !== undefined &&
        (choice.yieldMax as number | undefined) !== undefined &&
        Number(choice.yieldMin) > Number(choice.yieldMax))
    )
      throw Error('생산량 예측 모델 또는 범위가 올바르지 않습니다.')
  }
  const inventory: Record<string, number> = {}
  for (const [id, count] of Object.entries(value.inventory)) {
    if (!/^\d+$/.test(id) || !finite(count, 0) || !Number.isSafeInteger(count))
      throw new Error('제작 재고가 올바르지 않습니다.')
    inventory[id] = count
  }
  return {
    version: 1,
    goals,
    choices,
    inventory,
    view: value.view,
    sort: value.sort,
    ...(value.environment !== undefined
      ? { environment: parseEnvironment(value.environment) }
      : {}),
  }
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
