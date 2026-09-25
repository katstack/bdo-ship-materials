export const CODEX_ORIGIN = "https://bdocodex.com";
const korean = (path: string) => `${CODEX_ORIGIN}/kr/${path}`;

export const codexQuestUrl = (questId: string) => korean(`quest/${questId}`);
export const codexItemUrl = (itemId: string) => korean(`item/${itemId}/`);
export const codexNpcUrl = (npcId: string) => korean(`npc/${npcId}`);
export const codexQuestTipUrl = (questId: string) => {
  const [group, id] = questId.replace(/\/+$/, "").split("/");
  return `${CODEX_ORIGIN}/tip.php?id=quest--${id}&quest_group=${group}&l=kr&nf=on`;
};
export const codexItemTipUrl = (itemId: string) =>
  `${CODEX_ORIGIN}/tip.php?id=item--${itemId}&enchant=0&l=kr&nf=on`;
