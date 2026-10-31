// Build step: the library as a graph in space. public/api/graph.json
//
// 1. Meaning   every link becomes a weighted bag of features (TF-IDF over its name, description,
//              tags and host, plus strong tokens for its sub-branch, branch and kind).
// 2. Relations cosine similarity through an inverted index (only pairs that share a feature are
//              ever compared), keeping each link's K strongest neighbours. These are the edges you see.
// 3. Space     a seeded 3D force simulation: edges pull related links together, a hashed grid keeps
//              everything apart, and each branch is gently held to an anchor on a dome so the
//              library still grows as a canopy over a trunk. Deterministic: same data, same tree.
//
// Runs once per deploy. The browser only reads the result.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { BRANCHES } from "../lib/taxonomy.mjs";
import { readData, DATA } from "./data-io.mjs";

const K = 6;           // neighbours kept per link
const MIN_SIM = 0.12;  // weaker relations are noise
const ITER = 420;

const { library } = await readData();
const N = library.length;
const PUB = join(DATA, "..", "public", "api");
await mkdir(PUB, { recursive: true });

// ---------- seeded randomness ----------
let seed = 0x1111;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(6.283185 * rnd());

// ---------- 1. features ----------
const STOP = new Set("a an the and or of for to in on with by from at as is are be your you our we it its this that into via using use new free best app apps tool tools platform online based more most all any can get make makes help helps www com io ai co net org".split(" "));
const stem = (w) => w.replace(/(ings|ing|ers|er|ies|es|s|ed|ly)$/, (m) => (m === "ies" ? "y" : "")).slice(0, 18);
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
const subName = new Map(BRANCHES.flatMap((b) => b.subs.map((s) => [`${b.id}/${s.id}`, s.name])));

const docs = library.map((e) => {
  const f = new Map();
  const add = (t, w) => f.set(t, (f.get(t) || 0) + w);
  for (const w of words(e.name)) add(w, 2);
  for (const w of words(e.description)) add(w, 1);
  for (const t of e.tags || []) add(`#${t.toLowerCase()}`, 1.5);
  for (const w of words(subName.get(`${e.branch}/${e.sub}`))) add(w, 1);
  add(`sub:${e.branch}/${e.sub}`, 7);
  add(`branch:${e.branch}`, 3.5);
  add(`kind:${e.kind}`, 0.6);
  return f;
});
const df = new Map();
for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) || 0) + 1);
const vecs = docs.map((d) => {
  const v = new Map();
  let norm = 0;
  for (const [t, tf] of d) {
    const structural = t.includes(":");
    const w = (1 + Math.log(tf)) * (structural ? 1 : Math.log(1 + N / (df.get(t) || 1)));
    v.set(t, w);
    norm += w * w;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [t, w] of v) v.set(t, w / norm);
  return v;
});

// ---------- 2. relations ----------
const postings = new Map();
vecs.forEach((v, i) => { for (const [t, w] of v) { if (!postings.has(t)) postings.set(t, []); postings.get(t).push([i, w]); } });
const neighbours = vecs.map((v, i) => {
  const acc = new Map();
  for (const [t, w] of v) {
    const list = postings.get(t);
    if (list.length > 400 && !t.startsWith("sub:")) continue; // ubiquitous tokens add cost, not meaning
    for (const [j, wj] of list) if (j !== i) acc.set(j, (acc.get(j) || 0) + w * wj);
  }
  return [...acc].filter(([, s]) => s >= MIN_SIM).sort((a, b) => b[1] - a[1]).slice(0, K);
});
const edgeMap = new Map();
neighbours.forEach((list, i) => list.forEach(([j, s]) => {
  const k = i < j ? `${i}-${j}` : `${j}-${i}`;
  edgeMap.set(k, Math.max(edgeMap.get(k) || 0, s));
}));
const edges = [...edgeMap].map(([k, s]) => { const [a, b] = k.split("-").map(Number); return [a, b, s]; });

// ---------- 3. space ----------
const bIndex = new Map(BRANCHES.map((b, i) => [b.id, i]));
const live = BRANCHES.filter((b) => library.some((e) => e.branch === b.id));
const R0 = 38 * Math.cbrt(Math.max(N, 50) / 500);
// anchors on an upper dome, biggest branches nearest the crown
const anchors = new Map();
const bySize = [...live].sort((a, b) => library.filter((e) => e.branch === b.id).length - library.filter((e) => e.branch === a.id).length);
bySize.forEach((b, k) => {
  const t = (k + 0.5) / bySize.length;
  const polar = Math.acos(1 - t * 0.9); // cap of the sphere: 0..~85°
  const az = k * Math.PI * (3 - Math.sqrt(5));
  anchors.set(b.id, [Math.sin(polar) * Math.cos(az) * R0, Math.cos(polar) * R0 * 0.55, Math.sin(polar) * Math.sin(az) * R0]);
});

const P = new Float64Array(N * 3), V = new Float64Array(N * 3);
library.forEach((e, i) => {
  const a = anchors.get(e.branch) || [0, 0, 0];
  P[i * 3] = a[0] + gauss() * 2; P[i * 3 + 1] = a[1] + gauss() * 2; P[i * 3 + 2] = a[2] + gauss() * 2;
});
const deg = new Float64Array(N);
for (const [a, b] of edges) { deg[a]++; deg[b]++; }

const CELL = 4.5;
for (let it = 0; it < ITER; it++) {
  const heat = 1 - it / ITER;
  const F = new Float64Array(N * 3);
  // repulsion through a hashed grid: only nearby links push on each other
  const grid = new Map();
  for (let i = 0; i < N; i++) {
    const key = `${Math.floor(P[i * 3] / CELL)},${Math.floor(P[i * 3 + 1] / CELL)},${Math.floor(P[i * 3 + 2] / CELL)}`;
    (grid.get(key) || grid.set(key, []).get(key)).push(i);
  }
  for (let i = 0; i < N; i++) {
    const cx = Math.floor(P[i * 3] / CELL), cy = Math.floor(P[i * 3 + 1] / CELL), cz = Math.floor(P[i * 3 + 2] / CELL);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const cell = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
      if (!cell) continue;
      for (const j of cell) {
        if (j <= i) continue;
        let x = P[i * 3] - P[j * 3], y = P[i * 3 + 1] - P[j * 3 + 1], z = P[i * 3 + 2] - P[j * 3 + 2];
        let d2 = x * x + y * y + z * z;
        if (d2 > CELL * CELL) continue;
        if (d2 < 0.01) { x = rnd() - 0.5; y = rnd() - 0.5; z = rnd() - 0.5; d2 = 0.01; }
        const f = 2.2 / d2, d = Math.sqrt(d2);
        F[i * 3] += (x / d) * f; F[i * 3 + 1] += (y / d) * f; F[i * 3 + 2] += (z / d) * f;
        F[j * 3] -= (x / d) * f; F[j * 3 + 1] -= (y / d) * f; F[j * 3 + 2] -= (z / d) * f;
      }
    }
  }
  // springs along relations: stronger similarity, shorter rest length
  for (const [a, b, s] of edges) {
    const x = P[b * 3] - P[a * 3], y = P[b * 3 + 1] - P[a * 3 + 1], z = P[b * 3 + 2] - P[a * 3 + 2];
    const d = Math.sqrt(x * x + y * y + z * z) || 0.01;
    const bridge = library[a].branch !== library[b].branch;
    const rest = bridge ? 9 : 1.6 + 2.4 * (1 - s);
    const f = (bridge ? 0.012 : 0.06) * s * (d - rest) / d;
    const wa = 1 / Math.sqrt(deg[a] + 1), wb = 1 / Math.sqrt(deg[b] + 1);
    F[a * 3] += x * f * wa; F[a * 3 + 1] += y * f * wa; F[a * 3 + 2] += z * f * wa;
    F[b * 3] -= x * f * wb; F[b * 3 + 1] -= y * f * wb; F[b * 3 + 2] -= z * f * wb;
  }
  // each branch is held, softly, near its place in the canopy
  for (let i = 0; i < N; i++) {
    const a = anchors.get(library[i].branch);
    if (!a) continue;
    for (let k = 0; k < 3; k++) F[i * 3 + k] += (a[k] - P[i * 3 + k]) * 0.03;
  }
  const step = 0.6 * heat + 0.05;
  for (let i = 0; i < N * 3; i++) {
    V[i] = (V[i] + F[i]) * 0.55;
    const lim = 1.2 * heat + 0.1;
    P[i] += Math.max(-lim, Math.min(lim, V[i] * step));
  }
}

// ---------- clusters and labels ----------
const centroid = (ids) => {
  const c = [0, 0, 0];
  for (const i of ids) for (let k = 0; k < 3; k++) c[k] += P[i * 3 + k];
  return c.map((v) => +(v / Math.max(1, ids.length)).toFixed(2));
};
const extent = (ids, c) => +Math.sqrt(ids.reduce((s, i) => s + (P[i * 3] - c[0]) ** 2 + (P[i * 3 + 1] - c[1]) ** 2 + (P[i * 3 + 2] - c[2]) ** 2, 0) / Math.max(1, ids.length)).toFixed(2);
const branches = live.map((b) => {
  const ids = library.map((e, i) => (e.branch === b.id ? i : -1)).filter((i) => i >= 0);
  const c = centroid(ids);
  return { id: b.id, c, r: extent(ids, c), n: ids.length };
});
const subs = [];
for (const b of live) for (const s of BRANCHES[bIndex.get(b.id)].subs) {
  const ids = library.map((e, i) => (e.branch === b.id && e.sub === s.id ? i : -1)).filter((i) => i >= 0);
  if (ids.length >= 2) { const c = centroid(ids); subs.push({ b: b.id, id: s.id, name: s.name, c, n: ids.length }); }
}
let minY = Infinity, radius = 0;
for (let i = 0; i < N; i++) { minY = Math.min(minY, P[i * 3 + 1]); radius = Math.max(radius, Math.hypot(P[i * 3], P[i * 3 + 2])); }

const out = {
  v: 2,
  ids: library.map((e) => e.id),
  pos: Array.from(P, (x) => +x.toFixed(2)),
  edges: edges.flatMap(([a, b, s]) => [a, b, +s.toFixed(3)]),
  branches,
  subs,
  root: [0, +(minY - Math.max(14, radius * 0.75)).toFixed(2), 0],
  radius: +radius.toFixed(2),
};
await writeFile(join(PUB, "graph.json"), JSON.stringify(out));
console.log(`[build-graph] ${N} links · ${edges.length} relations · ${branches.length} branches · radius ${radius.toFixed(1)}`);
