import type { CarrackHull, EquipmentSlot, Hull, Recipe } from '../types'

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
const carrackSlots: {
  slot: EquipmentSlot
  name: string
  materialKey: 'cannon' | 'sail' | 'figurehead' | 'plating'
}[] = [
  { slot: 'cannon', name: '함포', materialKey: 'cannon' },
  { slot: 'sail', name: '돛', materialKey: 'sail' },
  { slot: 'figurehead', name: '선수상', materialKey: 'figurehead' },
  { slot: 'plating', name: '장갑', materialKey: 'plating' },
]
const carrackGearIds: Record<
  CarrackHull,
  {
    chiroDesignStart: number
    chiroItemStart: number
    falasiDesignStart: number
    falasiItemStart: number
  }
> = {
  advance: {
    chiroDesignStart: 8987,
    chiroItemStart: 49746,
    falasiDesignStart: 9041,
    falasiItemStart: 49778,
  },
  balance: {
    chiroDesignStart: 8992,
    chiroItemStart: 49762,
    falasiDesignStart: 9045,
    falasiItemStart: 49782,
  },
  volante: {
    chiroDesignStart: 8996,
    chiroItemStart: 49766,
    falasiDesignStart: 9049,
    falasiItemStart: 49786,
  },
  valor: {
    chiroDesignStart: 9000,
    chiroItemStart: 49770,
    falasiDesignStart: 9053,
    falasiItemStart: 49790,
  },
}

/** BDO Codex 디자인(치로 1단계/팔라시 2단계) 기준의 중범선 장비 제작식. */
const carrackGear = (stage: 3 | 4, maker: '치로' | '팔라시'): Recipe[] =>
  carrackHulls.flatMap((hull) => {
    const ids = carrackGearIds[hull]
    return carrackSlots.map(({ slot, name, materialKey }, index) => {
      const isChiro = maker === '치로'
      const designId = isChiro ? ids.chiroDesignStart + index : ids.falasiDesignStart + index
      const itemId = isChiro ? ids.chiroItemStart + index : ids.falasiItemStart + index
      const outputId = `${isChiro ? 'chiro' : 'falasi'}-${hull}-${materialKey}`
      const requirements = isChiro
        ? [
            r(`toro-${materialKey}`, 1),
            r('violent', 100),
            r('support', 100),
            r('adhesive', 100),
            r(`chiro-blueprint-${materialKey}`, 10),
            r(`carrack-permit-${hull}`, 1),
          ]
        : [
            r(`chiro-${hull}-${materialKey}`, 1),
            r(`falasi-blueprint-${materialKey}`, 10),
            r('coral', 125),
            r('rough', 75),
            r('crimson', 50),
            r(`falasi-permit-${hull}`, 1),
          ]
      const equipmentName = isChiro && slot === 'plating' ? '흑장갑' : name
      return {
        id: `${stage}-${maker}의 ${name}`,
        name: `${carrackName[hull]}: ${maker}의 ${equipmentName}`,
        slot,
        stage,
        hulls: [hull],
        description: `일리야섬 3번지 치로의 선박 부품 공방 ${isChiro ? 1 : 2}단계 제작`,
        requirements,
        produces: [r(outputId, 1)],
        codexDesignId: String(designId),
        codexItemId: String(itemId),
      }
    })
  })
const blueRecipeIds = (hull: 'trade' | 'warship') => [
  `blue-figure-${hull}`,
  `blue-plating-${hull}`,
  `blue-cannon-${hull}`,
  `blue-sail-${hull}`,
]
export const recipes: Recipe[] = [
  {
    id: 'expand-trade',
    name: '무역선 증축',
    stage: 1,
    hulls: ['sailboat', 'improved-sailboat', 'trade'],
    resultHull: 'trade',
    description: '에페리아 경범선/개량형 경범선 → 에페리아 무역선',
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
    hulls: ['frigate', 'improved-frigate', 'warship'],
    resultHull: 'warship',
    description: '에페리아 호위함/개량형 호위함 → 에페리아 구축함',
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
    description: '에페리아 무역선 → 에페리아 중범선 균형',
    prerequisiteRecipeIds: blueRecipeIds('trade'),
    requirements: [
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
    description: '에페리아 무역선 → 에페리아 중범선 점진',
    prerequisiteRecipeIds: blueRecipeIds('trade'),
    requirements: [
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
    description: '에페리아 구축함 → 에페리아 중범선 비상',
    prerequisiteRecipeIds: blueRecipeIds('warship'),
    requirements: [
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
    description: '에페리아 구축함 → 에페리아 중범선 용맹',
    prerequisiteRecipeIds: blueRecipeIds('warship'),
    requirements: [
      r('flax', 180),
      r('deep-tide', 170),
      r('brilliant-salt', 30),
      r('brilliant-pearl', 30),
      r('tear', 42),
    ],
  },
  ...carrackGear(3, '치로'),
  ...carrackGear(4, '팔라시'),
]
