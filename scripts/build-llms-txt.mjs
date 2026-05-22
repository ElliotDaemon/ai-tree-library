// Generates public/llms.txt and public/llms-full.txt from library.json
// so LLM crawlers (ChatGPT, Claude, Perplexity, Gemini) can ingest the
// library efficiently. Follows the emerging llmstxt.org convention:
//
//   # Site title
//   > One-sentence summary
//   ## Section
//   - [Name](url): description

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB_PATH = join(__dirname, "..", "public", "library.json");
const OUT_BRIEF = join(__dirname, "..", "public", "llms.txt");
const OUT_FULL = join(__dirname, "..", "public", "llms-full.txt");
const SITE = "https://aitreelibrary.com";

let lib;
try {
  const raw = await readFile(LIB_PATH, "utf8");
  lib = JSON.parse(raw);
} catch {
  console.error("[llms-txt] No library.json — writing empty stubs");
  await writeFile(OUT_BRIEF, "# AI Tree Library\n\n> Site not yet generated. Visit https://aitreelibrary.com\n");
  await writeFile(OUT_FULL, "# AI Tree Library — Full Catalog\n\n> Pending build.\n");
  process.exit(0);
}

const entries = lib.entries ?? [];
const cats = lib.categories ?? [];
const topLevel = cats.filter((c) => c.isTopLevel).sort((a, b) => a.displayOrder - b.displayOrder);

const subsByParent = new Map();
for (const sub of cats.filter((c) => !c.isTopLevel)) {
  if (!subsByParent.has(sub.parentName)) subsByParent.set(sub.parentName, []);
  subsByParent.get(sub.parentName).push(sub);
}

const entriesBySubcat = new Map();
for (const e of entries) {
  if (!e.categoryId) continue;
  const arr = entriesBySubcat.get(e.categoryId) || [];
  arr.push(e);
  entriesBySubcat.set(e.categoryId, arr);
}

// =====================================================================
// llms.txt — short overview, ~200 lines max, points at llms-full.txt
// =====================================================================
const brief = [];
brief.push("# AI Tree Library");
brief.push("");
brief.push(
  "> A 3D constellation of curated AI tools, design inspiration, and creative resources. " +
    "Hand-picked by Elliot Daemon. " +
    `${entries.length} entries across ${topLevel.length} top-level categories. ` +
    "Each entry has its own page at " + SITE + "/<slug>."
);
brief.push("");
brief.push("Live constellation: " + SITE);
brief.push("Full machine-readable catalog: " + SITE + "/llms-full.txt");
brief.push("Sitemap: " + SITE + "/sitemap.xml");
brief.push("");

for (const cat of topLevel) {
  brief.push("## " + cat.name);
  brief.push("");
  if (cat.description) {
    brief.push("> " + cat.description.replace(/\s+/g, " ").trim());
    brief.push("");
  }

  // Top picks: featured + legendary, max 8 per category in the brief
  const subIds = (subsByParent.get(cat.name) || []).map((s) => s.id);
  const catEntries = [];
  for (const sid of subIds) {
    for (const e of entriesBySubcat.get(sid) || []) catEntries.push(e);
  }
  const sorted = catEntries.sort((a, b) => {
    const ra = isLegendary(a) ? 0 : isEstablished(a) ? 1 : 2;
    const rb = isLegendary(b) ? 0 : isEstablished(b) ? 1 : 2;
    if (ra !== rb) return ra - rb;
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const e of sorted.slice(0, 8)) {
    const desc = (e.description || "").replace(/\s+/g, " ").trim();
    const line = `- [${e.name}](${SITE}/${e.slug || ""}): ${desc}${e.url ? ` — ${e.url}` : ""}`;
    brief.push(line);
  }
  brief.push("");
  brief.push("Full ${cat.name} catalog: " + SITE + "/category/" + cat.slug);
  brief.push("");
}

brief.push("---");
brief.push("");
brief.push("This file follows the llmstxt.org convention. The companion ");
brief.push(SITE + "/llms-full.txt contains every entry with its long description, ");
brief.push("URL, rarity tier, tags, and category — meant for LLM ingestion.");
brief.push("");
brief.push("Curated by Elliot Daemon (https://elliotdaemon.com)");
brief.push("Last updated: " + (lib.generatedAt || new Date().toISOString()));
brief.push("");

await writeFile(OUT_BRIEF, brief.join("\n"));
console.log(`[llms-txt] Wrote ${OUT_BRIEF} (${brief.length} lines)`);

// =====================================================================
// llms-full.txt — full catalog with long descriptions
// =====================================================================
const full = [];
full.push("# AI Tree Library — Full Catalog");
full.push("");
full.push(
  "> Complete machine-readable catalog of every entry in the AI Tree Library, " +
    "grouped by category and subcategory. Includes long-form descriptions, " +
    "rarity tiers, types, pricing, and tags. " +
    "Designed for LLM ingestion."
);
full.push("");
full.push("Total entries: " + entries.length);
full.push("Top-level categories: " + topLevel.length);
full.push("Last updated: " + (lib.generatedAt || new Date().toISOString()));
full.push("");
full.push("---");
full.push("");

for (const cat of topLevel) {
  full.push("# " + cat.name);
  full.push("");
  if (cat.description) full.push(cat.description), full.push("");
  full.push("Category page: " + SITE + "/category/" + cat.slug);
  full.push("");

  const subs = (subsByParent.get(cat.name) || []).sort((a, b) => a.displayOrder - b.displayOrder);
  for (const sub of subs) {
    const subEntries = (entriesBySubcat.get(sub.id) || []).sort((a, b) => a.name.localeCompare(b.name));
    if (subEntries.length === 0) continue;
    full.push("## " + sub.name);
    full.push("");
    for (const e of subEntries) {
      full.push(`### ${e.name}`);
      full.push("");
      full.push(`- URL: ${e.url || "(none)"}`);
      full.push(`- Library page: ${SITE}/${e.slug}`);
      full.push(`- Type: ${e.type || "Tool"}`);
      if (e.rarity) full.push(`- Rarity: ${e.rarity}`);
      if (e.pricing && e.pricing !== "Unknown") full.push(`- Pricing: ${e.pricing}`);
      if (e.featured) full.push(`- Featured: yes`);
      if (e.gem) full.push(`- Hidden Gem: yes`);
      if (e.tags && e.tags.length > 0) full.push(`- Tags: ${e.tags.join(", ")}`);
      if (e.source) full.push(`- Submitted by: ${e.source}`);
      full.push("");
      if (e.longDescription) {
        full.push(e.longDescription.trim());
      } else if (e.description) {
        full.push(e.description.trim());
      }
      full.push("");
    }
  }
  full.push("---");
  full.push("");
}

full.push("Curated by Elliot Daemon (https://elliotdaemon.com)");
full.push("");

await writeFile(OUT_FULL, full.join("\n"));
console.log(`[llms-txt] Wrote ${OUT_FULL} (${full.length} lines, ~${(full.join("\n").length / 1024).toFixed(0)}KB)`);

function isLegendary(e) {
  return (e.rarity || "").includes("Legendary");
}
function isEstablished(e) {
  return (e.rarity || "").includes("Established");
}
