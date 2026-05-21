// Build-time content fetch.
// Generates a tree-shaped point cloud where MOST particles are dim filler
// and a SMALL fraction are "prominent" data nodes carrying our Notion entries
// (categories, subcategories, tools).
//
// Matches the Gemini reference's structural-height color zones:
//   roots (y < -20)   → purple  "Foundations"
//   trunk (-20..20)   → cyan    "Core"
//   canopy (y > 20)   → pink    "Generative / Deep"
// Real Notion entries override that base with their category color blended in.

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

// --- Tree silhouette (from Gemini reference) ---
function treeRadius(y) {
  if (y < -45) return 8 + Math.pow(-45 - y, 1.4) * 1.2;
  if (y < 10) return Math.max(2, 6 - (y + 45) * 0.05);
  if (y < 55) return 3 + Math.pow(y - 10, 1.2) * 1.1;
  const maxR = 3 + Math.pow(45, 1.2) * 1.1;
  const t = (y - 55) * Math.PI / 40;
  return Math.max(0.1, maxR * Math.cos(t));
}

let seedState = 0x9e3779b1;
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) >>> 0;
  return seedState / 0x100000000;
}
function rndRange(a, b) { return a + (b - a) * rnd(); }

// Height-zone color: roots/trunk/canopy from the Gemini reference
const COLOR_ROOTS = [0x70 / 255, 0, 1.0];     // #7000ff
const COLOR_TRUNK = [0, 0xf3 / 255, 1.0];     // #00f3ff
const COLOR_CANOPY = [1.0, 0, 0xaa / 255];    // #ff00aa
function gradientColor(y) {
  if (y < -10) {
    const t = clamp((y + 65) / 55, 0, 1);
    return mix(COLOR_ROOTS, COLOR_TRUNK, t);
  }
  const t = clamp((y + 10) / 85, 0, 1);
  return mix(COLOR_TRUNK, COLOR_CANOPY, t);
}
function mix(a, b, t) {
  return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
function boost(rgb, factor) {
  return [Math.min(1, rgb[0] * factor), Math.min(1, rgb[1] * factor), Math.min(1, rgb[2] * factor)];
}

// Sample a position somewhere in the tree silhouette.
// If a category wedge is given, the position is constrained to that angular slice
// AND its preferred height band (so categories visually group on their branch).
function samplePosition(yHint, baseAngle, angularWidth, density = 0.6) {
  const y = yHint + rndRange(-4, 4);
  const maxR = treeRadius(y);
  const r = maxR * Math.pow(rnd(), density);
  const theta = baseAngle + (rnd() - 0.5) * angularWidth;
  return [
    r * Math.cos(theta) + rndRange(-2.5, 2.5),
    y + rndRange(-2.5, 2.5),
    r * Math.sin(theta) + rndRange(-2.5, 2.5),
  ];
}

// --- Build the dataset ---

const topLevel = categories.filter((c) => c.isTopLevel).sort((a, b) => a.displayOrder - b.displayOrder);
const subsByParent = new Map();
for (const sub of categories.filter((c) => !c.isTopLevel)) {
  if (!subsByParent.has(sub.parentName)) subsByParent.set(sub.parentName, []);
  subsByParent.get(sub.parentName).push(sub);
}

// Assign each top-level category an angular wedge AND a vertical height band.
// Mixing both ensures distinct branches but also vertical variety (so the
// silhouette reads as a tree).
const N = Math.max(topLevel.length, 1);
const wedgeFull = (Math.PI * 2) / N;
const wedge = wedgeFull * 0.7; // small gap between wedges

const catMeta = new Map();
topLevel.forEach((cat, i) => {
  const baseAngle = (i / N) * Math.PI * 2;
  // Categories spread across y heights too — spiraling up the trunk
  const heightBandCenter = -20 + (i / N) * 70 + rndRange(-8, 8); // covers about -20..50
  catMeta.set(cat.id, { baseAngle, angularWidth: wedge, heightCenter: heightBandCenter });
});

const nodes = [];
const links = [];

// 1) Category anchors — bright, ~6 size
topLevel.forEach((cat) => {
  const meta = catMeta.get(cat.id);
  const y = meta.heightCenter + rndRange(-3, 3);
  const pos = samplePosition(y, meta.baseAngle, meta.angularWidth * 0.25, 0.3);
  const catColor = mix(gradientColor(pos[1]), hexToRgb(cat.color), 0.6);
  nodes.push({
    id: cat.id,
    kind: "category",
    name: cat.name,
    color: boost(catColor, 1.5),
    rawColor: cat.color,
    position: pos,
    size: 6.5,
  });
});

// 2) Subcategory anchors — ~4 size, near their parent
const subMeta = new Map();
for (const parent of topLevel) {
  const meta = catMeta.get(parent.id);
  const subs = (subsByParent.get(parent.name) || []).sort((a, b) => a.displayOrder - b.displayOrder);
  subs.forEach((sub, j) => {
    // Spread along the branch — vary height within the parent's band
    const y = meta.heightCenter + (j - (subs.length - 1) / 2) * 5 + rndRange(-3, 3);
    const pos = samplePosition(y, meta.baseAngle, meta.angularWidth * 0.55, 0.5);
    subMeta.set(sub.id, { pos, parentId: parent.id });
    const subColor = mix(gradientColor(pos[1]), hexToRgb(parent.color), 0.55);
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
    links.push({ source: parent.id, target: sub.id, kind: "cat-subcat" });
  });
}

// 3) Tool entries — ~3 size, scattered throughout their category's wedge
for (const entry of entries) {
  if (!entry.categoryId) continue;
  const subInfo = subMeta.get(entry.categoryId);
  if (!subInfo) continue;
  const parentMeta = catMeta.get(subInfo.parentId);
  if (!parentMeta) continue;

  // Position the tool anywhere in the parent wedge across full vertical range
  const y = rndRange(-50, 70);
  const pos = samplePosition(y, parentMeta.baseAngle, parentMeta.angularWidth * 0.85, 0.55);

  const parent = topLevel.find((c) => c.id === subInfo.parentId);
  const parentRgb = parent ? hexToRgb(parent.color) : [1, 1, 1];
  const toolColor = mix(gradientColor(pos[1]), parentRgb, 0.5);

  nodes.push({
    id: entry.id,
    kind: "entry",
    name: entry.name,
    color: boost(toolColor, entry.featured ? 1.6 : entry.gem ? 1.4 : 1.25),
    rawColor: parent ? parent.color : "#888",
    position: pos,
    size: entry.featured ? 4.5 : entry.gem ? 3.5 : 2.8,
    featured: entry.featured,
    gem: entry.gem,
    parentId: entry.categoryId,
  });
  links.push({ source: entry.categoryId, target: entry.id, kind: "subcat-tool" });
}

// 4) Filler particles — fill the tree silhouette with dim, NON-INTERACTIVE points
// to give the tree its visual mass. Count scales inversely with real entries
// so total particle count stays ~3500 (matching the Gemini reference).
const TARGET_TOTAL = 3500;
const realCount = nodes.length;
const FILLER_COUNT = Math.max(1500, TARGET_TOTAL - realCount);
for (let i = 0; i < FILLER_COUNT; i++) {
  const y = rndRange(-65, 75);
  const baseR = treeRadius(y);
  const r = baseR * Math.pow(rnd(), 0.6);
  const theta = rnd() * Math.PI * 2;
  const pos = [
    r * Math.cos(theta) + rndRange(-3, 3),
    y + rndRange(-3, 3),
    r * Math.sin(theta) + rndRange(-3, 3),
  ];
  const c = gradientColor(pos[1]);
  const jitter = rndRange(-0.05, 0.05);
  const variedColor = [
    clamp(c[0] + jitter * 0.3, 0, 1),
    clamp(c[1] + jitter * 0.1, 0, 1),
    clamp(c[2] + jitter * 0.4, 0, 1),
  ];
  nodes.push({
    id: `__filler_${i}__`,
    kind: "filler",
    color: variedColor,
    position: pos,
    size: rndRange(0.6, 1.6),
  });
}

// 5) Plexus lines — connect nearby particles (limited per node)
const MAX_LINKS = 4;
const PROX_SQ = 9 * 9;
const counts = new Map();
// Only consider a sample of particles to keep this fast at 3500+ count
const allPositions = nodes;
for (let i = 0; i < allPositions.length; i++) {
  if ((counts.get(i) ?? 0) >= MAX_LINKS) continue;
  for (let j = i + 1; j < allPositions.length; j++) {
    if ((counts.get(i) ?? 0) >= MAX_LINKS) break;
    if ((counts.get(j) ?? 0) >= MAX_LINKS) continue;
    const a = allPositions[i].position;
    const b = allPositions[j].position;
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > PROX_SQ) continue;
    links.push({ source: allPositions[i].id, target: allPositions[j].id, kind: "proximity" });
    counts.set(i, (counts.get(i) ?? 0) + 1);
    counts.set(j, (counts.get(j) ?? 0) + 1);
  }
}

console.log(`[fetch-content] Nodes: ${nodes.length} (real: ${realCount}, filler: ${FILLER_COUNT})`);
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
