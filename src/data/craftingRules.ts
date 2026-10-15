/** Supplemental rules; extracted source records are never rewritten. */
export const ingredientGroups = [
  {
    id: 'ordinary-vegetables',
    label: '일반 채소',
    members: ['7306', '7309', '7311', '7312', '7318'],
    source: 'https://www.kr.playblackdesert.com/ko-kr/Wiki?wikiNo=102',
    ratio: 1,
  },
  {
    id: 'ordinary-grains',
    label: '일반 곡물',
    members: ['7001', '7002', '7003', '7004', '7005'],
    source: 'https://www.kr.playblackdesert.com/ko-kr/Wiki?wikiNo=102',
    ratio: 1,
  },
] as const

// Only these ordinary outputs have an automatic baseline. Other recipes stay
// explicit/unknown instead of assuming every processing recipe yields 1..4.
export const productionRules: Record<
  string,
  {
    min: number
    max: number
    model: 'cooking' | 'processing'
    evidence: string
    source: string
    inputs: Record<string, number>
  }
> = {
  '9202': {
    min: 1,
    max: 4,
    model: 'cooking',
    evidence: '일반 채소 절임 1~4개 범위 · 기본 균등 분포는 계산 가정',
    source: 'https://bdocodex.com/us/recipe/112/',
    inputs: { '7318': 8, '9066': 4, '9005': 2, '9002': 2 },
  },
  '4051': {
    min: 1,
    max: 4,
    model: 'processing',
    evidence: '일반 녹아내린 철 조각 1~4개 범위 · 기본 균등 분포는 계산 가정',
    source: 'https://bdocodex.com/gl/mrecipe/1/',
    inputs: { '4001': 5 },
  },
}
