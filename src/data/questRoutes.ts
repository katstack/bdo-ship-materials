import type { QuestRoute } from "../types";

// Codex의 '허용되지 않는/끝나지 않은 퀘스트' 관계를 플레이 단위 선택지로 정리한다.
// 한 선택지는 여러 의뢰를 포함할 수 있으므로, '하나 vs 개별 3종' 같은 구조를 표현할 수 있다.
export const questRoutes: QuestRoute[] = [
  {
    id: "moon-guild-hunting-daily",
    startLocationId: "oquilla-eye",
    giverId: "ravikel",
    name: "그믐달 길드 해왕류 일일 루트",
    description: "어린 해왕류 1개 의뢰 또는 개별 해왕류 3종 의뢰 중 한 루트를 선택합니다.",
    options: [
      { id: "young-sea", label: "어린 해왕류 루트", questIds: ["moon-young-sea-hunter"] },
      { id: "named-monsters", label: "개별 해왕류 3종 루트", questIds: ["candidum-daily", "nineshark-daily", "black-rust-daily"] },
    ],
  },
  {
    id: "ravinia-supply-daily",
    startLocationId: "velia",
    giverId: "ravinia",
    name: "로비니아 보급물자 운송",
    description: "Codex에서 서로 미완료 조건으로 확인된 운송 의뢰 중 한 곳을 선택합니다.",
    options: [
      { id: "oquilla", label: "오킬루아의 눈 운송", questIds: ["supply-oquilla"] },
      { id: "iliya", label: "일리야 섬 운송", questIds: ["supply-iliya"] },
    ],
  },
];
