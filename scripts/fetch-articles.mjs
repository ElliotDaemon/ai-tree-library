// Pulls Articles DB from Notion → serializes each Status=Ready article's
// blocks → emits public/articles.json. Runs as part of the build chain
// after fetch-content.mjs, so the slug-by-entry-id map is available for
// resolving inline tool refs.
//
// Article body model — kept deliberately small for v1:
//   { type: "p", text }           paragraph
//   { type: "h", level, text }    heading (level 1 | 2 | 3)
//   { type: "ul", items }         bullet list (post-merged from consecutive items)
//   { type: "ol", items }         numbered list (post-merged)
//   { type: "quote", text }       block quote
//   { type: "hr" }                divider
//   { type: "tool", slug, name, description }  inline tool card embed
//
// Tool refs:
//   - Notion `link_to_page` block pointing at a Library page → tool card
//   - Paragraph containing literal `::tool[slug]::` → splits the paragraph
//     so the card interrupts the prose flow at exactly that point
//
// If NOTION_TOKEN is missing the script writes an empty articles.json
// (matches fetch-content.mjs's behavior — keeps local dev unblocked).

import { Client } from "@notionhq/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "public", "articles.json");
const LIBRARY_JSON = join(__dirname, "..", "public", "library.json");

const ARTICLES_DS = "be09af06-bca2-44b6-9d28-c61b084063e5";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("[fetch-articles] NOTION_TOKEN missing — writing empty articles.json");
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), articles: [] }, null, 2));
  process.exit(0);
}

const notion = new Client({ auth: token });

// ---------- shared helpers (lightweight duplicates of fetch-content.mjs) ----------

const RESERVED_SLUGS = new Set([
  "_next", "api", "sw", "favicon", "favicon.ico", "icon", "icon.svg",
  "manifest", "manifest.json", "opengraph-image", "twitter-image",
  "robots", "robots.txt", "sitemap", "sitemap.xml",
  "category", "c", "tools", "tool", "tag", "tags",
  "legendary", "hidden-gems", "gems", "rare", "established", "featured",
  "articles", "article", "blog", "post",
  "privacy", "terms", "about", "search", "submit", "portal", "admin", "dashboard",
  "llms", "llms.txt", "llms-full", "llms-full.txt",
  "", "index", "home", "404", "500",
]);

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_/]/g, "")
    .replace(/[\s_/]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueSlug(base, id, taken) {
  let candidate = base;
  if (!candidate || RESERVED_SLUGS.has(candidate)) {
    candidate = `${candidate || "x"}-${id.replace(/-/g, "").slice(-4)}`;
  }
  if (!taken.has(candidate)) { taken.add(candidate); return candidate; }
  const suffix = id.replace(/-/g, "").slice(-4);
  const withSuffix = `${candidate}-${suffix}`;
  if (!taken.has(withSuffix)) { taken.add(withSuffix); return withSuffix; }
  let n = 2;
  while (taken.has(`${withSuffix}-${n}`)) n++;
  const final = `${withSuffix}-${n}`;
  taken.add(final);
  return final;
}

function text(p) { if (!p) return ""; const arr = p.title ?? p.rich_text ?? []; return arr.map((t) => t.plain_text).join(""); }
function sel(p) { return p?.select?.name ?? ""; }
function multi(p) { return (p?.multi_select ?? []).map((t) => t.name); }
function num(p) { return p?.number ?? null; }

function richTextToString(rt) {
  if (!Array.isArray(rt)) return "";
  return rt.map((t) => t.plain_text ?? "").join("");
}

// ---------- load Library so we can resolve tool refs ----------

let libraryEntries = [];
try {
  const raw = await readFile(LIBRARY_JSON, "utf8");
  const lib = JSON.parse(raw);
  libraryEntries = lib.entries ?? [];
} catch {
  console.warn("[fetch-articles] No library.json yet — tool refs won't resolve");
}

// Map Notion page id → { slug, name, description } for fast inline lookup
const entryByNotionId = new Map();
for (const e of libraryEntries) {
  entryByNotionId.set(e.id, { slug: e.slug, name: e.name, description: e.description });
}
// Also build slug → entry so `::tool[slug]::` refs work
const entryBySlug = new Map();
for (const e of libraryEntries) {
  entryBySlug.set(e.slug, { id: e.id, slug: e.slug, name: e.name, description: e.description });
}

// ---------- Article fetching ----------

async function fetchAll(dsId, filter) {
  const all = [];
  let cursor;
  do {
    const res = await notion.databases.query({ database_id: dsId, start_cursor: cursor, page_size: 100, filter });
    for (const r of res.results) if ("properties" in r) all.push({ id: r.id, properties: r.properties });
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

async function fetchAllBlocks(pageId) {
  const all = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
    for (const b of res.results) all.push(b);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

// Splits a paragraph string on `::tool[slug]::` markers, emitting a
// sequence of {type:"p"} and {type:"tool"} blocks so each card interrupts
// the prose where the author placed the marker.
function splitParagraphForToolRefs(textStr) {
  if (!textStr.includes("::tool[")) {
    return textStr.trim() ? [{ type: "p", text: textStr }] : [];
  }
  const out = [];
  const re = /::tool\[([a-z0-9-]+)\]::/g;
  let lastIdx = 0;
  let m;
  while ((m = re.exec(textStr)) !== null) {
    const preceding = textStr.slice(lastIdx, m.index).trim();
    if (preceding) out.push({ type: "p", text: preceding });
    const slug = m[1];
    const entry = entryBySlug.get(slug);
    if (entry) {
      out.push({ type: "tool", slug: entry.slug, name: entry.name, description: entry.description });
    }
    lastIdx = re.lastIndex;
  }
  const tail = textStr.slice(lastIdx).trim();
  if (tail) out.push({ type: "p", text: tail });
  return out;
}

function blockToSerialized(block) {
  switch (block.type) {
    case "paragraph":
      return splitParagraphForToolRefs(richTextToString(block.paragraph.rich_text));
    case "heading_1":
      return [{ type: "h", level: 1, text: richTextToString(block.heading_1.rich_text) }];
    case "heading_2":
      return [{ type: "h", level: 2, text: richTextToString(block.heading_2.rich_text) }];
    case "heading_3":
      return [{ type: "h", level: 3, text: richTextToString(block.heading_3.rich_text) }];
    case "bulleted_list_item":
      return [{ type: "li", ordered: false, text: richTextToString(block.bulleted_list_item.rich_text) }];
    case "numbered_list_item":
      return [{ type: "li", ordered: true, text: richTextToString(block.numbered_list_item.rich_text) }];
    case "quote":
      return [{ type: "quote", text: richTextToString(block.quote.rich_text) }];
    case "divider":
      return [{ type: "hr" }];
    case "link_to_page": {
      const id = block.link_to_page.page_id;
      const entry = entryByNotionId.get(id);
      if (entry) {
        return [{ type: "tool", slug: entry.slug, name: entry.name, description: entry.description }];
      }
      return [];
    }
    default:
      return [];
  }
}

// Merge consecutive `li` blocks into a single `ul` / `ol` block
function mergeLists(blocks) {
  const out = [];
  let buffer = null;
  for (const b of blocks) {
    if (b.type === "li") {
      const wanted = b.ordered ? "ol" : "ul";
      if (buffer && buffer.type === wanted) {
        buffer.items.push(b.text);
      } else {
        if (buffer) out.push(buffer);
        buffer = { type: wanted, items: [b.text] };
      }
    } else {
      if (buffer) { out.push(buffer); buffer = null; }
      out.push(b);
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

// ---------- main ----------

console.log("[fetch-articles] Fetching Articles DB (Status=Ready)...");
let rows = [];
try {
  rows = await fetchAll(ARTICLES_DS, { property: "Status", select: { equals: "Ready" } });
} catch (e) {
  console.warn(`[fetch-articles] Query failed: ${e?.message || e}`);
  console.warn("[fetch-articles] Writing empty articles.json (DB may not exist or integration lacks access)");
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), articles: [] }, null, 2));
  process.exit(0);
}
console.log(`[fetch-articles] ${rows.length} Ready articles`);

const articles = [];
const takenSlugs = new Set();

for (const row of rows) {
  const title = text(row.properties.Title);
  if (!title) continue;

  const slugOverride = text(row.properties.Slug);
  const baseSlug = slugify(slugOverride) || slugify(title);
  const slug = uniqueSlug(baseSlug || "article", row.id, takenSlugs);

  console.log(`[fetch-articles] ${slug} — fetching blocks...`);
  const rawBlocks = await fetchAllBlocks(row.id);
  const flat = rawBlocks.flatMap((b) => blockToSerialized(b));
  const body = mergeLists(flat);

  // Auto-estimate reading time from word count if not set
  const explicitReading = num(row.properties["Reading Time Minutes"]);
  const wordCount = body.reduce((acc, b) => {
    if (b.type === "p" || b.type === "quote" || b.type === "h") return acc + (b.text?.split(/\s+/).length ?? 0);
    if (b.type === "ul" || b.type === "ol") return acc + b.items.reduce((a, t) => a + t.split(/\s+/).length, 0);
    return acc;
  }, 0);
  const readingTimeMinutes = explicitReading ?? Math.max(1, Math.round(wordCount / 220));

  articles.push({
    id: row.id,
    title,
    slug,
    author: text(row.properties.Author) || "Elliot Daemon",
    status: sel(row.properties.Status),
    publishedDate: row.properties["Published Date"]?.date?.start || null,
    updatedDate: row.properties["Updated Date"]?.date?.start || null,
    excerpt: text(row.properties.Excerpt),
    coverTint: sel(row.properties["Cover Tint"]) || "cyan",
    tags: multi(row.properties.Tags),
    featuredToolIds: (row.properties["Featured Tools"]?.relation ?? []).map((r) => r.id),
    readingTimeMinutes,
    wordCount,
    body,
  });
}

// Sort newest first
articles.sort((a, b) => {
  const da = a.publishedDate || a.updatedDate || "";
  const db = b.publishedDate || b.updatedDate || "";
  return db.localeCompare(da);
});

const payload = { generatedAt: new Date().toISOString(), articles };

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(payload, null, 2));
console.log(`[fetch-articles] ✓ Wrote ${OUTPUT} (${articles.length} articles)`);
