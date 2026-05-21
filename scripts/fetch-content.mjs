// Build-time content fetch.
// Runs `npm run build` BEFORE `next build`.
//
// Fetches all Status=Ready rows from Notion Library + entire Categories DB,
// runs d3-force-3d to bake 3D positions, and writes /public/library.json.
//
// Reads NOTION_TOKEN from env. In Vercel, set this on the project settings.
// For local dev, create site/.env.local with: NOTION_TOKEN=secret_xxx

import { Client } from "@notionhq/client";
import { forceSimulation, forceManyBody, forceLink, forceCenter } from "d3-force-3d";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "public", "library.json");

const LIBRARY_DS = "695ea981-738e-42bf-bec6-43ffd530d89c";
const CATEGORIES_DS = "6e793850-a435-4b4f-8b02-9d4de4d48be5";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("[fetch-content] NOTION_TOKEN missing — skipping fetch, writing empty library.json");
  await ensureDir(dirname(OUTPUT));
  await writeFile(OUTPUT, JSON.stringify({ entries: [], categories: [], generatedAt: new Date().toISOString() }, null, 2));
  process.exit(0);
}

const notion = new Client({ auth: token });

async function fetchAll(dsId, filter) {
  const all = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: dsId,
      start_cursor: cursor,
      page_size: 100,
      filter,
    });
    for (const r of res.results) {
      if ("properties" in r) all.push({ id: r.id, properties: r.properties });
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return all;
}

function text(p) {
  if (!p) return "";
  const arr = p.title ?? p.rich_text ?? [];
  return arr.map((t) => t.plain_text).join("");
}
function sel(p) { return p?.select?.name ?? ""; }
function multi(p) { return (p?.multi_select ?? []).map((t) => t.name); }
function cb(p) { return p?.checkbox ?? false; }
function num(p) { return p?.number ?? null; }
function url(p) { return p?.url ?? ""; }
function rel(p) { return p?.relation?.[0]?.id ?? null; }

console.log("[fetch-content] Fetching Categories...");
const catRows = await fetchAll(CATEGORIES_DS);
const categories = catRows.map((p) => ({
  id: p.id,
  name: text(p.properties.Name),
  slug: text(p.properties.Slug),
  color: text(p.properties.Color) || "#888",
  parentName: text(p.properties.Parent),
  isTopLevel: cb(p.properties["Is Top Level"]),
  displayOrder: num(p.properties["Display Order"]) ?? 999,
  v1ToolCount: num(p.properties["V1 Tool Count"]) ?? 0,
}));
console.log(`[fetch-content] Categories: ${categories.length} (${categories.filter(c => c.isTopLevel).length} top-level)`);

console.log("[fetch-content] Fetching Library (Status=Ready)...");
const libRows = await fetchAll(LIBRARY_DS, {
  property: "Status",
  select: { equals: "Ready" },
});
const entries = libRows.map((p) => ({
  id: p.id,
  name: text(p.properties.Name),
  url: url(p.properties.URL),
  type: sel(p.properties.Type) || "Tool",
  description: text(p.properties.Description),
  categoryId: rel(p.properties.Category),
  tags: multi(p.properties.Tags),
  pricing: sel(p.properties.Pricing) || "Unknown",
  featured: cb(p.properties.Featured),
  gem: cb(p.properties.Gem),
  logoUrl: url(p.properties["Logo URL"]),
  screenshotUrl: url(p.properties["Screenshot URL"]),
  source: text(p.properties.Source),
}));
console.log(`[fetch-content] Entries: ${entries.length} (${entries.filter(e => e.featured).length} featured, ${entries.filter(e => e.gem).length} gems)`);

// --- 3D layout via d3-force-3d ---
// Build nodes (trunk, categories, subcategories, entries) and links between them.
// d3-force-3d returns x/y/z coordinates after simulation runs.

const TRUNK_ID = "__trunk__";
const nodes = [];
const links = [];

nodes.push({ id: TRUNK_ID, kind: "trunk", color: "#FFFFFF" });

const catById = new Map(categories.map((c) => [c.id, c]));
const topByName = new Map(categories.filter((c) => c.isTopLevel).map((c) => [c.name, c]));

// Top-level cats: anchor them at a fixed radius around the trunk
const topLevel = categories.filter((c) => c.isTopLevel).sort((a, b) => a.displayOrder - b.displayOrder);
topLevel.forEach((cat, i) => {
  const angle = (i / topLevel.length) * Math.PI * 2;
  const RADIUS = 120;
  const HEIGHT = (i - topLevel.length / 2) * 20;
  nodes.push({
    id: cat.id,
    kind: "category",
    name: cat.name,
    color: cat.color,
    // pinned positions for top-level so the structure stays organized
    fx: Math.cos(angle) * RADIUS,
    fy: HEIGHT,
    fz: Math.sin(angle) * RADIUS,
  });
  links.push({ source: TRUNK_ID, target: cat.id, kind: "trunk-cat" });
});

// Subcategories: free-floating, attracted to their parent
const subcats = categories.filter((c) => !c.isTopLevel);
subcats.forEach((sub) => {
  const parent = topByName.get(sub.parentName);
  if (!parent) return;
  nodes.push({
    id: sub.id,
    kind: "subcategory",
    name: sub.name,
    color: sub.color,
    parentId: parent.id,
  });
  links.push({ source: parent.id, target: sub.id, kind: "cat-subcat", strength: 0.5 });
});

// Tool entries: attracted to their category (which is the subcategory's id)
entries.forEach((entry) => {
  if (!entry.categoryId) return;
  nodes.push({
    id: entry.id,
    kind: "entry",
    name: entry.name,
    color: catById.get(entry.categoryId)?.color ?? "#888",
    parentId: entry.categoryId,
    featured: entry.featured,
    gem: entry.gem,
  });
  links.push({ source: entry.categoryId, target: entry.id, kind: "subcat-tool", strength: 0.3 });
});

console.log(`[fetch-content] Layout nodes: ${nodes.length}, links: ${links.length}`);
console.log("[fetch-content] Running d3-force-3d simulation...");

const sim = forceSimulation(nodes, 3)
  .force("link", forceLink(links).id((d) => d.id).distance((l) => l.kind === "trunk-cat" ? 80 : l.kind === "cat-subcat" ? 35 : 18).strength((l) => l.strength ?? 1))
  .force("charge", forceManyBody().strength(-12))
  .force("center", forceCenter(0, 0, 0))
  .stop();

const ITERATIONS = 200;
for (let i = 0; i < ITERATIONS; i++) sim.tick();

const positionedNodes = nodes.map((n) => ({
  id: n.id,
  kind: n.kind,
  name: n.name,
  color: n.color,
  featured: n.featured ?? false,
  gem: n.gem ?? false,
  parentId: n.parentId ?? null,
  position: [
    Number((n.x ?? 0).toFixed(3)),
    Number((n.y ?? 0).toFixed(3)),
    Number((n.z ?? 0).toFixed(3)),
  ],
}));

const positionedLinks = links.map((l) => ({
  source: typeof l.source === "object" ? l.source.id : l.source,
  target: typeof l.target === "object" ? l.target.id : l.target,
  kind: l.kind,
}));

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

await ensureDir(dirname(OUTPUT));

const payload = {
  generatedAt: new Date().toISOString(),
  stats: {
    categories: categories.length,
    topLevel: topLevel.length,
    entries: entries.length,
    featured: entries.filter((e) => e.featured).length,
    gems: entries.filter((e) => e.gem).length,
  },
  categories,
  entries,
  layout: {
    nodes: positionedNodes,
    links: positionedLinks,
  },
};

await writeFile(OUTPUT, JSON.stringify(payload, null, 2));
console.log(`[fetch-content] ✓ Wrote ${OUTPUT}`);
console.log(`[fetch-content] Stats:`, payload.stats);
