// 출처: 2024-03-27 검은사막 한국 업데이트 안내(groupContentNo=11951)의
// '까마귀 주화 상점' 표. 값은 해당 표의 변경 후 구매 가격이다.
export const crowCoinPriceSource = {
  publishedAt: "2024-03-27",
  url: "https://www.kr.playblackdesert.com/ko-KR/News/Detail?countryType=ko-KR&groupContentNo=11951",
} as const;

// 키는 앱의 LocalStorage 재고 키와 같게 유지한다.
export const officialCrowCoinPrices: Record<string, number> = {
  tear: 500,
  combat: 150,
  "brilliant-salt": 500,
  "deep-tide": 100,
  "brilliant-pearl": 500,
  seaweed: 100,
  high: 500,
  wave: 100,
  cobalt: 500,
  flax: 50,
  enhanced: 50,
  rock: 250,
  reef: 40,
  moon: 20,
  pearl: 250,
};
