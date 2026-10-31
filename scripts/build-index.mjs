// Build step: turn data/library.json into what the browser and outside agents read.
//   public/api/index.json   compact rows for search, filters and the field (any size, one fetch)
//   public/api/library.json the full open dataset (CC0), for anyone building on it
//   public/llms.txt         a plain-text map for AI crawlers
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BRANCHES, hostOf } from "../lib/taxonomy.mjs";
import { readData, DATA } from "./data-io.mjs";

const PUB = join(DATA, "..", "public");
const { library } = await readData();
library.sort((a, b) => (b.added || "").localeCompare(a.added || "") || a.name.localeCompare(b.name));

const rows = library.map((e) => ({
  i: e.id, n: e.name, h: hostOf(e.url),
  d: e.description.length > 160 ? `${e.description.slice(0, 157).trim()}…` : e.description,
  b: e.branch, s: e.sub, k: e.kind, t: e.tags,
  ...(e.featured ? { f: 1 } : {}), ...(e.gem ? { g: 1 } : {}),
  a: (e.added || "").slice(0, 10),
}));

await mkdir(join(PUB, "api"), { recursive: true });
await writeFile(join(PUB, "api", "index.json"), JSON.stringify(rows));
await writeFile(join(PUB, "api", "library.json"), JSON.stringify({ license: "CC0-1.0", generatedAt: new Date().toISOString(), count: library.length, branches: BRANCHES.map(({ id, name, subs }) => ({ id, name, subs: subs.map(({ id, name }) => ({ id, name })) })), entries: library }, null, 1));

const lines = ["# AI Tree Library", "", "> An open-source, community-built library of websites, tools, apps and extensions. Every link is reviewed by a human.", "", `Dataset: https://aitreelibrary.com/api/library.json (${library.length} entries, CC0)`, ""];
for (const b of BRANCHES) {
  const items = library.filter((e) => e.branch === b.id);
  if (!items.length) continue;
  lines.push(`## ${b.name}`, "");
  for (const e of items) lines.push(`- [${e.name}](https://aitreelibrary.com/${e.id}): ${e.description || hostOf(e.url)}`);
  lines.push("");
}
await writeFile(join(PUB, "llms.txt"), lines.join("\n"));
console.log(`[build-index] ${library.length} entries → public/api`);
