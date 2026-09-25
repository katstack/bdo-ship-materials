import type { NpcDefinition } from "../types";

export const npcs: NpcDefinition[] = [
  { id: "ravinia", name: "로비니아", codexNpcId: "50828/1" },
  { id: "ravikel", name: "라비켈", codexNpcId: "49579" },
  { id: "iliya-resident", name: "주민", codexNpcId: "624/405" },
  { id: "cario", name: "카리오", codexNpcId: "62137/1" },
  { id: "oquilla-soldier", name: "병사", codexNpcId: "449/10" },
  { id: "haeran", name: "해란", codexNpcId: "44156/1" },
  { id: "herad-romson", name: "헤라드 롬슨", codexNpcId: "49578/1" },
];

export const npcById = Object.fromEntries(
  npcs.map((npc) => [npc.id, npc]),
) as Record<string, NpcDefinition>;
