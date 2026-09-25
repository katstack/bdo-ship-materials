import type { QuestRecord } from "../types";

const r = (materialId: string, quantity: number) => ({ materialId, quantity });
const choice = (id: string, label: string, ...rewards: ReturnType<typeof r>[]) => ({ id, label, rewards });

// BDO Codex 공개 의뢰 페이지에서 ID·반복·목표·보상·충돌 관계를 확인한 항목만 노출한다.
export const quests: QuestRecord[] = [
  {
    id: "lively-iliya", codexQuestId: "3736/12/", period: "daily",
    name: "[물물교환][일일] 활기찬 일리야 섬", startLocationId: "iliya", giverId: "iliya-resident",
    objective: "물물교환 15회 완료", rewards: [r("enhanced", 10), r("high", 1), r("pearl", 2), r("deep-glue", 8), r("reef", 8), r("crow-coin", 50)],
    note: "기존 활기찬 일리야 섬 I~III의 통합 의뢰 · Codex 상세 보상 기준",
  },
  {
    id: "supply-iliya", codexQuestId: "3727/3/", period: "daily",
    name: "[일일] 보급물자 운송(일리야섬)", startLocationId: "velia", giverId: "ravinia",
    objective: "로비니아의 보급물자를 제한 시간 내 일리야 섬의 다리오에게 전달", rewards: [r("low", 1), r("crow-coin", 50)],
    incompatibleQuestIds: ["3727/2/"], note: "벨리아 마을 로비니아에게 수령 · 제한 시간 있음",
  },
  {
    id: "supply-oquilla", codexQuestId: "3727/2/", period: "daily",
    name: "[일일] 보급물자 운송(오킬루아의 눈)", startLocationId: "velia", giverId: "ravinia",
    objective: "로비니아의 보급물자를 제한 시간 내 오킬루아의 눈 에르오에게 전달", rewards: [r("low", 2), r("crow-coin", 100)],
    incompatibleQuestIds: ["3727/3/"], note: "벨리아 마을 로비니아에게 수령 · 제한 시간 있음",
  },
  {
    id: "guild-not-charity", codexQuestId: "3707/6/", period: "daily",
    name: "[일일] 길드는 자선단체가 아니다", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 남쪽에서 어린 해왕류 2마리 처치", rewards: [r("oquilla-token", 1)],
    choices: [choice("wave", "파도빛이 감도는 규격 각목", r("wave", 5)), choice("violent", "난폭한 파도가 새겨진 합판", r("violent", 1))],
    note: "오킬루아의 눈 라비켈 · Codex 확인",
  },
  {
    id: "self-defense", codexQuestId: "3707/7/", period: "daily",
    name: "[일일] 제 몸 하나는 스스로 지켜야", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 북동쪽에서 헤카루 1마리 처치", rewards: [r("oquilla-token", 1)],
    choices: [choice("combat", "콕스해적단의 유물 (전투)", r("combat", 3)), choice("support", "정교하게 다듬어진 지지대", r("support", 1))],
    note: "오킬루아의 눈 라비켈 · Codex 확인",
  },
  {
    id: "both-good", codexQuestId: "3707/8/", period: "daily",
    name: "[일일] 너도 좋고, 나도 좋고", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 북서쪽에서 표류추적자 1마리 처치", rewards: [r("oquilla-token", 1)],
    choices: [choice("deep-tide", "짙은 파도빛이 감도는 규격 각목", r("deep-tide", 4)), choice("adhesive", "파도의 흔적이 담긴 접착제", r("adhesive", 1))],
    note: "오킬루아의 눈 라비켈 · Codex 확인",
  },
  {
    id: "small-repayment-1", codexQuestId: "3707/12/", period: "daily",
    name: "[일일] 그믐달 길드의 작은 보답 I", startLocationId: "oquilla-eye", giverId: "herad-romson",
    objective: "그믐달 길드원·원주민·세렌디아 병사를 도운 보답 수령", rewards: [],
    choices: [
      choice("seaweed", "심해초 줄기", r("seaweed", 8)), choice("rock", "홍조빛 해저단괴", r("rock", 4)),
      choice("pearl", "순수한 진주 결정", r("pearl", 4)), choice("deep-glue", "심해의 기억이 담긴 아교", r("deep-glue", 16)),
      choice("reef", "순수한 암초 조각", r("reef", 16)), choice("enhanced", "강화된 섬나무 증착합판", r("enhanced", 20)),
      choice("high", "콕스해적단의 유물(협상 상급)", r("high", 2)),
    ],
    note: "헤라드 롬슨에게 수령 · 매일 자정 재수락 · Codex 선택 보상 기준",
  },
  {
    id: "small-repayment-2", codexQuestId: "3707/13/", period: "daily",
    name: "[일일] 그믐달 길드의 작은 보답 II", startLocationId: "oquilla-eye", giverId: "herad-romson",
    objective: "그믐달 길드원·원주민·세렌디아 병사를 도운 보답 수령", rewards: [],
    choices: [
      choice("wave", "파도빛이 감도는 규격 각목", r("wave", 6)), choice("combat", "콕스해적단의 유물(전투)", r("combat", 6)),
      choice("deep-tide", "짙은 파도빛이 감도는 규격 각목", r("deep-tide", 6)), choice("moon", "달의 비늘이 새겨진 합판", r("moon", 20)),
      choice("flax", "달의 핏줄이 새겨진 아마포", r("flax", 6)), choice("tear", "심해의 눈물", r("tear", 2)),
    ],
    note: "헤라드 롬슨에게 수령 · 매일 자정 재수락 · Codex 선택 보상 기준",
  },
  {
    id: "moon-young-sea-hunter", codexQuestId: "3707/23/", period: "daily",
    name: "[일일] 그믐달 어린 해왕류 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 주변에서 어린 해왕류 5마리 처치", rewards: [r("moon", 10), r("flax", 3), r("tear", 1), r("oquilla-token", 3)],
    incompatibleQuestIds: ["3707/9/", "3707/10/", "3707/11/"], note: "오킬루아의 눈 라비켈 · 개별 해왕류 3종 루트와 배타",
  },
  {
    id: "candidum-daily", codexQuestId: "3707/9/", period: "daily",
    name: "[일일] 그믐달 길드의 칸디둠 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 먼 북쪽에서 칸디둠 1마리 처치", rewards: [r("oquilla-token", 1), r("crow-coin", 100)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 14)), choice("violent", "난폭한 파도가 새겨진 합판", r("violent", 1))],
    incompatibleQuestIds: ["3707/23/"], note: "오킬루아의 눈 라비켈 · 어린 해왕류 루트와 배타",
  },
  {
    id: "nineshark-daily", codexQuestId: "3707/10/", period: "daily",
    name: "[일일] 그믐달 길드의 나인샤크 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 먼 북서쪽에서 나인샤크 1마리 처치", rewards: [r("oquilla-token", 1), r("crow-coin", 100)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 14)), choice("support", "정교하게 다듬어진 지지대", r("support", 1))],
    incompatibleQuestIds: ["3707/23/"], note: "오킬루아의 눈 라비켈 · 어린 해왕류 루트와 배타",
  },
  {
    id: "black-rust-daily", codexQuestId: "3707/11/", period: "daily",
    name: "[일일] 그믐달 길드의 검은무쇠이빨 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 먼 서쪽에서 검은무쇠이빨 1마리 처치", rewards: [r("oquilla-token", 1), r("crow-coin", 100)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 14)), choice("adhesive", "파도의 흔적이 담긴 접착제", r("adhesive", 1))],
    incompatibleQuestIds: ["3707/23/"], note: "오킬루아의 눈 라비켈 · 어린 해왕류 루트와 배타",
  },
  {
    id: "blocking-sea-route", codexQuestId: "3726/1/", period: "daily",
    name: "[일일] 바닷길을 막고 있는 괴수들", startLocationId: "oquilla-eye", giverId: "haeran",
    objective: "유르 해역의 바다 괴수 처치", rewards: [r("crow-coin", 200)],
    choices: [choice("green", "오킬루아 녹빛담수", r("oquilla-green", 1)), choice("blue", "오킬루아 물빛담수", r("oquilla-blue", 1)), choice("gold", "오킬루아 금빛담수", r("oquilla-gold", 1))],
    note: "해란에게 수령 · 레크라샨 사냥터 항해 의뢰",
  },
  {
    id: "otter-traders", codexQuestId: "3707/25/", period: "weekly",
    name: "[주간] 어린 해달 상인들을 위해", startLocationId: "oquilla-eye", giverId: "cario",
    objective: "어린 해달 상인을 위한 산호 재료 조달", rewards: [r("oquilla-token", 15), r("seaweed", 45), r("rock", 15)],
    note: "카리오에게 수령 · 매주 목요일 00시 이후 재수락 · Codex 상세 보상 기준",
  },
  {
    id: "candidum-weekly", codexQuestId: "3707/19/", period: "weekly",
    name: "[주간] 그믐달 길드의 칸디둠 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 북쪽 먼 대양의 칸디둠 처치", rewards: [r("crow-coin", 500)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 60)), choice("rock", "홍조빛 해저단괴", r("rock", 4)), choice("violent", "난폭한 파도가 새겨진 합판", r("violent", 1))],
    note: "라비켈에게 수령 · 매주 목요일 00시 이후 재수락",
  },
  {
    id: "nineshark-weekly", codexQuestId: "3707/20/", period: "weekly",
    name: "[주간] 그믐달 길드의 나인샤크 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 북서쪽 먼 대양의 나인샤크 처치", rewards: [r("crow-coin", 500)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 60)), choice("tear", "심해의 눈물", r("tear", 2)), choice("support", "정교하게 다듬어진 지지대", r("support", 1))],
    note: "라비켈에게 수령 · 매주 목요일 00시 이후 재수락",
  },
  {
    id: "black-rust-weekly", codexQuestId: "3707/21/", period: "weekly",
    name: "[주간] 그믐달 길드의 검은무쇠이빨 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 서쪽 먼 대양의 검은무쇠이빨 처치", rewards: [r("crow-coin", 500)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 60)), choice("combat", "콕스해적단의 유물(전투)", r("combat", 6)), choice("adhesive", "파도의 흔적이 담긴 접착제", r("adhesive", 1))],
    note: "라비켈에게 수령 · 매주 목요일 00시 이후 재수락",
  },
  {
    id: "population-report", codexQuestId: "3707/22/", period: "weekly",
    name: "[주간] 개체수 증가 보고", startLocationId: "oquilla-eye", giverId: "oquilla-soldier",
    objective: "오킬루아의 눈 주변 어린 해왕류 처치", rewards: [r("combat", 2)],
    note: "병사에게 수령 · 매주 목요일 00시 이후 재수락",
  },
  {
    id: "ruthless-monsters", codexQuestId: "3726/2/", period: "weekly",
    name: "[주간] 무자비한 괴수 무리", startLocationId: "oquilla-eye", giverId: "haeran",
    objective: "해란의 요청에 따라 바다 괴수 처치", rewards: [r("crow-coin", 500)],
    choices: [choice("green", "오킬루아 녹빛담수", r("oquilla-green", 3)), choice("blue", "오킬루아 물빛담수", r("oquilla-blue", 3)), choice("gold", "오킬루아 금빛담수", r("oquilla-gold", 3))],
    note: "해란에게 수령 · 레크라샨 사냥터 항해 의뢰",
  },
];

export const questById = Object.fromEntries(quests.map((quest) => [quest.id, quest])) as Record<string, QuestRecord>;
export const questByCodexId = Object.fromEntries(quests.map((quest) => [quest.codexQuestId, quest])) as Record<string, QuestRecord>;
