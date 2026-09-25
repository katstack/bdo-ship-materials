// 재료 교환 갱신: 입력 교역품은 1개가 기본이며, 확인된 재료만 출력 수량을 덮어쓴다.
// 미등록 재료는 앱에서 자동으로 1:1로 계산한다.
export const materialExchangeOutputs: Record<string, number> = {
  island: 50,
  enhanced: 10,
  steel: 3,
};

export const materialExchangeOutput = (materialId: string) =>
  materialExchangeOutputs[materialId] ?? 1;
