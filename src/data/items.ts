export interface ItemRecord {
  // LocalStorage 및 레시피가 참조하는 안정적인 앱 키다. Codex ID가 바뀌어도 진행 데이터는 유지한다.
  materialId: string
  name: string
  codexItemId?: string
  crowCoinPrice?: number
}

// 출처: 검은사막 한국 업데이트 안내(groupContentNo=15614)의 까마귀 주화 상점 표.
export const crowCoinPriceSource = {
  url: 'https://www.kr.playblackdesert.com/ko-KR/News/Detail?groupContentNo=15614&countryType=ko-KR',
} as const

// 원문 가격표 전체. 아직 레시피에 연결하지 않은 항목도 추후 데이터 확장에 사용한다.
export const latestCrowCoinPricesByName: Record<string, number> = {
  '달의 비늘이 새겨진 합판': 15,
  '순수한 암초 조각': 30,
  '달의 핏줄이 새겨진 아마포': 40,
  '강화된 섬나무 증착합판': 40,
  '파도빛이 감도는 규격 각목': 80,
  '짙은 파도빛이 감도는 규격 각목': 80,
  '심해초 줄기': 80,
  '심해의 기억이 담긴 아교': 110,
  '코발트 주괴': 120,
  '콕스해적단의 유물(협상 하급)': 120,
  '콕스해적단의 유물(전투)': 120,
  '대양의 견고한 현철': 130,
  '칸의 비늘': 160,
  '홍조빛 해저단괴': 200,
  '순수한 진주 결정': 200,
  '별빛 강화제': 200,
  '별빛 유화제': 200,
  '난폭한 파도가 새겨진 합판': 300,
  '정교하게 다듬어진 지지대': 300,
  '파도의 흔적이 담긴 접착제': 300,
  '칸의 힘줄': 400,
  '화려한 암염 주괴': 400,
  '심해의 눈물': 400,
  '콕스해적단의 유물(협상 상급)': 400,
  '빛나는 코발트 주괴': 400,
  '화려한 진주 결정': 400,
  '짙은 파도의 흔적이 담긴 접착제': 400,
}

// 앱에서 다루는 모든 재료의 이름·Codex ID·까마귀 주화 가격의 단일 기준 데이터.
export const items: ItemRecord[] = [
  { materialId: 'graphite', name: '증축용 흑연 주괴' },
  { materialId: 'timber', name: '증축용 목재' },
  { materialId: 'glue', name: '증축용 접착제' },
  { materialId: 'island', name: '섬나무 증착합판' },
  { materialId: 'salt', name: '암염 주괴' },
  {
    materialId: 'deep-glue',
    name: '심해의 기억이 담긴 아교',
    codexItemId: '5825',
    crowCoinPrice: 110,
  },
  { materialId: 'seaweed', name: '심해초 줄기', codexItemId: '5829', crowCoinPrice: 80 },
  {
    materialId: 'enhanced',
    name: '강화된 섬나무 증착합판',
    codexItemId: '5814',
    crowCoinPrice: 40,
  },
  { materialId: 'steel', name: '대양의 견고한 현철', crowCoinPrice: 130 },
  {
    materialId: 'low',
    name: '콕스해적단의 유물 (협상 하급)',
    codexItemId: '5822',
    crowCoinPrice: 120,
  },
  { materialId: 'reef', name: '순수한 암초 조각', codexItemId: '5828', crowCoinPrice: 30 },
  { materialId: 'pearl', name: '순수한 진주 결정', codexItemId: '5820', crowCoinPrice: 200 },
  { materialId: 'moon', name: '달의 비늘이 새겨진 합판', codexItemId: '5827', crowCoinPrice: 15 },
  { materialId: 'wave', name: '파도빛이 감도는 규격 각목', codexItemId: '5810', crowCoinPrice: 80 },
  {
    materialId: 'high',
    name: '콕스해적단의 유물 (협상 상급)',
    codexItemId: '5823',
    crowCoinPrice: 400,
  },
  { materialId: 'cobalt', name: '빛나는 코발트 주괴', crowCoinPrice: 400 },
  {
    materialId: 'combat',
    name: '콕스해적단의 유물 (전투)',
    codexItemId: '5824',
    crowCoinPrice: 120,
  },
  { materialId: 'rock', name: '홍조빛 해저단괴', codexItemId: '5807', crowCoinPrice: 200 },
  { materialId: 'flax', name: '달의 핏줄이 새겨진 아마포', codexItemId: '5809', crowCoinPrice: 40 },
  {
    materialId: 'deep-tide',
    name: '짙은 파도빛이 감도는 규격 각목',
    codexItemId: '5812',
    crowCoinPrice: 80,
  },
  { materialId: 'brilliant-salt', name: '화려한 암염 주괴', crowCoinPrice: 400 },
  { materialId: 'brilliant-pearl', name: '화려한 진주 결정', crowCoinPrice: 400 },
  { materialId: 'tear', name: '심해의 눈물', codexItemId: '5821', crowCoinPrice: 400 },
  { materialId: 'crow-coin', name: '까마귀 주화', codexItemId: '10' },
  { materialId: 'oquilla-token', name: '오킬루아 기념 주화', codexItemId: '43863' },
  { materialId: 'wave-blackstone', name: '파도의 블랙스톤', codexItemId: '756001' },
  { materialId: 'oquilla-green', name: '오킬루아 녹빛 담수', codexItemId: '8102' },
  { materialId: 'oquilla-blue', name: '오킬루아 물빛 담수', codexItemId: '8103' },
  { materialId: 'oquilla-gold', name: '오킬루아 금빛 담수', codexItemId: '8104' },
  { materialId: 'blue-figure', name: '에페리아 무역선/구축함: 흑룡 선수상 (+10)' },
  { materialId: 'blue-plating', name: '에페리아 무역선/구축함: 개량형 장갑 (+10)' },
  { materialId: 'blue-cannon', name: '에페리아 무역선/구축함: 메이나 함포 (+10)' },
  { materialId: 'blue-sail', name: '에페리아 무역선/구축함: 비층 바람 돛 (+10)' },
  {
    materialId: 'violent',
    name: '난폭한 파도가 새겨진 합판',
    codexItemId: '8019',
    crowCoinPrice: 300,
  },
  {
    materialId: 'support',
    name: '정교하게 다듬어진 지지대',
    codexItemId: '8020',
    crowCoinPrice: 300,
  },
  {
    materialId: 'adhesive',
    name: '파도의 흔적이 담긴 접착제',
    codexItemId: '8021',
    crowCoinPrice: 300,
  },
  { materialId: 'rough', name: '거센 파도가 새겨진 합판', codexItemId: '821366' },
  { materialId: 'coral', name: '견고한 산호 지지대', codexItemId: '821365' },
  { materialId: 'crimson', name: '진홍빛 산호가 잠든 접착제', codexItemId: '821367' },
  // 중범선 장비의 선행 장비와 제작 재료. ID는 BDO Codex 디자인 상세에서 확인한다.
  { materialId: 'toro-cannon', name: '에페리아 중범선: 토로의 함포 (+10)', codexItemId: '49742' },
  { materialId: 'toro-sail', name: '에페리아 중범선: 토로의 돛 (+10)', codexItemId: '49743' },
  {
    materialId: 'toro-figurehead',
    name: '에페리아 중범선: 토로의 선수상 (+10)',
    codexItemId: '49744',
  },
  { materialId: 'toro-plating', name: '에페리아 중범선: 토로의 장갑 (+10)', codexItemId: '49745' },
  { materialId: 'chiro-blueprint-cannon', name: '설계도면 : 치로의 함포', codexItemId: '8012' },
  { materialId: 'chiro-blueprint-sail', name: '설계도면 : 치로의 돛', codexItemId: '8013' },
  {
    materialId: 'chiro-blueprint-figurehead',
    name: '설계도면 : 치로의 선수상',
    codexItemId: '8014',
  },
  { materialId: 'chiro-blueprint-plating', name: '설계도면 : 치로의 흑장갑', codexItemId: '8015' },
  {
    materialId: 'carrack-permit-advance',
    name: '에페리아 중범선 부품 개조 허가증 : 점진',
    codexItemId: '59316',
  },
  {
    materialId: 'carrack-permit-balance',
    name: '에페리아 중범선 부품 개조 허가증 : 균형',
    codexItemId: '59317',
  },
  {
    materialId: 'carrack-permit-volante',
    name: '에페리아 중범선 부품 개조 허가증 : 비상',
    codexItemId: '59318',
  },
  {
    materialId: 'carrack-permit-valor',
    name: '에페리아 중범선 부품 개조 허가증 : 용맹',
    codexItemId: '59319',
  },
  {
    materialId: 'falasi-blueprint-cannon',
    name: '설계도면 : 팔라시의 함포',
    codexItemId: '821354',
  },
  { materialId: 'falasi-blueprint-sail', name: '설계도면 : 팔라시의 돛', codexItemId: '821355' },
  {
    materialId: 'falasi-blueprint-figurehead',
    name: '설계도면 : 팔라시의 선수상',
    codexItemId: '821356',
  },
  {
    materialId: 'falasi-blueprint-plating',
    name: '설계도면 : 팔라시의 장갑',
    codexItemId: '821357',
  },
  {
    materialId: 'falasi-permit-advance',
    name: '팔라시의 에페리아 중범선 부품 개조 허가증 : 점진',
    codexItemId: '59464',
  },
  {
    materialId: 'falasi-permit-balance',
    name: '팔라시의 에페리아 중범선 부품 개조 허가증 : 균형',
    codexItemId: '59465',
  },
  {
    materialId: 'falasi-permit-volante',
    name: '팔라시의 에페리아 중범선 부품 개조 허가증 : 비상',
    codexItemId: '59466',
  },
  {
    materialId: 'falasi-permit-valor',
    name: '팔라시의 에페리아 중범선 부품 개조 허가증 : 용맹',
    codexItemId: '59467',
  },
  {
    materialId: 'chiro-advance-cannon',
    name: '에페리아 중범선 점진: 치로의 함포 (+10)',
    codexItemId: '49746',
  },
  {
    materialId: 'chiro-advance-sail',
    name: '에페리아 중범선 점진: 치로의 돛 (+10)',
    codexItemId: '49747',
  },
  {
    materialId: 'chiro-advance-figurehead',
    name: '에페리아 중범선 점진: 치로의 선수상 (+10)',
    codexItemId: '49748',
  },
  {
    materialId: 'chiro-advance-plating',
    name: '에페리아 중범선 점진: 치로의 흑장갑 (+10)',
    codexItemId: '49749',
  },
  {
    materialId: 'chiro-balance-cannon',
    name: '에페리아 중범선 균형: 치로의 함포 (+10)',
    codexItemId: '49762',
  },
  {
    materialId: 'chiro-balance-sail',
    name: '에페리아 중범선 균형: 치로의 돛 (+10)',
    codexItemId: '49763',
  },
  {
    materialId: 'chiro-balance-figurehead',
    name: '에페리아 중범선 균형: 치로의 선수상 (+10)',
    codexItemId: '49764',
  },
  {
    materialId: 'chiro-balance-plating',
    name: '에페리아 중범선 균형: 치로의 흑장갑 (+10)',
    codexItemId: '49765',
  },
  {
    materialId: 'chiro-volante-cannon',
    name: '에페리아 중범선 비상: 치로의 함포 (+10)',
    codexItemId: '49766',
  },
  {
    materialId: 'chiro-volante-sail',
    name: '에페리아 중범선 비상: 치로의 돛 (+10)',
    codexItemId: '49767',
  },
  {
    materialId: 'chiro-volante-figurehead',
    name: '에페리아 중범선 비상: 치로의 선수상 (+10)',
    codexItemId: '49768',
  },
  {
    materialId: 'chiro-volante-plating',
    name: '에페리아 중범선 비상: 치로의 흑장갑 (+10)',
    codexItemId: '49769',
  },
  {
    materialId: 'chiro-valor-cannon',
    name: '에페리아 중범선 용맹: 치로의 함포 (+10)',
    codexItemId: '49770',
  },
  {
    materialId: 'chiro-valor-sail',
    name: '에페리아 중범선 용맹: 치로의 돛 (+10)',
    codexItemId: '49771',
  },
  {
    materialId: 'chiro-valor-figurehead',
    name: '에페리아 중범선 용맹: 치로의 선수상 (+10)',
    codexItemId: '49772',
  },
  {
    materialId: 'chiro-valor-plating',
    name: '에페리아 중범선 용맹: 치로의 흑장갑 (+10)',
    codexItemId: '49773',
  },
  {
    materialId: 'falasi-advance-cannon',
    name: '에페리아 중범선 점진: 팔라시의 함포 (+10)',
    codexItemId: '49778',
  },
  {
    materialId: 'falasi-advance-sail',
    name: '에페리아 중범선 점진: 팔라시의 돛 (+10)',
    codexItemId: '49779',
  },
  {
    materialId: 'falasi-advance-figurehead',
    name: '에페리아 중범선 점진: 팔라시의 선수상 (+10)',
    codexItemId: '49780',
  },
  {
    materialId: 'falasi-advance-plating',
    name: '에페리아 중범선 점진: 팔라시의 장갑 (+10)',
    codexItemId: '49781',
  },
  {
    materialId: 'falasi-balance-cannon',
    name: '에페리아 중범선 균형: 팔라시의 함포 (+10)',
    codexItemId: '49782',
  },
  {
    materialId: 'falasi-balance-sail',
    name: '에페리아 중범선 균형: 팔라시의 돛 (+10)',
    codexItemId: '49783',
  },
  {
    materialId: 'falasi-balance-figurehead',
    name: '에페리아 중범선 균형: 팔라시의 선수상 (+10)',
    codexItemId: '49784',
  },
  {
    materialId: 'falasi-balance-plating',
    name: '에페리아 중범선 균형: 팔라시의 장갑 (+10)',
    codexItemId: '49785',
  },
  {
    materialId: 'falasi-volante-cannon',
    name: '에페리아 중범선 비상: 팔라시의 함포 (+10)',
    codexItemId: '49786',
  },
  {
    materialId: 'falasi-volante-sail',
    name: '에페리아 중범선 비상: 팔라시의 돛 (+10)',
    codexItemId: '49787',
  },
  {
    materialId: 'falasi-volante-figurehead',
    name: '에페리아 중범선 비상: 팔라시의 선수상 (+10)',
    codexItemId: '49788',
  },
  {
    materialId: 'falasi-volante-plating',
    name: '에페리아 중범선 비상: 팔라시의 장갑 (+10)',
    codexItemId: '49789',
  },
  {
    materialId: 'falasi-valor-cannon',
    name: '에페리아 중범선 용맹: 팔라시의 함포 (+10)',
    codexItemId: '49790',
  },
  {
    materialId: 'falasi-valor-sail',
    name: '에페리아 중범선 용맹: 팔라시의 돛 (+10)',
    codexItemId: '49791',
  },
  {
    materialId: 'falasi-valor-figurehead',
    name: '에페리아 중범선 용맹: 팔라시의 선수상 (+10)',
    codexItemId: '49792',
  },
  {
    materialId: 'falasi-valor-plating',
    name: '에페리아 중범선 용맹: 팔라시의 장갑 (+10)',
    codexItemId: '49793',
  },
]

export const itemByMaterialId = Object.fromEntries(
  items.map((item) => [item.materialId, item]),
) as Record<string, ItemRecord>
