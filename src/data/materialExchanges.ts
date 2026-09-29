// 재료 교환 갱신: 입력 교역품은 1개가 기본이다.
// 배열은 같은 재료가 갱신마다 서로 다른 비율로 등장할 수 있음을 뜻한다.
// 미등록 재료는 앱에서 자동으로 1:1로 계산한다.
export const materialExchangeOutputs: Record<string, number | number[]> = {
  island: 50,
  enhanced: 10,
  steel: 3,
  'deep-tide': [1, 2],
}

export const materialExchangeOutputOptions = (materialId: string) => {
  const output = materialExchangeOutputs[materialId]
  return Array.isArray(output) ? output : [output ?? 1]
}

export const materialExchangeKey = (materialId: string, outputQuantity: number) =>
  `${materialId}@${outputQuantity}`
