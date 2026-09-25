import type { QuestRecord } from "../types";

const r = (materialId: string, quantity: number) => ({ materialId, quantity });
const choice = (id: string, label: string, ...rewards: ReturnType<typeof r>[]) => ({ id, label, rewards });
const url = (id: string) => `https://bdocodex.com/kr/quest/${id}`;

// BDO Codex 공개 의뢰 페이지에서 ID·반복·목표·보상·충돌 관계를 확인한 항목만 노출한다.
export const quests: QuestRecord[] = [
  {
    id: "supply-iliya", codexQuestId: "3727/3/", codexUrl: url("3727/3/"), period: "daily",
    name: "[일일] 보급물자 운송(일리야섬)", startLocationId: "velia", giverId: "ravinia",
    objective: "로비니아의 보급물자를 제한 시간 내 일리야 섬의 다리오에게 전달", rewards: [r("low", 1), r("crow-coin", 50)],
    incompatibleQuestIds: ["3727/2/"], note: "벨리아 마을 로비니아에게 수령 · 제한 시간 있음",
  },
  {
    id: "supply-oquilla", codexQuestId: "3727/2/", codexUrl: url("3727/2/"), period: "daily",
    name: "[일일] 보급물자 운송(오킬루아의 눈)", startLocationId: "velia", giverId: "ravinia",
    objective: "로비니아의 보급물자를 제한 시간 내 오킬루아의 눈 에르오에게 전달", rewards: [r("low", 2), r("crow-coin", 100)],
    incompatibleQuestIds: ["3727/3/"], note: "벨리아 마을 로비니아에게 수령 · 제한 시간 있음",
  },
  {
    id: "guild-not-charity", codexQuestId: "3707/6/", codexUrl: url("3707/6/"), period: "daily",
    name: "[일일] 길드는 자선단체가 아니다", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 남쪽에서 어린 해왕류 2마리 처치", rewards: [r("oquilla-token", 1)],
    choices: [choice("wave", "파도빛이 감도는 규격 각목", r("wave", 5)), choice("violent", "난폭한 파도가 새겨진 합판", r("violent", 1))],
    note: "오킬루아의 눈 라비켈 · Codex 확인",
  },
  {
    id: "self-defense", codexQuestId: "3707/7/", codexUrl: url("3707/7/"), period: "daily",
    name: "[일일] 제 몸 하나는 스스로 지켜야", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 북동쪽에서 헤카루 1마리 처치", rewards: [r("oquilla-token", 1)],
    choices: [choice("combat", "콕스해적단의 유물 (전투)", r("combat", 3)), choice("support", "정교하게 다듬어진 지지대", r("support", 1))],
    note: "오킬루아의 눈 라비켈 · Codex 확인",
  },
  {
    id: "both-good", codexQuestId: "3707/8/", codexUrl: url("3707/8/"), period: "daily",
    name: "[일일] 너도 좋고, 나도 좋고", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 북서쪽에서 표류추적자 1마리 처치", rewards: [r("oquilla-token", 1)],
    choices: [choice("deep-tide", "짙은 파도빛이 감도는 규격 각목", r("deep-tide", 4)), choice("adhesive", "파도의 흔적이 담긴 접착제", r("adhesive", 1))],
    note: "오킬루아의 눈 라비켈 · Codex 확인",
  },
  {
    id: "moon-young-sea-hunter", codexQuestId: "3707/23/", codexUrl: url("3707/23/"), period: "daily",
    name: "[일일] 그믐달 어린 해왕류 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 주변에서 어린 해왕류 5마리 처치", rewards: [r("moon", 10), r("flax", 3), r("tear", 1), r("oquilla-token", 3)],
    incompatibleQuestIds: ["3707/9/", "3707/10/", "3707/11/"], note: "오킬루아의 눈 라비켈 · 개별 해왕류 3종 루트와 배타",
  },
  {
    id: "candidum-daily", codexQuestId: "3707/9/", codexUrl: url("3707/9/"), period: "daily",
    name: "[일일] 그믐달 길드의 칸디둠 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 먼 북쪽에서 칸디둠 1마리 처치", rewards: [r("oquilla-token", 1), r("crow-coin", 100)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 14)), choice("violent", "난폭한 파도가 새겨진 합판", r("violent", 1))],
    incompatibleQuestIds: ["3707/23/"], note: "오킬루아의 눈 라비켈 · 어린 해왕류 루트와 배타",
  },
  {
    id: "nineshark-daily", codexQuestId: "3707/10/", codexUrl: url("3707/10/"), period: "daily",
    name: "[일일] 그믐달 길드의 나인샤크 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 먼 북서쪽에서 나인샤크 1마리 처치", rewards: [r("oquilla-token", 1), r("crow-coin", 100)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 14)), choice("support", "정교하게 다듬어진 지지대", r("support", 1))],
    incompatibleQuestIds: ["3707/23/"], note: "오킬루아의 눈 라비켈 · 어린 해왕류 루트와 배타",
  },
  {
    id: "black-rust-daily", codexQuestId: "3707/11/", codexUrl: url("3707/11/"), period: "daily",
    name: "[일일] 그믐달 길드의 검은무쇠이빨 사냥꾼", startLocationId: "oquilla-eye", giverId: "ravikel",
    objective: "오킬루아의 눈 먼 서쪽에서 검은무쇠이빨 1마리 처치", rewards: [r("oquilla-token", 1), r("crow-coin", 100)],
    choices: [choice("blackstone", "온기를 품은 블랙스톤", r("wave-blackstone", 14)), choice("adhesive", "파도의 흔적이 담긴 접착제", r("adhesive", 1))],
    incompatibleQuestIds: ["3707/23/"], note: "오킬루아의 눈 라비켈 · 어린 해왕류 루트와 배타",
  },
];

export const questById = Object.fromEntries(quests.map((quest) => [quest.id, quest])) as Record<string, QuestRecord>;
export const questByCodexId = Object.fromEntries(quests.map((quest) => [quest.codexQuestId, quest])) as Record<string, QuestRecord>;
