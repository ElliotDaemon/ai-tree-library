// One-off enrichment script — runs locally with your tokens.
// For each Library entry where `LongDescription` is empty, scrape the URL,
// call Claude Haiku 4.5, write a 200-400 word factual description back to
// Notion. Idempotent; resumable.
//
// Usage:
//   NOTION_TOKEN=ntn_... ANTHROPIC_API_KEY=sk-... npm run enrich
//   NOTION_TOKEN=... ANTHROPIC_API_KEY=... npm run enrich -- --max 50
//   NOTION_TOKEN=... ANTHROPIC_API_KEY=... npm run enrich -- --force

import { Client } from "@notionhq/client";

const LIBRARY_DS = "63c6ed32-e30a-454f-9f66-dc353aeb54c6";
const CATEGORIES_DS = "0f31f74d-5899-4402-a863-5725927d96cd";

const MAX_FLAG = process.argv.find((a) => a.startsWith("--max"));
const MAX = MAX_FLAG ? parseInt(MAX_FLAG.split("=")[1] || process.argv[process.argv.indexOf(MAX_FLAG) + 1]) : 25;
const FORCE = process.argv.includes("--force");

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!NOTION_TOKEN) { console.error("Set NOTION_TOKEN"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("Set ANTHROPIC_API_KEY"); process.exit(1); }

const notion = new Client({ auth: NOTION_TOKEN });

function text(p) { if (!p) return ""; const arr = p.title ?? p.rich_text ?? []; return arr.map((t) => t.plain_text).join(""); }
function sel(p) { return p?.select?.name ?? ""; }
function multi(p) { return (p?.multi_select ?? []).map((t) => t.name); }
function url(p) { return p?.url ?? ""; }
function rel(p) { return p?.relation?.[0]?.id ?? null; }

console.log("[enrich] Fetching category names...");
const catRes = await notion.databases.query({
  database_id: CATEGORIES_DS,
  filter: { property: "Is Top Level", checkbox: { equals: true } },
  page_size: 100,
});
const catNameById = new Map();
const topLevelCats = [];
for (const r of catRes.results) {
  const n = text(r.properties.Name);
  if (n) { catNameById.set(r.id, n); topLevelCats.push(n); }
}
// Sub → top mapping
const subRes = await notion.databases.query({
  database_id: CATEGORIES_DS,
  filter: { property: "Is Top Level", checkbox: { equals: false } },
  page_size: 200,
});
const topLevelBySubId = new Map();
for (const r of subRes.results) {
  const parent = text(r.properties.Parent);
  topLevelBySubId.set(r.id, parent);
}

console.log(`[enrich] ${topLevelCats.length} top-level cats: ${topLevelCats.join(", ")}`);

// Pull Library entries (paginated) — only Status=Ready
console.log("[enrich] Fetching Library entries (Status=Ready)...");
const entries = [];
let cursor;
do {
  const res = await notion.databases.query({
    database_id: LIBRARY_DS,
    filter: { property: "Status", select: { equals: "Ready" } },
    start_cursor: cursor,
    page_size: 100,
  });
  for (const r of res.results) {
    entries.push({
      id: r.id,
      name: text(r.properties.Name),
      url: url(r.properties.URL),
      description: text(r.properties.Description),
      longDescription: text(r.properties["LongDescription"]),
      categoryId: rel(r.properties.Category),
      tags: multi(r.properties.Tags),
      pricing: sel(r.properties.Pricing) || "Unknown",
      rarity: sel(r.properties.Rarity),
      type: sel(r.properties.Type) || "Tool",
    });
  }
  cursor = res.has_more ? res.next_cursor : undefined;
} while (cursor);

console.log(`[enrich] Total entries: ${entries.length}`);

const candidates = entries.filter((e) => {
  if (!e.url) return false;
  if (!FORCE && e.longDescription && e.longDescription.length > 100) return false;
  return true;
});
console.log(`[enrich] Candidates (missing LongDescription${FORCE ? " or --force" : ""}): ${candidates.length}`);
console.log(`[enrich] Will process up to ${MAX} in this run.`);

let processed = 0;
let succeeded = 0;
let failed = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;

for (const entry of candidates.slice(0, MAX)) {
  processed++;
  const topLevelName = entry.categoryId ? topLevelBySubId.get(entry.categoryId) ?? "" : "";
  process.stdout.write(`[${processed}/${Math.min(MAX, candidates.length)}] ${entry.name.padEnd(36)} `);

  try {
    const pageText = await fetchPageText(entry.url);
    const result = await callClaude(entry, topLevelName, pageText);
    if (!result) {
      console.log("✗ classify returned null");
      failed++;
      continue;
    }
    totalInputTokens += result.usage?.input_tokens ?? 0;
    totalOutputTokens += result.usage?.output_tokens ?? 0;

    await notion.pages.update({
      page_id: entry.id,
      properties: {
        LongDescription: { rich_text: [{ text: { content: result.text.slice(0, 1990) } }] },
        "LongDescription Generated At": { date: { start: new Date().toISOString() } },
      },
    });
    succeeded++;
    console.log(`✓ ${result.text.length} chars`);

    // Stay under Anthropic rate limits — small breathing room
    await new Promise((r) => setTimeout(r, 350));
  } catch (e) {
    failed++;
    console.log(`✗ ${e?.message || e}`);
  }
}

console.log("\n[enrich] Done.");
console.log(`  Processed: ${processed}`);
console.log(`  Succeeded: ${succeeded}`);
console.log(`  Failed:    ${failed}`);
console.log(`  Tokens in: ${totalInputTokens.toLocaleString()}`);
console.log(`  Tokens out:${totalOutputTokens.toLocaleString()}`);
// Haiku 4.5: ~$1/M input, ~$5/M output (estimate; check current pricing)
const cost = (totalInputTokens / 1e6) * 1 + (totalOutputTokens / 1e6) * 5;
console.log(`  Est. cost: $${cost.toFixed(4)}`);
if (candidates.length > MAX) {
  console.log(`\n  ${candidates.length - MAX} candidates remain — re-run with --max ${candidates.length - MAX} to finish.`);
}

async function fetchPageText(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "AITreeLibraryBot/1.0 (+https://aitreelibrary.com)" },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return "";
    const buf = await res.text();
    // Strip HTML tags + collapse whitespace for token efficiency
    return buf
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 6000);
  } catch {
    return "";
  }
}

async function callClaude(entry, topLevelName, pageText) {
  const system = `You write factual, citable descriptions of tools/websites for the AI Tree Library — a 3D curated catalog.

Return ONLY the description text, no preamble, no markdown headers, no quotes around it.

Style:
- 200-400 words, 2-3 paragraphs separated by blank lines
- First sentence is definitional: "X is a Y that does Z, made by W."
- Stick to facts: capabilities, who uses it, integrations, pricing model
- One sentence near the end naming 2-3 similar/competing tools
- No marketing fluff, no "revolutionary", no "game-changing", no "powerful"
- Active voice, present tense
- Don't repeat the tool name more than 4 times

Goals: maximize SEO ranking (Google needs ~250+ words of substantive content) AND maximize LLM citation (Claude/Perplexity prefer clear, definitional, fact-dense writing).`;

  const userPrompt = `Tool: ${entry.name}
URL: ${entry.url}
Category: ${topLevelName || "uncategorized"}
Type: ${entry.type}
Pricing: ${entry.pricing}
Tags: ${entry.tags.join(", ") || "(none)"}
Short description: ${entry.description || "(none)"}

Page excerpt (after HTML stripping, up to 6KB):
${pageText || "(no page text available — describe from your training knowledge of the URL/name)"}

Write the 200-400 word description now.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1100,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.content?.[0]?.text?.trim() ?? "";
  if (!text || text.length < 80) throw new Error("response too short");
  return { text, usage: data.usage };
}
