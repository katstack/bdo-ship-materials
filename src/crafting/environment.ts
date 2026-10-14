export const lifeRanks = [
  'unknown',
  'beginner',
  'apprentice',
  'skilled',
  'professional',
  'artisan',
  'master',
  'guru',
] as const
export type LifeRank = (typeof lifeRanks)[number]
export const lifeRankLabels: Record<LifeRank, string> = {
  unknown: '미설정',
  beginner: '초급',
  apprentice: '견습',
  skilled: '숙련',
  professional: '전문',
  artisan: '장인',
  master: '명장',
  guru: '도인',
}
export const processingMethods = ['SHAKE', 'GRIND', 'FIREWOOD', 'DRY', 'THINNING', 'HEAT'] as const
export type ProcessingMethod = (typeof processingMethods)[number]
export const processingLabels: Record<ProcessingMethod, string> = {
  SHAKE: '흔들어 섞기',
  GRIND: '빻기',
  FIREWOOD: '장작패기',
  DRY: '말리기',
  THINNING: '솎아내기',
  HEAT: '가열하기',
}
export type LifeProfile = { rank: LifeRank; level: number; mastery?: number }
export type CraftingEnvironment = {
  cooking: LifeProfile
  alchemy: LifeProfile
  processing: LifeProfile & { methods: Partial<Record<ProcessingMethod, number>> }
  confidence: 'mean' | '95' | '99'
  rareBaseChance?: number
  massProcessing: boolean
}
export function defaultEnvironment(): CraftingEnvironment {
  return {
    cooking: { rank: 'unknown', level: 1 },
    alchemy: { rank: 'unknown', level: 1 },
    processing: { rank: 'unknown', level: 1, methods: {} },
    confidence: 'mean',
    massProcessing: false,
  }
}
export function parseEnvironment(value: unknown): CraftingEnvironment {
  if (!value || typeof value !== 'object') throw Error('제작 환경설정 형식이 올바르지 않습니다.')
  const raw = value as CraftingEnvironment
  const number = (value: unknown, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
  for (const profile of [raw.cooking, raw.alchemy, raw.processing]) {
    if (
      !profile ||
      !lifeRanks.includes(profile.rank) ||
      !number(profile.level, 1, 100) ||
      !Number.isInteger(profile.level) ||
      (profile.mastery !== undefined &&
        (!number(profile.mastery, 0, 3000) || !Number.isInteger(profile.mastery)))
    )
      throw Error('생활 등급·레벨·숙련도가 올바르지 않습니다.')
  }
  if (
    !raw.processing.methods ||
    Array.isArray(raw.processing.methods) ||
    typeof raw.processing.methods !== 'object'
  )
    throw Error('가공 종류별 숙련도가 올바르지 않습니다.')
  for (const [key, mastery] of Object.entries(raw.processing.methods))
    if (
      !processingMethods.includes(key as ProcessingMethod) ||
      !number(mastery, 0, 3000) ||
      !Number.isInteger(mastery)
    )
      throw Error('가공 숙련도가 올바르지 않습니다.')
  if (
    !['mean', '95', '99'].includes(raw.confidence) ||
    typeof raw.massProcessing !== 'boolean' ||
    (raw.rareBaseChance !== undefined && !number(raw.rareBaseChance, 0, 1))
  )
    throw Error('예측 확률 설정이 올바르지 않습니다.')
  return structuredClone(raw)
}
