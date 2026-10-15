import tables from '../data/masteryTables.json'
import { defaultEnvironment, type CraftingEnvironment } from './environment'
import type { CraftingChoice, YieldModel } from './planTypes'
import type { SourceRecipe } from './types'
import { lookupMasteryBracket } from './masteryLookup'

export const yieldModelLabels: Record<YieldModel, string> = {
  manual: '수동 평균',
  cooking: '일반 요리 모형',
  'rare-cooking': '상위 요리 모형',
  alchemy: '일반 연금 모형',
  processing: '가공 범위 모형',
}
export function masteryBracket<K extends 'cooking' | 'alchemy'>(
  kind: K,
  mastery: number,
): (typeof tables)[K][number] {
  const rows = tables[kind] as (typeof tables)[K][number][]
  return lookupMasteryBracket(rows, mastery)
}
export function processingBatch(mastery: number) {
  return lookupMasteryBracket(tables.processing, mastery).batch
}
export type YieldPrediction = {
  mean: number
  min: number
  max: number
  batchGroup: number
  model: YieldModel
  explanation: string
}
export function predictYield(
  choice: CraftingChoice | undefined,
  recipe: SourceRecipe,
  env: CraftingEnvironment = defaultEnvironment(),
): { prediction?: YieldPrediction; error?: string } {
  const model = choice?.yieldModel ?? 'manual'
  if (model === 'manual') return {}
  if (recipe.byproductOf && model !== 'rare-cooking')
    return {
      error:
        '부산물 제작식에는 일반 생산 모형을 적용하지 않습니다. 별도 획득 확률을 확인해 수동 수율을 사용하세요.',
    }
  const min = choice?.yieldMin ?? 1
  const max = choice?.yieldMax ?? (model === 'rare-cooking' ? 2 : 4)
  if (min < 0 || max < min || max > 100 || !Number.isInteger(min) || !Number.isInteger(max))
    return { error: '생산 범위가 올바르지 않습니다.' }
  let maxProc = 0
  let group = 1
  let hit = 1
  if (model === 'cooking' || model === 'rare-cooking') {
    if (recipe.type !== 'COOK')
      return { error: '요리 제작식에만 요리 숙련도 모형을 적용할 수 있습니다.' }
    if (env.cooking.mastery === undefined || env.cooking.rank === 'unknown')
      return { error: '요리 등급·숙련도를 먼저 설정하세요.' }
    const bracket = masteryBracket('cooking', env.cooking.mastery)
    maxProc = model === 'cooking' ? bracket.maxProc : bracket.rareMaxProc!
    group = bracket.massChance! > 0 ? 10 : 1
    if (model === 'rare-cooking') {
      if (env.rareBaseChance === undefined)
        return { error: '레시피·등급별 기본 상위 요리 확률이 미입력입니다.' }
      hit = Math.min(1, env.rareBaseChance + bracket.rareBonus!)
    }
  } else if (model === 'alchemy') {
    if (recipe.type !== 'ALCHEMY')
      return { error: '연금 제작식에만 연금 숙련도 모형을 적용할 수 있습니다.' }
    if (env.alchemy.mastery === undefined || env.alchemy.rank === 'unknown')
      return { error: '연금 등급·숙련도를 먼저 설정하세요.' }
    maxProc = masteryBracket('alchemy', env.alchemy.mastery).maxProc
  } else {
    const method =
      ({ CHOP: 'FIREWOOD', FILTER: 'THINNING' } as Record<string, string>)[recipe.type] ??
      recipe.type
    if (!['SHAKE', 'GRIND', 'FIREWOOD', 'DRY', 'THINNING', 'HEAT'].includes(method))
      return { error: '일반 가공 제작식에만 가공 범위 모형을 적용할 수 있습니다.' }
    const mastery = env.processing.methods[method as keyof typeof env.processing.methods]
    if (mastery === undefined || env.processing.rank === 'unknown')
      return { error: '가공 등급과 해당 종류의 숙련도를 먼저 설정하세요.' }
    group = env.massProcessing ? processingBatch(mastery) : 1
  }
  // Uniform baseline + a separate mastery max-proc roll is a model, not a published game distribution.
  const mean = hit * (((min + max) / 2) * (1 - maxProc) + max * maxProc)
  if (mean <= 0) return { error: '선택한 모형에서는 목표 아이템을 획득할 수 없습니다.' }
  return {
    prediction: {
      mean,
      min: model === 'rare-cooking' ? 0 : min,
      max,
      batchGroup: group,
      model,
      explanation: `범위 ${min}~${max} 균등 + 최대 프로크 ${(maxProc * 100).toFixed(2)}%${model === 'rare-cooking' ? ` · 상위 획득 ${(hit * 100).toFixed(2)}%` : ''} · 묶음 상관 최대 ${group}회 가정`,
    },
  }
}

/** Hoeffding lower tail with correlated copies inside a batch of at most g units. */
export function predictedCrafts(
  target: number,
  prediction: YieldPrediction,
  confidence: 'mean' | '95' | '99',
  familySize = 1,
): number {
  if (target <= 0) return 0
  if (confidence === 'mean') return Math.ceil(target / prediction.mean)
  const alpha = (confidence === '95' ? 0.05 : 0.01) / Math.max(1, familySize)
  const c =
    (prediction.max - prediction.min) * Math.sqrt((prediction.batchGroup * Math.log(1 / alpha)) / 2)
  const root = (c + Math.sqrt(c * c + 4 * prediction.mean * target)) / (2 * prediction.mean)
  const bound = Math.ceil(root * root)
  const worstCase = prediction.min > 0 ? Math.ceil(target / prediction.min) : Infinity
  return Math.min(bound, worstCase)
}
