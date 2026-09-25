import type { NpcDefinition } from "../types";

export const npcs: NpcDefinition[] = [
  { id: "ravinia", name: "로비니아" },
  { id: "ravikel", name: "라비켈" },
];

export const npcById = Object.fromEntries(
  npcs.map((npc) => [npc.id, npc]),
) as Record<string, NpcDefinition>;
