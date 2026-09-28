import type { CarrackHull, EquipmentSlot, Hull, Recipe, Stage } from '../types'

const r = (materialId: string, quantity: number) => ({ materialId, quantity })

const shipName = (hull: Hull) => (hull === 'trade' ? '에페리아 무역선' : '에페리아 구축함')

const blue = (hull: Hull): Recipe[] => [
  {
    id: `blue-figure-${hull}`,
    name: `${shipName(hull)}: 흑룡 선수상`,
    slot: 'figurehead',
    stage: 2,
    hulls: [hull],
    description: '선박 부품 공방 4단계 제작',
    requirements: [r('rock', 50), r('enhanced', 300), r('seaweed', 125), r('steel', 150)],
  },
  {
    id: `blue-plating-${hull}`,
    name: `${shipName(hull)}: 개량형 장갑`,
    slot: 'plating',
    stage: 2,
    hulls: [hull],
    description: '선박 부품 공방 4단계 제작',
    requirements: [
      r('pearl', 45),
      r('low', 60),
      r('combat', hull === 'warship' ? 125 : 60),
      r('moon', hull === 'warship' ? 300 : 200),
    ],
  },
  {
    id: `blue-cannon-${hull}`,
    name: `${shipName(hull)}: 메이나 함포`,
    slot: 'cannon',
    stage: 2,
    hulls: [hull],
    description: '선박 부품 공방 4단계 제작',
    requirements: [
      r('wave', 180),
      r('combat', hull === 'warship' ? 125 : 60),
      r('moon', hull === 'warship' ? 300 : 200),
      r('reef', 180),
    ],
  },
  {
    id: `blue-sail-${hull}`,
    name: `${shipName(hull)}: 비층 바람 돛`,
    slot: 'sail',
    stage: 2,
    hulls: [hull],
    description: '선박 부품 공방 4단계 제작',
    requirements: [r('rock', 40), r('high', 30), r('seaweed', 80), r('cobalt', 30)],
  },
]
const carrackHulls: CarrackHull[] = ['balance', 'advance', 'volante', 'valor']
const carrackName: Record<CarrackHull, string> = {
  balance: '에페리아 중범선 균형',
  advance: '에페리아 중범선 점진',
  volante: '에페리아 중범선 비상',
  valor: '에페리아 중범선 용맹',
}
const carrackSlots: { slot: EquipmentSlot; name: string }[] = [
  { slot: 'figurehead', name: '선수상' },
  { slot: 'plating', name: '장갑' },
  { slot: 'cannon', name: '함포' },
  { slot: 'sail', name: '돛' },
]
const carrackGear = (
  stage: Stage,
  maker: '치로' | '팔라시',
  reqs: ReturnType<typeof r>[],
): Recipe[] =>
  carrackHulls.flatMap((hull) =>
    carrackSlots.map(({ slot, name }) => ({
      // 제작 완료 기록은 선박 ID와 조합한다. 기존 저장 데이터의 레시피 ID도 유지한다.
      id: `${stage}-${maker}의 ${name}`,
      name: `${carrackName[hull]}: ${maker}의 ${maker === '치로' && slot === 'plating' ? '흑장갑' : name}`,
      slot,
      stage,
      hulls: [hull],
      description:
        stage === 3 ? '중범선 파란색 등급 치로 장비 제작' : '중범선 노란색 등급 팔라시 장비 제작',
      requirements: reqs,
    })),
  )
const bluePlus = [r('blue-figure', 1), r('blue-plating', 1), r('blue-cannon', 1), r('blue-sail', 1)]
export const recipes: Recipe[] = [
  {
    id: 'expand-trade',
    name: '무역선 증축',
    stage: 1,
    hulls: ['trade'],
    description: '개량형 경범선 → 무역선',
    requirements: [
      r('graphite', 100),
      r('timber', 100),
      r('glue', 100),
      r('island', 100),
      r('salt', 100),
      r('deep-glue', 4),
      r('seaweed', 4),
    ],
  },
  {
    id: 'expand-warship',
    name: '구축함 증축',
    stage: 1,
    hulls: ['warship'],
    description: '개량형 호위함 → 구축함',
    requirements: [
      r('graphite', 100),
      r('timber', 100),
      r('glue', 100),
      r('island', 100),
      r('wave', 3),
      r('moon', 10),
    ],
  },
  ...blue('trade'),
  ...blue('warship'),
  {
    id: 'balance',
    name: '중범선 균형 증축',
    stage: 2,
    hulls: ['balance'],
    usesUpgradeHull: true,
    description: '에페리아 무역선 +10 장비 4종 필요',
    requirements: [
      ...bluePlus,
      r('flax', 180),
      r('deep-tide', 144),
      r('brilliant-salt', 30),
      r('brilliant-pearl', 30),
      r('tear', 50),
    ],
  },
  {
    id: 'advance',
    name: '중범선 점진 증축',
    stage: 2,
    hulls: ['advance'],
    usesUpgradeHull: true,
    description: '에페리아 무역선 +10 장비 4종 필요',
    requirements: [
      ...bluePlus,
      r('flax', 180),
      r('deep-tide', 144),
      r('brilliant-salt', 35),
      r('brilliant-pearl', 35),
      r('tear', 42),
    ],
  },
  {
    id: 'volante',
    name: '중범선 비상 증축',
    stage: 2,
    hulls: ['volante'],
    usesUpgradeHull: true,
    description: '에페리아 구축함 +10 장비 4종 필요',
    requirements: [
      ...bluePlus,
      r('flax', 210),
      r('deep-tide', 144),
      r('brilliant-salt', 30),
      r('brilliant-pearl', 30),
      r('tear', 42),
    ],
  },
  {
    id: 'valor',
    name: '중범선 용맹 증축',
    stage: 2,
    hulls: ['valor'],
    usesUpgradeHull: true,
    description: '에페리아 구축함 +10 장비 4종 필요',
    requirements: [
      ...bluePlus,
      r('flax', 180),
      r('deep-tide', 170),
      r('brilliant-salt', 30),
      r('brilliant-pearl', 30),
      r('tear', 42),
    ],
  },
  ...carrackGear(3, '치로', [r('violent', 100), r('support', 100), r('adhesive', 100)]),
  ...carrackGear(4, '팔라시', [r('rough', 75), r('coral', 125), r('crimson', 50)]),
]
