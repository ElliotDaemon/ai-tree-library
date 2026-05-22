// Build-time content fetch.
// Faithful adaptation of the Neural Arbor (Gemini) tree distribution.
//
// Core insight from the reference: the tree silhouette is created by ~3000
// background "dust" particles using a Y → radius mapping with density bias.
// Real data (categories / subcategories / entries) is just BRIGHTER and
// LARGER points sprinkled into the same distribution. The dust gives volume;
// the bright points carry the data.
//
// Result: looks like a tree at any data density, every clickable/hoverable
// node is a real Notion entry, dust never intercepts clicks.

import { Client } from "@notionhq/client";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "public", "library.json");

const LIBRARY_DS = "63c6ed32-e30a-454f-9f66-dc353aeb54c6";
const CATEGORIES_DS = "0f31f74d-5899-4402-a863-5725927d96cd";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("[fetch-content] NOTION_TOKEN missing — skipping fetch, writing empty library.json");
  await ensureDir(dirname(OUTPUT));
  await writeFile(OUTPUT, JSON.stringify(emptyPayload(), null, 2));
  process.exit(0);
}

const notion = new Client({ auth: token });

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

function text(p) { if (!p) return ""; const arr = p.title ?? p.rich_text ?? []; return arr.map((t) => t.plain_text).join(""); }
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
const libRows = await fetchAll(LIBRARY_DS, { property: "Status", select: { equals: "Ready" } });
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
  rarity: sel(p.properties.Rarity),
  logoUrl: url(p.properties["Logo URL"]),
  screenshotUrl: url(p.properties["Screenshot URL"]),
  source: text(p.properties.Source),
}));
console.log(`[fetch-content] Entries: ${entries.length}`);

function rarityKey(entry) {
  if (entry.rarity) {
    if (entry.rarity.includes("Legendary")) return "legendary";
    if (entry.rarity.includes("Established")) return "established";
    if (entry.rarity.includes("Rare")) return "rare";
    if (entry.rarity.includes("Hidden Gem")) return "gem";
  }
  if (entry.featured && entry.gem) return "established";
  if (entry.featured) return "legendary";
  if (entry.gem) return "rare";
  return "established";
}

// ===== Tree silhouette — Gemini reference, unmodified =====
function treeRadius(y) {
  if (y < -45) return 8 + Math.pow(-45 - y, 1.4) * 1.2;
  if (y < 10) return Math.max(2, 6 - (y + 45) * 0.05);
  if (y < 55) return 3 + Math.pow(y - 10, 1.2) * 1.1;
  const maxR = 3 + Math.pow(45, 1.2) * 1.1;
  const t = (y - 55) * Math.PI / 40;
  return Math.max(0.1, maxR * Math.cos(t));
}

// Deterministic PRNG so the tree is reproducible across builds.
let seedState = 0x9e3779b1;
function rnd() { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 0x100000000; }

// Single point sampler — the heart of the Gemini layout. Used for dust AND
// for every real node, so dust + real-data points share the exact same
// distribution and the tree silhouette holds.
function samplePoint() {
  const y = rnd() * 140 - 65; // -65 .. 75
  let r = treeRadius(y);
  r = r * Math.pow(rnd(), 0.6); // density bias toward central axis
  const theta = rnd() * Math.PI * 2;
  const noise = 5;
  return [
    r * Math.cos(theta) + (rnd() - 0.5) * noise,
    y + (rnd() - 0.5) * noise,
    r * Math.sin(theta) + (rnd() - 0.5) * noise,
  ];
}

// Height gradient color — Gemini reference. Purple roots → cyan trunk → pink canopy.
const COLOR_ROOTS = [0x70 / 255, 0, 1.0];     // #7000ff
const COLOR_TRUNK = [0, 0xf3 / 255, 1.0];     // #00f3ff
const COLOR_CANOPY = [1.0, 0, 0xaa / 255];    // #ff00aa
function gradientColor(y) {
  let c;
  if (y < -10) {
    const t = clamp((y + 65) / 55, 0, 1);
    c = mixRgb(COLOR_ROOTS, COLOR_TRUNK, t);
  } else {
    const t = clamp((y + 10) / 85, 0, 1);
    c = mixRgb(COLOR_TRUNK, COLOR_CANOPY, t);
  }
  // Gemini's HSL jitter — small hue/saturation wiggle so dust feels organic
  const jitter = (rnd() - 0.5) * 0.12;
  return [
    clamp(c[0] + jitter * 0.4, 0, 1),
    clamp(c[1] + jitter * 0.1, 0, 1),
    clamp(c[2] + jitter * 0.4, 0, 1),
  ];
}
function mixRgb(a, b, t) { t = clamp(t, 0, 1); return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function hexToRgb(hex) { const h = hex.replace("#", ""); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }
function boost(rgb, f) { return [Math.min(1, rgb[0] * f), Math.min(1, rgb[1] * f), Math.min(1, rgb[2] * f)]; }

// ===== Build the dataset =====
const topLevel = categories.filter((c) => c.isTopLevel).sort((a, b) => a.displayOrder - b.displayOrder);
const subsByParent = new Map();
for (const sub of categories.filter((c) => !c.isTopLevel)) {
  if (!subsByParent.has(sub.parentName)) subsByParent.set(sub.parentName, []);
  subsByParent.get(sub.parentName).push(sub);
}

const nodes = [];
const links = [];

// Logical trunk root (invisible, anchor for backbone links).
const TRUNK_ID = "__trunk__";
nodes.push({ id: TRUNK_ID, kind: "trunk", name: "AI Tree Library", color: [1, 1, 1], position: [0, -45, 0], size: 4 });

// 1) Categories — bright, large, randomly placed via samplePoint().
// Color: category color blended with the height gradient at that point.
const catNodeByDataId = new Map();
for (const cat of topLevel) {
  const pos = samplePoint();
  const baseColor = mixRgb(gradientColor(pos[1]), hexToRgb(cat.color), 0.6);
  const node = {
    id: cat.id,
    kind: "category",
    name: cat.name,
    color: boost(baseColor, 1.55),
    rawColor: cat.color,
    position: pos,
    size: 6.5,
  };
  nodes.push(node);
  catNodeByDataId.set(cat.id, node);
  links.push({ source: TRUNK_ID, target: cat.id, kind: "backbone" });
}

// 2) Subcategories — medium-bright, also randomly placed.
const subNodeByDataId = new Map();
for (const parent of topLevel) {
  const subs = (subsByParent.get(parent.name) || []).sort((a, b) => a.displayOrder - b.displayOrder);
  for (const sub of subs) {
    const pos = samplePoint();
    const baseColor = mixRgb(gradientColor(pos[1]), hexToRgb(parent.color), 0.55);
    const node = {
      id: sub.id,
      kind: "subcategory",
      name: sub.name,
      color: boost(baseColor, 1.4),
      rawColor: parent.color,
      position: pos,
      size: 4.5,
      parentId: parent.id,
    };
    nodes.push(node);
    subNodeByDataId.set(sub.id, node);
    links.push({ source: parent.id, target: sub.id, kind: "backbone" });
  }
}

// 3) Entries — bright stars (tier-sized) sprinkled into the same distribution.
const entriesBySubcat = new Map();
const entryNodeByDataId = new Map();
for (const entry of entries) {
  if (!entry.categoryId) continue;
  const sub = categories.find((c) => c.id === entry.categoryId);
  if (!sub) continue;
  const parent = topLevel.find((c) => c.name === sub.parentName);

  const pos = samplePoint();
  const parentRgb = parent ? hexToRgb(parent.color) : [0.6, 0.6, 0.6];
  const baseColor = mixRgb(gradientColor(pos[1]), parentRgb, 0.45);
  const tier = rarityKey(entry);

  // Sizing per rarity. Slight density-adaptive bump when total entries are
  // low so the tree still has visible bright stars.
  // Brightness boost intentionally low — Gemini uses ~1.5x on all prominent
  // particles. Higher boosts make real nodes feel "stuck on top of" the dust
  // instead of being part of the same field.
  const baseSizeByTier = { legendary: 5.5, established: 3.6, rare: 3.0, gem: 2.4 };
  const densityScale = entries.length < 80 ? 1.25 : entries.length < 250 ? 1.1 : 1.0;
  const boostByTier = { legendary: 1.5, established: 1.3, rare: 1.25, gem: 1.35 };

  const node = {
    id: entry.id,
    kind: "entry",
    name: entry.name,
    color: boost(baseColor, boostByTier[tier]),
    rawColor: parent ? parent.color : "#888",
    position: pos,
    size: baseSizeByTier[tier] * densityScale,
    featured: entry.featured,
    gem: entry.gem,
    rarity: tier,
    parentId: entry.categoryId,
    tags: entry.tags,
  };
  nodes.push(node);
  entryNodeByDataId.set(entry.id, node);

  const cluster = entriesBySubcat.get(entry.categoryId) || [];
  cluster.push(node);
  entriesBySubcat.set(entry.categoryId, cluster);
  links.push({ source: entry.categoryId, target: entry.id, kind: "backbone" });
}

// 4) Dust particles — the tree's body. Pure visual mass, no data, no clicks.
// Target total ~3500 particles like Gemini; dust fills whatever real-node count
// leaves room for.
const realCount = nodes.length - 1; // minus trunk
const DUST_COUNT = Math.max(2500, 3500 - realCount);
for (let i = 0; i < DUST_COUNT; i++) {
  const pos = samplePoint();
  const color = gradientColor(pos[1]);
  nodes.push({
    id: `__dust_${i}__`,
    kind: "filler",
    color,
    position: pos,
    size: rnd() * 1.5 + 0.8, // Gemini's small dust size range
  });
}

// 5) PLEXUS WEB — proximity lines between ALL particles (including dust).
// This is THE key visual element from Gemini. Without it, dust is just
// floating dots; with it, the tree becomes a glowing interconnected web.
// O(n²) is ~12M pair checks for 3500 particles — fine at build time.
const MAX_CONN = 4;
const MAX_DIST_SQ = 9 * 9;
const connCount = new Array(nodes.length).fill(0);
// Skip trunk (anchor only, position is far below)
for (let i = 1; i < nodes.length; i++) {
  if (connCount[i] >= MAX_CONN) continue;
  for (let j = i + 1; j < nodes.length; j++) {
    if (connCount[i] >= MAX_CONN) break;
    if (connCount[j] >= MAX_CONN) continue;
    const a = nodes[i].position;
    const b = nodes[j].position;
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < MAX_DIST_SQ) {
      links.push({ source: nodes[i].id, target: nodes[j].id, kind: "plexus" });
      connCount[i]++;
      connCount[j]++;
    }
  }
}

console.log(`[fetch-content] Nodes: ${nodes.length} (real: ${realCount}, dust: ${DUST_COUNT})`);
const linkKinds = links.reduce((m, l) => { m[l.kind] = (m[l.kind] || 0) + 1; return m; }, {});
console.log(`[fetch-content] Links: ${links.length} (${Object.entries(linkKinds).map(([k, n]) => `${k}=${n}`).join(", ")})`);

function emptyPayload() {
  return { generatedAt: new Date().toISOString(), stats: { categories: 0, topLevel: 0, entries: 0, featured: 0, gems: 0 }, categories: [], entries: [], layout: { nodes: [], links: [] } };
}

async function ensureDir(dir) { await mkdir(dir, { recursive: true }); }

await ensureDir(dirname(OUTPUT));

const positionedNodes = nodes.map((n) => ({
  id: n.id,
  kind: n.kind,
  name: n.name,
  rarity: n.rarity ?? null,
  color: n.color,
  rawColor: n.rawColor ?? null,
  featured: n.featured ?? false,
  gem: n.gem ?? false,
  parentId: n.parentId ?? null,
  position: [Number(n.position[0].toFixed(3)), Number(n.position[1].toFixed(3)), Number(n.position[2].toFixed(3))],
  size: Number((n.size ?? 1).toFixed(3)),
}));

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
  layout: { nodes: positionedNodes, links },
};

await writeFile(OUTPUT, JSON.stringify(payload, null, 2));
console.log(`[fetch-content] ✓ Wrote ${OUTPUT}`);
console.log(`[fetch-content] Stats:`, payload.stats);
