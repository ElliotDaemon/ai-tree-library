// Build-time content fetch.
// Pulls Library (Status=Ready) + Categories from Notion, builds a
// PURE-DATA tree layout (no filler particles), and writes /public/library.json.
//
// Layout invariants:
//   - Every rendered node is a real entry or category. Zero placeholders.
//   - The tree silhouette is enforced by treeRadius(y) — works at any density.
//   - 18 top-level categories each own an angular wedge. Sparse wedges fan out
//     wider so the tree never looks lopsided.
//
// Connection logic (3 kinds of lines, each with different visual weight):
//   1. backbone   — trunk → category → subcategory → entry  (strongest)
//   2. cluster    — within a subcategory, each entry → its K nearest siblings
//                   (forms constellation-shaped clusters of stars)
//   3. tag-bridge — entries sharing 2+ tags, faintest, limited per node
//                   (creates cross-cluster threads)

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
    const res = await notion.databases.query({
      database_id: dsId,
      start_cursor: cursor,
      page_size: 100,
      filter,
    });
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

// Auto-assign rarity (V1 backfill from featured/gem flags)
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

// --- Tree silhouette ---
function treeRadius(y) {
  if (y < -45) return 8 + Math.pow(-45 - y, 1.4) * 1.2;
  if (y < 10) return Math.max(2, 6 - (y + 45) * 0.05);
  if (y < 55) return 3 + Math.pow(y - 10, 1.2) * 1.1;
  const maxR = 3 + Math.pow(45, 1.2) * 1.1;
  const t = (y - 55) * Math.PI / 40;
  return Math.max(0.1, maxR * Math.cos(t));
}

// Deterministic PRNG (so the tree layout is reproducible across builds)
let seedState = 0x9e3779b1;
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 0x100000000;
}
function rndRange(a, b) { return a + (b - a) * rnd(); }

// Height gradient (purple roots → cyan trunk → pink canopy), blended with category color.
const COLOR_ROOTS = [0x70 / 255, 0, 1.0];
const COLOR_TRUNK = [0, 0xf3 / 255, 1.0];
const COLOR_CANOPY = [1.0, 0, 0xaa / 255];
function gradientColor(y) {
  if (y < -10) {
    const t = clamp((y + 65) / 55, 0, 1);
    return mixRgb(COLOR_ROOTS, COLOR_TRUNK, t);
  }
  const t = clamp((y + 10) / 85, 0, 1);
  return mixRgb(COLOR_TRUNK, COLOR_CANOPY, t);
}
function mixRgb(a, b, t) { t = clamp(t, 0, 1); return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function hexToRgb(hex) { const h = hex.replace("#", ""); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; }
function boost(rgb, f) { return [Math.min(1, rgb[0] * f), Math.min(1, rgb[1] * f), Math.min(1, rgb[2] * f)]; }

// --- Build the dataset ---
const topLevel = categories.filter((c) => c.isTopLevel).sort((a, b) => a.displayOrder - b.displayOrder);
const subsByParent = new Map();
for (const sub of categories.filter((c) => !c.isTopLevel)) {
  if (!subsByParent.has(sub.parentName)) subsByParent.set(sub.parentName, []);
  subsByParent.get(sub.parentName).push(sub);
}

// Count entries per top-level category — for size/density telemetry only.
const entriesByCat = new Map();
for (const e of entries) {
  if (!e.categoryId) continue;
  const sub = categories.find((c) => c.id === e.categoryId);
  if (!sub) continue;
  const parent = topLevel.find((c) => c.name === sub.parentName);
  if (!parent) continue;
  entriesByCat.set(parent.id, (entriesByCat.get(parent.id) || 0) + 1);
}

// Wedge assignment — EQUAL widths around the circle.
// (Earlier sqrt-density weighting caused asymmetric "lean" because V1's biggest
// categories happened to all sit early in displayOrder, so the wide arcs all
// clustered on one side of the trunk.)
const N = Math.max(topLevel.length, 1);
const WEDGE_FULL = (Math.PI * 2) / N;
const WEDGE_USABLE = WEDGE_FULL * 0.78; // small gap between wedges

const catMeta = new Map();
topLevel.forEach((cat, i) => {
  const baseAngle = (i / N) * Math.PI * 2;
  // Category anchors all sit in the upper canopy with mild jitter
  // (rather than spiraling root → canopy, which dragged sparse categories
  // into the trunk region and broke the tree silhouette).
  const heightCenter = 28 + rndRange(-4, 6);
  catMeta.set(cat.id, {
    baseAngle,
    angularWidth: WEDGE_USABLE,
    heightCenter,
    entryCount: entriesByCat.get(cat.id) || 0,
  });
});

// Sample a position inside the silhouette, constrained to a wedge.
function samplePosition(yHint, baseAngle, angularWidth, density = 0.55) {
  const y = yHint + rndRange(-3, 3);
  const maxR = treeRadius(y);
  const r = maxR * Math.pow(rnd(), density);
  const theta = baseAngle + (rnd() - 0.5) * angularWidth;
  return [
    r * Math.cos(theta) + rndRange(-1.5, 1.5),
    y + rndRange(-1.5, 1.5),
    r * Math.sin(theta) + rndRange(-1.5, 1.5),
  ];
}

const nodes = [];
const links = [];

// Trunk anchor — invisible-ish at base; structural root of all backbone links.
const TRUNK_ID = "__trunk__";
nodes.push({
  id: TRUNK_ID,
  kind: "trunk",
  name: "AI Tree Library",
  color: [1, 1, 1],
  position: [0, -45, 0],
  size: 4,
});

// 1) Category anchors — large, bright; sit in upper canopy at varying heights.
topLevel.forEach((cat) => {
  const meta = catMeta.get(cat.id);
  const y = meta.heightCenter + rndRange(-2, 4);
  const pos = samplePosition(y, meta.baseAngle, meta.angularWidth * 0.18, 0.25);
  const catColor = mixRgb(gradientColor(pos[1]), hexToRgb(cat.color), 0.65);
  nodes.push({
    id: cat.id,
    kind: "category",
    name: cat.name,
    color: boost(catColor, 1.55),
    rawColor: cat.color,
    position: pos,
    size: 7,
    angle: meta.baseAngle,
  });
  links.push({ source: TRUNK_ID, target: cat.id, kind: "backbone" });
});

// 2) Subcategory anchors — distributed THROUGH the parent's wedge across the
// full vertical range (5..40), not clumped at canopy. This makes subcats
// occupy different branch heights within a category, giving each branch
// internal structure.
const subPositions = new Map();
for (const parent of topLevel) {
  const meta = catMeta.get(parent.id);
  const subs = (subsByParent.get(parent.name) || []).sort((a, b) => a.displayOrder - b.displayOrder);
  subs.forEach((sub, j) => {
    // Spread subcategories vertically along the branch, from upper-trunk to canopy
    const t = subs.length === 1 ? 0.5 : j / (subs.length - 1);
    const y = 8 + t * 30 + rndRange(-3, 3); // y range ~5..40
    const angleSpread = meta.angularWidth * 0.55;
    const pos = samplePosition(y, meta.baseAngle, angleSpread, 0.45);
    subPositions.set(sub.id, { pos, parentId: parent.id });
    const subColor = mixRgb(gradientColor(pos[1]), hexToRgb(parent.color), 0.6);
    nodes.push({
      id: sub.id,
      kind: "subcategory",
      name: sub.name,
      color: boost(subColor, 1.4),
      rawColor: parent.color,
      position: pos,
      size: 4.5,
      parentId: parent.id,
    });
    links.push({ source: parent.id, target: sub.id, kind: "backbone" });
  });
}

// 3) Entries — the leaves. Distribute across the FULL tree height inside
// their parent category's wedge. This is what makes the tree silhouette
// readable: leaves fill the entire roots → trunk → canopy range, not just
// the area around their subcategory anchor.
const entriesBySubcat = new Map();
const entryNodesById = new Map();

for (const entry of entries) {
  if (!entry.categoryId) continue;
  const subInfo = subPositions.get(entry.categoryId);
  if (!subInfo) continue;
  const parent = topLevel.find((c) => c.id === subInfo.parentId);
  const parentMeta = catMeta.get(subInfo.parentId);
  if (!parent || !parentMeta) continue;

  // Bias entries toward the upper canopy (where the volume is biggest)
  // but allow them anywhere from deep roots to top of crown.
  const u = Math.pow(rnd(), 0.7);
  const y = -50 + u * 115; // -50 .. 65, biased upward
  const pos = samplePosition(y, parentMeta.baseAngle, parentMeta.angularWidth, 0.55);

  const parentRgb = hexToRgb(parent.color);
  const toolColor = mixRgb(gradientColor(pos[1]), parentRgb, 0.5);
  const tier = rarityKey(entry);

  const cluster = entriesBySubcat.get(entry.categoryId) || [];

  // Sizing per rarity. Density-adaptive: with very few entries, push larger
  // so the tree still reads visually.
  const baseSizeByTier = { legendary: 5.5, established: 3.6, rare: 3.0, gem: 2.4 };
  const densityScale = entries.length < 80 ? 1.25 : entries.length < 250 ? 1.1 : 1.0;
  const size = baseSizeByTier[tier] * densityScale;

  const boostByTier = { legendary: 1.8, established: 1.35, rare: 1.25, gem: 1.4 };

  const node = {
    id: entry.id,
    kind: "entry",
    name: entry.name,
    color: boost(toolColor, boostByTier[tier]),
    rawColor: parent.color,
    position: pos,
    size,
    featured: entry.featured,
    gem: entry.gem,
    rarity: tier,
    parentId: entry.categoryId,
    tags: entry.tags,
  };
  nodes.push(node);
  entryNodesById.set(entry.id, node);
  cluster.push(node);
  entriesBySubcat.set(entry.categoryId, cluster);
  links.push({ source: entry.categoryId, target: entry.id, kind: "backbone" });
}

// 4) Constellation lines — within each subcategory, connect each entry to its
// K=2 nearest siblings. Forms small star-constellations inside clusters.
for (const cluster of entriesBySubcat.values()) {
  if (cluster.length < 2) continue;
  const K = 2;
  for (let i = 0; i < cluster.length; i++) {
    const a = cluster[i];
    // Compute distances to all siblings
    const dists = [];
    for (let j = 0; j < cluster.length; j++) {
      if (i === j) continue;
      const b = cluster[j];
      const dx = a.position[0] - b.position[0];
      const dy = a.position[1] - b.position[1];
      const dz = a.position[2] - b.position[2];
      dists.push({ idx: j, d2: dx * dx + dy * dy + dz * dz });
    }
    dists.sort((x, y) => x.d2 - y.d2);
    for (let k = 0; k < Math.min(K, dists.length); k++) {
      const b = cluster[dists[k].idx];
      // Avoid double-edges (only add if a.id < b.id lex)
      if (a.id < b.id) {
        links.push({ source: a.id, target: b.id, kind: "cluster" });
      }
    }
  }
}

// 5) Tag bridges — entries sharing 2+ tags get a faint cross-cluster line.
//   Capped per node to keep the visual sparse.
const TAG_BRIDGE_MAX = 1; // at most one tag-bridge edge per node
const tagBridgeCount = new Map();
const entryList = nodes.filter((n) => n.kind === "entry");
for (let i = 0; i < entryList.length; i++) {
  const a = entryList[i];
  if ((tagBridgeCount.get(a.id) ?? 0) >= TAG_BRIDGE_MAX) continue;
  if (!a.tags || a.tags.length < 2) continue;
  for (let j = i + 1; j < entryList.length; j++) {
    const b = entryList[j];
    if (a.parentId === b.parentId) continue; // skip same-subcat (already cluster-linked)
    if ((tagBridgeCount.get(b.id) ?? 0) >= TAG_BRIDGE_MAX) continue;
    if (!b.tags || b.tags.length < 2) continue;
    let shared = 0;
    const sA = new Set(a.tags);
    for (const t of b.tags) if (sA.has(t)) shared++;
    if (shared >= 2) {
      links.push({ source: a.id, target: b.id, kind: "tag-bridge" });
      tagBridgeCount.set(a.id, (tagBridgeCount.get(a.id) ?? 0) + 1);
      tagBridgeCount.set(b.id, (tagBridgeCount.get(b.id) ?? 0) + 1);
      break; // one bridge per outer-loop node is enough
    }
  }
}

console.log(`[fetch-content] Nodes: ${nodes.length}`);
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
