// Build-time content fetch.
// Runs `npm run build` BEFORE `next build`.
//
// Fetches all Status=Ready rows from Notion Library + entire Categories DB,
// builds a tree-shaped particle layout (matching the Neural Arbor design),
// and writes /public/library.json.
//
// Layout philosophy:
//   - 18 categories each own an ANGULAR WEDGE around the trunk.
//   - Within each wedge, tools + subcategories distribute across the
//     FULL tree height (roots → canopy) — not just the canopy.
//   - The tree silhouette is enforced by treeRadius(y).
//   - Ambient particles fill the silhouette uniformly to maintain density
//     at any number of entries.

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

// --- Tree silhouette ---
// Returns the maximum radius at a given height y.
function treeRadius(y) {
  if (y < -45) return 8 + Math.pow(-45 - y, 1.4) * 1.2;
  if (y < 10) return Math.max(2, 6 - (y + 45) * 0.05);
  if (y < 50) return 3 + Math.pow(y - 10, 1.2) * 1.1;
  const maxR = 3 + Math.pow(40, 1.2) * 1.1;
  const t = (y - 50) * Math.PI / 45;
  return Math.max(0.1, maxR * Math.cos(t));
}

// Deterministic pseudo-random so the tree is reproducible across builds.
let seedState = 0x9e3779b1;
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 0x100000000;
}
function rndRange(a, b) { return a + (b - a) * rnd(); }
function rndY() {
  // Bias slightly toward the canopy (where the volume is larger anyway)
  const u = Math.pow(rnd(), 0.85);
  return -55 + u * 120; // covers -55..65, biased toward upper range
}

// Height gradient color: purple (roots) → cyan (trunk) → pink (canopy).
const COLOR_ROOT = [0x70 / 255, 0, 1.0];        // #7000ff
const COLOR_TRUNK = [0, 0xf3 / 255, 1.0];        // #00f3ff
const COLOR_CANOPY = [1.0, 0, 0xaa / 255];       // #ff00aa
function gradientColor(y) {
  if (y < 10) {
    const t = (y + 60) / 70;
    return mix(COLOR_ROOT, COLOR_TRUNK, t);
  }
  const t = (y - 10) / 60;
  return mix(COLOR_TRUNK, COLOR_CANOPY, t);
}
function mix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
}
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
function blendWithGradient(categoryRgb, y, weight) {
  const g = gradientColor(y);
  return mix(g, categoryRgb, weight);
}

// Sample a position inside the tree silhouette at a given height + angular wedge.
function samplePosition(y, baseAngle, angularWidth, density = 0.5) {
  const maxR = treeRadius(y);
  // Density-biased radius (closer to center = denser)
  const r = maxR * Math.pow(rnd(), density);
  const theta = baseAngle + (rnd() - 0.5) * angularWidth;
  return [
    r * Math.cos(theta) + rndRange(-1.5, 1.5),
    y + rndRange(-1.5, 1.5),
    r * Math.sin(theta) + rndRange(-1.5, 1.5),
  ];
}

// --- Build nodes ---

const topLevel = categories.filter((c) => c.isTopLevel).sort((a, b) => a.displayOrder - b.displayOrder);
const subsByParent = new Map();
for (const sub of categories.filter((c) => !c.isTopLevel)) {
  if (!subsByParent.has(sub.parentName)) subsByParent.set(sub.parentName, []);
  subsByParent.get(sub.parentName).push(sub);
}

const nodes = [];
const links = [];

// Trunk anchor (logical root, kept invisible-ish at the base)
const TRUNK_ID = "__trunk__";
nodes.push({
  id: TRUNK_ID,
  kind: "trunk",
  name: "AI Tree Library",
  color: [1, 1, 1],
  position: [0, -45, 0],
  size: 5,
});

// Each top-level category claims a wedge of angles around the trunk.
const N_CATS = Math.max(topLevel.length, 1);
const WEDGE_FULL = (Math.PI * 2) / N_CATS;
const WEDGE_USABLE = WEDGE_FULL * 0.85; // small gap between wedges

const wedgeByCategory = new Map();
const categoryAnchorPos = new Map();

topLevel.forEach((cat, i) => {
  const baseAngle = (i / N_CATS) * Math.PI * 2;
  wedgeByCategory.set(cat.id, { baseAngle, width: WEDGE_USABLE });

  // Place the category ANCHOR up in its branch's canopy at mid-height of upper tree.
  const anchorY = 30 + rndRange(-5, 8);
  const anchorPos = samplePosition(anchorY, baseAngle, WEDGE_USABLE * 0.3, 0.3);
  categoryAnchorPos.set(cat.id, anchorPos);
  const catColor = blendWithGradient(hexToRgb(cat.color), anchorY, 0.6);
  nodes.push({
    id: cat.id,
    kind: "category",
    name: cat.name,
    color: catColor,
    rawColor: cat.color,
    position: anchorPos,
    size: 6.0,
    angle: baseAngle,
  });
  links.push({ source: TRUNK_ID, target: cat.id, kind: "trunk-cat" });
});

// Subcategories: scatter through their parent's wedge across multiple heights
const subPositions = new Map();
for (const parent of topLevel) {
  const subs = (subsByParent.get(parent.name) || []).sort((a, b) => a.displayOrder - b.displayOrder);
  const { baseAngle, width } = wedgeByCategory.get(parent.id);
  subs.forEach((sub, j) => {
    // Distribute subcategory heights across a wide range — some are lower-branch, some higher
    const y = 5 + (j / Math.max(subs.length, 1)) * 35 + rndRange(-6, 6);
    const pos = samplePosition(y, baseAngle, width * 0.7, 0.4);
    subPositions.set(sub.id, { pos, baseAngle, parentId: parent.id });
    const parentRgb = hexToRgb(parent.color);
    nodes.push({
      id: sub.id,
      kind: "subcategory",
      name: sub.name,
      color: blendWithGradient(parentRgb, y, 0.55),
      rawColor: parent.color,
      position: pos,
      size: 3.5,
      parentId: parent.id,
    });
    links.push({ source: parent.id, target: sub.id, kind: "cat-subcat" });
  });
}

// Entries (tools): each one positioned anywhere in its category's wedge,
// across the FULL tree height (roots → canopy). This is what makes the
// arrangement read as a tree.
for (const entry of entries) {
  if (!entry.categoryId) continue;
  const subInfo = subPositions.get(entry.categoryId);
  if (!subInfo) continue;
  const wedge = wedgeByCategory.get(subInfo.parentId);
  if (!wedge) continue;
  const { baseAngle, width } = wedge;

  // Distribute across the full vertical range, with mild bias toward the canopy.
  const y = rndY();
  const pos = samplePosition(y, baseAngle, width, 0.5);

  const parent = topLevel.find((c) => c.id === subInfo.parentId);
  const parentRgb = parent ? hexToRgb(parent.color) : [1, 1, 1];

  // Featured/gem get larger sizes for easier targeting + visual prominence
  const size = entry.featured ? 4.5 : entry.gem ? 3.5 : 2.8;

  nodes.push({
    id: entry.id,
    kind: "entry",
    name: entry.name,
    color: blendWithGradient(parentRgb, pos[1], 0.5),
    rawColor: parent ? parent.color : "#888",
    position: pos,
    size,
    featured: entry.featured,
    gem: entry.gem,
    parentId: entry.categoryId,
  });
  links.push({ source: entry.categoryId, target: entry.id, kind: "subcat-tool" });
}

// Ambient decorative particles: fill the tree silhouette so it always looks
// dense regardless of how many real entries exist. These are non-interactive.
// Lower count + smaller size than v1 so interactive nodes pop visually.
const TARGET_PARTICLES = 1300;
const realInteractive = nodes.length - 1; // minus trunk
const AMBIENT_COUNT = Math.max(400, TARGET_PARTICLES - realInteractive);
for (let i = 0; i < AMBIENT_COUNT; i++) {
  const y = rndY();
  const baseR = treeRadius(y);
  const r = baseR * Math.pow(rnd(), 0.5);
  const theta = rnd() * Math.PI * 2;
  const pos = [
    r * Math.cos(theta) + rndRange(-3, 3),
    y + rndRange(-3, 3),
    r * Math.sin(theta) + rndRange(-3, 3),
  ];
  const c = gradientColor(pos[1]);
  const hueShift = rndRange(-0.04, 0.04);
  const variedColor = [
    Math.max(0, Math.min(1, c[0] + hueShift * 0.3)),
    Math.max(0, Math.min(1, c[1] + hueShift * 0.1)),
    Math.max(0, Math.min(1, c[2] + hueShift * 0.4)),
  ];
  nodes.push({
    id: `__ambient_${i}__`,
    kind: "ambient",
    color: variedColor,
    position: pos,
    size: rndRange(0.3, 0.7),
  });
}

// Plexus lines: connect nearby interactive nodes only.
// We keep these very sparse — they should hint at structure, not dominate.
const interactiveNodes = nodes.filter((n) => n.kind !== "ambient");
const MAX_PROX_LINKS = 2;
const PROX_THRESHOLD_SQ = 12 * 12;
const proxCounts = new Map();
for (let i = 0; i < interactiveNodes.length; i++) {
  const a = interactiveNodes[i];
  for (let j = i + 1; j < interactiveNodes.length; j++) {
    const b = interactiveNodes[j];
    if ((proxCounts.get(a.id) ?? 0) >= MAX_PROX_LINKS) break;
    if ((proxCounts.get(b.id) ?? 0) >= MAX_PROX_LINKS) continue;
    const dx = a.position[0] - b.position[0];
    const dy = a.position[1] - b.position[1];
    const dz = a.position[2] - b.position[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > PROX_THRESHOLD_SQ) continue;
    const already = links.some(
      (l) =>
        (l.source === a.id && l.target === b.id) ||
        (l.source === b.id && l.target === a.id)
    );
    if (already) continue;
    links.push({ source: a.id, target: b.id, kind: "proximity" });
    proxCounts.set(a.id, (proxCounts.get(a.id) ?? 0) + 1);
    proxCounts.set(b.id, (proxCounts.get(b.id) ?? 0) + 1);
  }
}

console.log(`[fetch-content] Nodes: ${nodes.length} (${interactiveNodes.length} interactive + ${nodes.length - interactiveNodes.length} ambient)`);
console.log(`[fetch-content] Links: ${links.length}`);

function emptyPayload() {
  return { generatedAt: new Date().toISOString(), stats: { categories: 0, topLevel: 0, entries: 0, featured: 0, gems: 0 }, categories: [], entries: [], layout: { nodes: [], links: [] } };
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

await ensureDir(dirname(OUTPUT));

const positionedNodes = nodes.map((n) => ({
  id: n.id,
  kind: n.kind,
  name: n.name,
  color: n.color,
  rawColor: n.rawColor ?? null,
  featured: n.featured ?? false,
  gem: n.gem ?? false,
  parentId: n.parentId ?? null,
  position: [
    Number((n.position[0]).toFixed(3)),
    Number((n.position[1]).toFixed(3)),
    Number((n.position[2]).toFixed(3)),
  ],
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
