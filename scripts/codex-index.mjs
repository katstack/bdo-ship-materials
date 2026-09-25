#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const [kind, ...terms] = process.argv.slice(2);
const query = terms.join(" ").trim();
if (!(["quest", "item"].includes(kind) && query)) {
  console.error("Usage: node scripts/codex-index.mjs <quest|item> <exact name>");
  process.exit(1);
}

const file = kind === "quest" ? "quests.json" : "items.json";
const raw = await readFile(file, "utf8");
const rows = JSON.parse(raw.replace(/^\uFEFF/, "")).aaData;
const text = (value) => String(value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const matches = rows
  .filter((row) => text(row[2]) === query)
  .map((row) => {
    const id = kind === "quest" ? row[0].display : String(row[0]);
    return {
      id: kind === "quest" ? `${id}/` : id,
      name: text(row[2]),
      detailUrl:
        kind === "quest"
          ? (() => {
              const [group, questId] = id.split("/");
              return `https://bdocodex.com/tip.php?id=quest--${questId}&quest_group=${group}&l=kr&nf=on`;
            })()
          : `https://bdocodex.com/tip.php?id=item--${id}&enchant=0&l=kr&nf=on`,
    };
  });

console.log(JSON.stringify(matches, null, 2));
