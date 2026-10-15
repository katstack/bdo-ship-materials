import { productionRules } from '../data/craftingRules'
import type { CraftingChoice, CraftingPlan } from './planTypes'
import type { RecipeRoute } from './recipeCatalog'
import { predictYield, type YieldPrediction } from './yieldPrediction'
import { lifeRanks } from './environment'

export function productionEstimate(
  id: string,
  route: RecipeRoute | undefined,
  choice: CraftingChoice | undefined,
  plan: CraftingPlan,
): {
  outputPerCraft: number
  assumedYield: boolean
  prediction?: YieldPrediction
  warnings: string[]
  automatic: boolean
} {
  let selected = choice
  const rule = productionRules[id]
  const profile =
    rule?.model === 'cooking' ? plan.environment?.cooking : plan.environment?.processing
  const eligible =
    !!profile &&
    (id === '4051'
      ? lifeRanks.indexOf(profile.rank) >= lifeRanks.indexOf('artisan')
      : lifeRanks.indexOf(profile.rank) > lifeRanks.indexOf('skilled') ||
        (profile.rank === 'skilled' && profile.level >= 9))
  const configured =
    eligible &&
    (rule?.model === 'cooking'
      ? plan.environment?.cooking.mastery !== undefined
      : plan.environment?.processing.methods.HEAT !== undefined)
  const automatic =
    !choice?.yieldModel &&
    !choice?.yieldConfirmed &&
    !!configured &&
    !!rule &&
    route?.source.inputs.length === Object.keys(rule.inputs).length &&
    route.source.inputs.every(
      (input) => rule.inputs[input.item.replace(/^urn::item:/, '')] === input.count,
    ) &&
    route?.kind === 'production' &&
    (rule.model === 'cooking'
      ? route.source.type === 'COOK'
      : ['HEAT', 'FIREWOOD', 'GRIND', 'SHAKE', 'DRY', 'THINNING'].includes(route.source.type))
  if (automatic)
    selected = {
      mode: 'craft',
      recipeIndex: route.index,
      outputPerCraft: 1,
      ...choice,
      yieldModel: rule.model,
      yieldMin: rule.min,
      yieldMax: rule.max,
    }
  const estimate =
    route && route.kind === 'production'
      ? predictYield(selected, route.source, plan.environment)
      : undefined
  const warnings: string[] = []
  if (estimate?.error) warnings.push(`${estimate.error} 수동 수율로 계산합니다.`)
  if (estimate?.prediction)
    warnings.push(
      `${estimate.prediction.explanation}. 레시피 기본 분포는 계산 가정이며 실제 게임 확률을 보증하지 않습니다.`,
    )
  if (automatic) warnings.push(rule.evidence)
  return {
    outputPerCraft: estimate?.prediction?.mean ?? choice?.outputPerCraft ?? 1,
    assumedYield: !estimate?.prediction && !choice?.yieldConfirmed,
    prediction: estimate?.prediction,
    warnings,
    automatic: !!automatic,
  }
}
