// Pulls Articles DB from Notion → serializes each Status=Ready article's
// blocks → emits public/articles.json. Runs as part of the build chain
// after fetch-content.mjs, so the slug-by-entry-id map is available for
// resolving inline tool refs.
//
// Article body model (v2 — rich):
//   { type: "p", segments: RichSegment[] }       paragraph (rich text)
//   { type: "h", level, segments }                heading 1/2/3
//   { type: "ul"|"ol", items: RichSegment[][] }   list (merged from consecutive items)
//   { type: "quote", segments }                   block quote
//   { type: "callout", emoji, segments }          tip/warning aside
//   { type: "code", language, text }              code block
//   { type: "table", headers, rows }              comparison table
//   { type: "img", url, caption?, alt? }          image figure
//   { type: "hr" }                                divider
//   { type: "tool", slug, name, description }     inline tool card embed
//
// RichSegment = { text: string; bold?: boolean; italic?: boolean;
//                 code?: boolean; link?: string }
//
// Tool refs:
//   - Notion `link_to_page` block pointing at a Library page → tool card
//   - Paragraph whose plain text matches /^::tool\[slug\]::$/ → tool card
//   - Paragraph containing `::tool[slug]::` inline → split into p/tool/p
//
// If NOTION_TOKEN is missing the script writes an empty articles.json.

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

// ---------- shared helpers ----------

const RESERVED_SLUGS = new Set([
  "_next", "api", "sw", "favicon", "favicon.ico", "icon", "icon.svg",
  "manifest", "manifest.json", "opengraph-image", "twitter-image",
  "robots", "robots.txt", "sitemap", "sitemap.xml",
  "category", "c", "tools", "tool", "tag", "tags",
  "legendary", "hidden-gems", "gems", "rare", "established", "featured",
  "articles", "article", "library", "browse", "blog", "post",
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

// Walk Notion rich_text into our RichSegment[] format, preserving the
// formatting annotations the renderer needs (bold / italic / code / link).
// Empty segments are dropped to keep payload tight.
function serializeRichText(rt) {
  if (!Array.isArray(rt)) return [];
  const out = [];
  for (const seg of rt) {
    const v = seg.plain_text ?? "";
    if (!v) continue;
    const piece = { text: v };
    if (seg.annotations?.bold) piece.bold = true;
    if (seg.annotations?.italic) piece.italic = true;
    if (seg.annotations?.code) piece.code = true;
    if (seg.href) piece.link = seg.href;
    out.push(piece);
  }
  return out;
}

function segmentsToPlainString(segments) {
  return segments.map((s) => s.text).join("");
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

const entryByNotionId = new Map();
for (const e of libraryEntries) {
  entryByNotionId.set(e.id, { slug: e.slug, name: e.name, description: e.description, pricing: e.pricing, type: e.type, rarity: e.rarity });
}
const entryBySlug = new Map();
for (const e of libraryEntries) {
  entryBySlug.set(e.slug, { id: e.id, slug: e.slug, name: e.name, description: e.description, pricing: e.pricing, type: e.type, rarity: e.rarity });
}

function toolBlockFor(slugOrEntry) {
  const entry = typeof slugOrEntry === "string" ? entryBySlug.get(slugOrEntry) : slugOrEntry;
  if (!entry) return null;
  return {
    type: "tool",
    slug: entry.slug,
    name: entry.name,
    description: entry.description ?? "",
    pricing: entry.pricing ?? "",
    rarity: entry.rarity ?? "",
  };
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

// Splits a paragraph's segments on `::tool[slug]::` markers. The marker
// must appear in plain (non-link) text. Returns a sequence of p / tool
// blocks. When no marker is present, returns the original paragraph.
function splitParagraphForToolRefs(segments) {
  const plain = segmentsToPlainString(segments);
  if (!plain.includes("::tool[")) {
    return segments.length > 0 ? [{ type: "p", segments }] : [];
  }
  const out = [];
  const re = /::tool\[([a-z0-9-]+)\]::/g;
  let cursor = 0; // index into plain string
  let m;
  // Build a "segment offset" map: which segment + offset each plain index lives in.
  const offsets = [];
  let acc = 0;
  for (const s of segments) {
    offsets.push({ start: acc, end: acc + s.text.length });
    acc += s.text.length;
  }
  function sliceSegments(from, to) {
    const result = [];
    if (from >= to) return result;
    for (let i = 0; i < segments.length; i++) {
      const { start, end } = offsets[i];
      if (end <= from || start >= to) continue;
      const s = segments[i];
      const sliceStart = Math.max(0, from - start);
      const sliceEnd = Math.min(s.text.length, to - start);
      const text = s.text.slice(sliceStart, sliceEnd);
      if (!text) continue;
      result.push({ ...s, text });
    }
    return result;
  }
  while ((m = re.exec(plain)) !== null) {
    const preceding = sliceSegments(cursor, m.index);
    const trimmedFirst = preceding.length > 0 && (preceding[0].text = preceding[0].text.replace(/^\s+/, "")) !== "" ? preceding : preceding.filter(s => s.text);
    const trimmedLast = trimmedFirst.length > 0 ? [...trimmedFirst.slice(0, -1), { ...trimmedFirst[trimmedFirst.length - 1], text: trimmedFirst[trimmedFirst.length - 1].text.replace(/\s+$/, "") }] : trimmedFirst;
    const cleaned = trimmedLast.filter((s) => s.text);
    if (cleaned.length > 0) out.push({ type: "p", segments: cleaned });
    const tool = toolBlockFor(m[1]);
    if (tool) out.push(tool);
    cursor = re.lastIndex;
  }
  const tailRaw = sliceSegments(cursor, plain.length);
  if (tailRaw.length > 0) {
    tailRaw[0].text = tailRaw[0].text.replace(/^\s+/, "");
    const lastIdx = tailRaw.length - 1;
    tailRaw[lastIdx].text = tailRaw[lastIdx].text.replace(/\s+$/, "");
    const cleaned = tailRaw.filter((s) => s.text);
    if (cleaned.length > 0) out.push({ type: "p", segments: cleaned });
  }
  return out;
}

async function blockToSerialized(block) {
  switch (block.type) {
    case "paragraph": {
      const segments = serializeRichText(block.paragraph.rich_text);
      return splitParagraphForToolRefs(segments);
    }
    case "heading_1":
      return [{ type: "h", level: 1, segments: serializeRichText(block.heading_1.rich_text) }];
    case "heading_2":
      return [{ type: "h", level: 2, segments: serializeRichText(block.heading_2.rich_text) }];
    case "heading_3":
      return [{ type: "h", level: 3, segments: serializeRichText(block.heading_3.rich_text) }];
    case "bulleted_list_item":
      return [{ type: "li", ordered: false, segments: serializeRichText(block.bulleted_list_item.rich_text) }];
    case "numbered_list_item":
      return [{ type: "li", ordered: true, segments: serializeRichText(block.numbered_list_item.rich_text) }];
    case "quote":
      return [{ type: "quote", segments: serializeRichText(block.quote.rich_text) }];
    case "divider":
      return [{ type: "hr" }];
    case "callout": {
      const emoji = block.callout.icon?.emoji ?? "💡";
      return [{ type: "callout", emoji, segments: serializeRichText(block.callout.rich_text) }];
    }
    case "code": {
      return [{
        type: "code",
        language: block.code.language ?? "",
        text: segmentsToPlainString(serializeRichText(block.code.rich_text)),
      }];
    }
    case "image": {
      // Notion image: either external URL or Notion-hosted (signed S3 URL,
      // expires in 1h). For Notion-hosted, store the URL — works until
      // the next rebuild which auto-refreshes the signature.
      const img = block.image;
      const url = img.type === "external" ? img.external.url : img.file?.url;
      const caption = serializeRichText(img.caption ?? []);
      if (!url) return [];
      return [{
        type: "img",
        url,
        caption: caption.length > 0 ? caption : undefined,
        alt: segmentsToPlainString(caption),
      }];
    }
    case "table": {
      // Notion table — children are table_row blocks. Fetch them.
      const rows = await fetchAllBlocks(block.id);
      const headers = block.table.has_column_header ?? false;
      const rowData = rows
        .filter((r) => r.type === "table_row")
        .map((r) => (r.table_row.cells ?? []).map((cell) => serializeRichText(cell)));
      if (rowData.length === 0) return [];
      return [{
        type: "table",
        headers: headers ? rowData[0] : null,
        rows: headers ? rowData.slice(1) : rowData,
      }];
    }
    case "link_to_page": {
      const id = block.link_to_page.page_id;
      const tool = toolBlockFor(entryByNotionId.get(id) ? { ...entryByNotionId.get(id) } : null);
      return tool ? [tool] : [];
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
        buffer.items.push(b.segments);
      } else {
        if (buffer) out.push(buffer);
        buffer = { type: wanted, items: [b.segments] };
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
  const flat = [];
  for (const b of rawBlocks) {
    const serialized = await blockToSerialized(b);
    flat.push(...serialized);
  }
  const body = mergeLists(flat);

  // Auto-estimate reading time from word count if not set
  const explicitReading = num(row.properties["Reading Time Minutes"]);
  function segWords(segs) {
    return segs ? segs.reduce((a, s) => a + (s.text?.split(/\s+/).filter(Boolean).length ?? 0), 0) : 0;
  }
  const wordCount = body.reduce((acc, b) => {
    if (b.type === "p" || b.type === "quote" || b.type === "h" || b.type === "callout") return acc + segWords(b.segments);
    if (b.type === "ul" || b.type === "ol") return acc + b.items.reduce((a, segs) => a + segWords(segs), 0);
    if (b.type === "code") return acc + (b.text?.split(/\s+/).filter(Boolean).length ?? 0);
    if (b.type === "table") return acc + b.rows.reduce((rAcc, r) => rAcc + r.reduce((cAcc, cell) => cAcc + segWords(cell), 0), 0);
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

articles.sort((a, b) => {
  const da = a.publishedDate || a.updatedDate || "";
  const db = b.publishedDate || b.updatedDate || "";
  return db.localeCompare(da);
});

const payload = { generatedAt: new Date().toISOString(), articles };

await mkdir(dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(payload, null, 2));
console.log(`[fetch-articles] ✓ Wrote ${OUTPUT} (${articles.length} articles)`);
