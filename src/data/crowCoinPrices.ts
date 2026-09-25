// 출처: 검은사막 한국 업데이트 안내(groupContentNo=15614)의
// '까마귀 주화 상점' 표. 값은 해당 표의 변경 후 구매 가격이다.
export const crowCoinPriceSource = {
  url: "https://www.kr.playblackdesert.com/ko-KR/News/Detail?groupContentNo=15614&countryType=ko-KR",
} as const;

// 원문 표 전체. 아직 제작식에 연결하지 않은 재료도 이후 카탈로그 확장에 쓸 수 있게 보존한다.
export const latestCrowCoinPricesByName: Record<string, number> = {
  "달의 비늘이 새겨진 합판": 15,
  "순수한 암초 조각": 30,
  "달의 핏줄이 새겨진 아마포": 40,
  "강화된 섬나무 증착합판": 40,
  "파도빛이 감도는 규격 각목": 80,
  "짙은 파도빛이 감도는 규격 각목": 80,
  "심해초 줄기": 80,
  "심해의 기억이 담긴 아교": 110,
  "코발트 주괴": 120,
  "콕스해적단의 유물(협상 하급)": 120,
  "콕스해적단의 유물(전투)": 120,
  "대양의 견고한 현철": 130,
  "칸의 비늘": 160,
  "홍조빛 해저단괴": 200,
  "순수한 진주 결정": 200,
  "별빛 강화제": 200,
  "별빛 유화제": 200,
  "난폭한 파도가 새겨진 합판": 300,
  "정교하게 다듬어진 지지대": 300,
  "파도의 흔적이 담긴 접착제": 300,
  "칸의 힘줄": 400,
  "화려한 암염 주괴": 400,
  "심해의 눈물": 400,
  "콕스해적단의 유물(협상 상급)": 400,
  "빛나는 코발트 주괴": 400,
  "화려한 진주 결정": 400,
  "짙은 파도의 흔적이 담긴 접착제": 400,
};

// 키는 앱의 LocalStorage 재고 키와 같게 유지한다. 위 원문 표에서 현재 카탈로그에 대응하는 값이다.
export const officialCrowCoinPrices: Record<string, number> = {
  moon: 15,
  reef: 30,
  flax: 40,
  enhanced: 40,
  wave: 80,
  "deep-tide": 80,
  seaweed: 80,
  "deep-glue": 110,
  low: 120,
  combat: 120,
  steel: 130,
  rock: 200,
  pearl: 200,
  violent: 300,
  support: 300,
  adhesive: 300,
  "brilliant-salt": 400,
  tear: 400,
  high: 400,
  cobalt: 400,
  "brilliant-pearl": 400,
};
