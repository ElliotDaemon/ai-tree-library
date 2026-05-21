// Build-time content fetch.
// Runs `npm run build` BEFORE `next build`.
//
// Fetches all Status=Ready rows from Notion Library + entire Categories DB,
// builds a tree-shaped particle layout (matching the Neural Arbor design),
// and writes /public/library.json.

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

// --- Tree-shaped layout (Neural Arbor) ---
// Y axis is vertical. The tree silhouette matches the reference design:
//   y < -45 → roots flaring
//   -45 ≤ y < 10 → trunk
//   10 ≤ y < 50 → branches expanding into canopy
//   50 ≤ y → canopy rounding off
// Returns radius bound at a given height.
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

// Height gradient color: purple (roots) → cyan (trunk) → pink (canopy).
const COLOR_ROOT = [0x70 / 255, 0, 1.0];        // #7000ff
const COLOR_TRUNK = [0, 0xf3 / 255, 1.0];        // #00f3ff
const COLOR_CANOPY = [1.0, 0, 0xaa / 255];       // #ff00aa
function gradientColor(y) {
  // y range roughly -60 .. 70
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

// --- Build nodes ---
// Three kinds of interactive nodes: category, subcategory, entry.
// Plus a swarm of ambient decorative particles to fill out the tree silhouette.

const topLevel = categories.filter((c) => c.isTopLevel).sort((a, b) => a.displayOrder - b.displayOrder);
const subById = new Map();
const subsByParent = new Map();
for (const sub of categories.filter((c) => !c.isTopLevel)) {
  subById.set(sub.id, sub);
  if (!subsByParent.has(sub.parentName)) subsByParent.set(sub.parentName, []);
  subsByParent.get(sub.parentName).push(sub);
}

const nodes = [];
const links = [];

// Trunk anchor (invisible logical root)
const TRUNK_ID = "__trunk__";
nodes.push({
  id: TRUNK_ID,
  kind: "trunk",
  name: "AI Tree Library",
  color: [1, 1, 1],
  position: [0, -40, 0],
  size: 4,
});

// Categories: one branch per top-level category, distributed in angle around the trunk.
// We give each branch a base angle θ and place the category anchor at mid-branch height.
const branchAngles = new Map();
topLevel.forEach((cat, i) => {
  const theta = (i / topLevel.length) * Math.PI * 2;
  branchAngles.set(cat.id, theta);
  const y = 20; // mid-branch, in canopy region
  const r = treeRadius(y) * 0.55;
  const catColor = blendWithGradient(hexToRgb(cat.color), y, 0.55);
  nodes.push({
    id: cat.id,
    kind: "category",
    name: cat.name,
    color: catColor,
    rawColor: cat.color,
    position: [r * Math.cos(theta), y, r * Math.sin(theta)],
    size: 4.5,
    angle: theta,
  });
  links.push({ source: TRUNK_ID, target: cat.id, kind: "trunk-cat" });
});

// Subcategories: cluster around their parent category, with small angular + vertical spread.
const subPositions = new Map();
for (const parent of topLevel) {
  const subs = (subsByParent.get(parent.name) || []).sort((a, b) => a.displayOrder - b.displayOrder);
  const parentAngle = branchAngles.get(parent.id);
  subs.forEach((sub, j) => {
    // Spread along the branch arc; vary height within the canopy.
    const arcSpread = subs.length === 1 ? 0 : ((j / (subs.length - 1)) - 0.5) * 0.45;
    const theta = parentAngle + arcSpread;
    const y = 25 + (j - subs.length / 2) * 4 + rndRange(-2, 2);
    const r = treeRadius(y) * rndRange(0.55, 0.8);
    const subColor = blendWithGradient(hexToRgb(parent.color), y, 0.6);
    const pos = [r * Math.cos(theta), y, r * Math.sin(theta)];
    subPositions.set(sub.id, { pos, angle: theta, parentId: parent.id });
    nodes.push({
      id: sub.id,
      kind: "subcategory",
      name: sub.name,
      color: subColor,
      rawColor: parent.color,
      position: pos,
      size: 2.5,
      parentId: parent.id,
    });
    links.push({ source: parent.id, target: sub.id, kind: "cat-subcat" });
  });
}

// Entries: leaves clustered in the canopy near their subcategory anchor.
const entriesPositioned = [];
for (const entry of entries) {
  if (!entry.categoryId) continue;
  const subInfo = subPositions.get(entry.categoryId);
  if (!subInfo) continue;
  const { angle: subAngle } = subInfo;
  // Push leaves outward from the subcategory, mostly toward the upper canopy.
  const y = subInfo.pos[1] + rndRange(0, 30);
  const r = treeRadius(y) * rndRange(0.65, 0.95);
  const thetaJitter = rndRange(-0.25, 0.25);
  const theta = subAngle + thetaJitter;
  const pos = [
    r * Math.cos(theta) + rndRange(-2, 2),
    Math.max(-55, Math.min(65, y + rndRange(-2, 2))),
    r * Math.sin(theta) + rndRange(-2, 2),
  ];
  const parent = topLevel.find((c) => c.id === subInfo.parentId);
  const baseColor = parent ? hexToRgb(parent.color) : [1, 1, 1];
  const color = blendWithGradient(baseColor, pos[1], 0.5);
  entriesPositioned.push({ entry, position: pos });
  nodes.push({
    id: entry.id,
    kind: "entry",
    name: entry.name,
    color,
    rawColor: parent ? parent.color : "#888",
    position: pos,
    size: entry.featured ? 2.4 : entry.gem ? 1.8 : 1.3,
    featured: entry.featured,
    gem: entry.gem,
    parentId: entry.categoryId,
  });
  links.push({ source: entry.categoryId, target: entry.id, kind: "subcat-tool" });
}

// Ambient decorative particles: fill the tree silhouette so it looks dense.
// These aren't interactive — they're just for the visual mass.
const AMBIENT_COUNT = 1500;
for (let i = 0; i < AMBIENT_COUNT; i++) {
  const y = rndRange(-60, 70);
  const baseR = treeRadius(y);
  // Bias density toward the volume center (matches the reference shader).
  const r = baseR * Math.pow(rnd(), 0.5);
  const theta = rnd() * Math.PI * 2;
  const pos = [
    r * Math.cos(theta) + rndRange(-3, 3),
    y + rndRange(-3, 3),
    r * Math.sin(theta) + rndRange(-3, 3),
  ];
  const color = gradientColor(pos[1]);
  // Tiny hue jitter for organic variation
  const hueShift = rndRange(-0.05, 0.05);
  const variedColor = [
    Math.max(0, Math.min(1, color[0] + hueShift * 0.3)),
    Math.max(0, Math.min(1, color[1] + hueShift * 0.1)),
    Math.max(0, Math.min(1, color[2] + hueShift * 0.4)),
  ];
  nodes.push({
    id: `__ambient_${i}__`,
    kind: "ambient",
    color: variedColor,
    position: pos,
    size: rndRange(0.6, 1.4),
  });
}

// Plexus links: connect each non-ambient node to a few of its nearest neighbors
// (proximity-based, capped per node). Adds organic-looking inter-cluster threads.
const interactiveNodes = nodes.filter((n) => n.kind !== "ambient");
const MAX_PROX_LINKS = 3;
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
    // Skip if they're already connected structurally
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

function blendWithGradient(categoryRgb, y, weight) {
  const g = gradientColor(y);
  return mix(g, categoryRgb, weight);
}

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
