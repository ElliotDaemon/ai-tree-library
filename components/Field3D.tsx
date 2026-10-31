"use client";
// The Field: the library as a graph in space (positions and relations from scripts/build-graph.mjs).
//
//   loop     the hero. The camera rides a closed path and the only motion is a function of one phase,
//            so it repeats seamlessly. Page scroll is never captured.
//   explore  full screen. Lights render exactly where they are picked, so what you see is what you click.
//            Navigation is spatial: arrows move toward the best related link in that direction on
//            screen, Tab walks a link's relations, B goes back along your trail, D drifts on its own.
//            Labels appear by distance: branches far away, sub-branches nearer, link names up close.
//
// Restraint is the point: crisp pearls, hairline relations, depth fog, glow only on what you focus.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Row } from "@/lib/types";
import { Favicon, KIND_LABEL } from "./Card";
import { ArrowIcon, SearchIcon, XIcon } from "./Icons";

export interface FieldBranch { id: string; name: string; color: string }
interface Graph {
  ids: string[];
  pos: number[];
  edges: number[];
  branches: { id: string; c: number[]; r: number; n: number }[];
  subs: { b: string; id: string; name: string; c: number[]; n: number }[];
  root: number[];
  radius: number;
}
interface Props {
  rows: Row[];
  branches: FieldBranch[];
  match: Set<string> | null;
  focus: string;
  query: string;
  onQuery: (q: string) => void;
  subName: (r: Row) => string;
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}
interface Related { row: Row; s: number }
interface Engine {
  select: (i: number, fly?: boolean) => void;
  selectId: (id: string) => void;
  flyToBranch: (id: string) => void;
  zoomedBranch: () => string | null;
  overview: () => void;
  surprise: () => void;
  move: (dx: number, dy: number) => void;
  cycle: (d: number) => void;
  back: () => void;
  drift: (on?: boolean) => boolean;
  nextMatch: () => void;
  setExplore: (on: boolean) => void;
  setFilter: (m: Set<string> | null, f: string) => void;
  dispose: () => void;
}

const LOOP = 60;
const IDLE_MS = 40_000;

// ---------- shaders ----------
const BG_VS = `void main(){ gl_Position = vec4(position.xy, .9999, 1.); }`;
const BG_FS = `
precision highp float;
uniform vec2 uRes; uniform float uPh; uniform float uLight; uniform float uT;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - .5*uRes) / uRes.y;
  float v = smoothstep(1.25, .1, length(p*vec2(.9,1.15)));
  // two slow fields of light, on a circle so the loop closes
  vec2 o1 = vec2(cos(uPh), sin(uPh))*.18, o2 = vec2(cos(uPh+2.1), sin(uPh*2.+1.))*.22;
  float a1 = smoothstep(.9, 0., length(p - vec2(-.35,.28) - o1));
  float a2 = smoothstep(.9, 0., length(p - vec2(.42,.05) - o2));
  vec3 col;
  if (uLight > .5) {
    col = mix(vec3(.80,.80,.83), vec3(.88,.88,.9), v) + vec3(.02,.01,.05)*a1 + vec3(.0,.02,.03)*a2;
  } else {
    col = mix(vec3(.012,.012,.016), vec3(.045,.045,.06), v) + vec3(.035,.04,.09)*a1*v + vec3(.06,.025,.06)*a2*v;
  }
  col += (h(gl_FragCoord.xy + fract(uT)*91.) - .5) * (uLight > .5 ? .018 : .022); // film grain
  gl_FragColor = vec4(col, 1.);
}`;

const NODE_VS = `
uniform float uScale; uniform float uMin; uniform float uMax; uniform float uNear; uniform float uFar;
attribute vec3 color; attribute float size; attribute float alpha;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  float d = -mv.z;
  gl_PointSize = clamp(size * uScale / max(d, .1), uMin, uMax);
  vColor = color;
  vAlpha = alpha * mix(.22, 1., smoothstep(uFar, uNear, d));
}`;
const NODE_FS = `
precision highp float;
uniform float uLight;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec2 q = gl_PointCoord*2. - 1.;
  float d = length(q);
  float w = fwidth(d) * 1.2;
  float a = 1. - smoothstep(1. - w, 1., d);
  if (a * vAlpha < .02) discard;
  // a glass bead: a soft key light from the upper left, a darker rim
  float key = smoothstep(.9, .0, length(q - vec2(-.38, .42)));
  vec3 c = vColor * (.62 + .38*(1. - d*d)) + vec3(1.) * key * (uLight > .5 ? .18 : .32);
  c = mix(c, vColor*.45, smoothstep(.7, 1., d) * .6);
  gl_FragColor = vec4(c, a * vAlpha);
}`;

const LINE_VS = `
uniform float uNear; uniform float uFar;
attribute vec3 color; attribute float a; attribute float t;
varying vec3 vColor; varying float vA; varying float vT;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  gl_Position = projectionMatrix * mv;
  vColor = color; vT = t;
  vA = a * mix(.15, 1., smoothstep(uFar, uNear, -mv.z));
}`;
const LINE_FS = `
precision highp float;
uniform float uPh; uniform float uPulse; uniform float uLight;
varying vec3 vColor; varying float vA; varying float vT;
void main(){
  float pulse = uPulse * pow(.5 + .5*sin(vT*9.42 - uPh*4.), 14.);
  gl_FragColor = vec4(mix(vColor, vec3(uLight > .5 ? 0. : 1.), pulse*.6), vA * (1. + pulse*2.5));
}`;

const GLOW_VS = `
uniform float uScale; attribute float size; attribute float alpha; varying float vA;
void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = clamp(size*uScale/max(-mv.z,.1), 14., 120.); vA = alpha; }`;
const GLOW_FS = `
precision highp float;
uniform float uPh; uniform float uLight; uniform vec3 uColor;
varying float vA;
void main(){
  vec2 q = gl_PointCoord*2. - 1.; float d = length(q);
  float halo = exp(-d*d*7.) * .5;
  float r = .82 + .03*sin(uPh*8.);
  float ring = smoothstep(.035, .0, abs(d - r)) * step(.5, vA);
  float a = (halo + ring*.9) * (vA > .5 ? 1. : vA*1.6);
  if (a < .01) discard;
  vec3 c = uLight > .5 ? uColor*.6 : mix(uColor, vec3(1.), .5);
  gl_FragColor = vec4(c, a);
}`;

const hex = (c: string) => { const n = parseInt(c.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const ease = (k: number) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function createEngine(
  canvas: HTMLCanvasElement,
  labelsEl: HTMLDivElement,
  tipEl: HTMLDivElement,
  g: Graph,
  rowsById: Map<string, Row>,
  branches: FieldBranch[],
  cb: { onSelect: (r: Row | null, related: Related[], canBack: boolean) => void; onEnter: () => void; onIdle: () => void; onDrift: (on: boolean) => void; onZoom: (branch: string | null) => void },
): Engine | null {
  const coarse = matchMedia("(pointer: coarse)").matches;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse || devicePixelRatio < 2, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let light = document.documentElement.dataset.theme === "light";

  // ---------- data ----------
  const N = g.ids.length;
  const rows: (Row | null)[] = g.ids.map((id) => rowsById.get(id) || null);
  const pos = new Float32Array(g.pos);
  const color = new Map(branches.map((b) => [b.id, hex(b.color)]));
  const adj: [number, number][][] = Array.from({ length: N }, () => []);
  for (let k = 0; k < g.edges.length; k += 3) {
    const a = g.edges[k], b = g.edges[k + 1], s = g.edges[k + 2];
    adj[a].push([b, s]); adj[b].push([a, s]);
  }
  for (const l of adj) l.sort((x, y) => y[1] - x[1]);
  const P = (i: number) => new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  const center = new THREE.Vector3();
  for (let i = 0; i < N; i++) center.add(P(i));
  center.divideScalar(Math.max(1, N));
  const R = Math.max(12, g.radius);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 4000);
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: 0.075, minDistance: 3, rotateSpeed: 0.55, zoomSpeed: 0.8, screenSpacePanning: true });
  controls.maxDistance = R * 6;

  const uni = {
    uPh: { value: 0 }, uLight: { value: light ? 1 : 0 }, uNear: { value: R * 1.2 }, uFar: { value: R * 5 },
  };

  // background
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: BG_VS, fragmentShader: BG_FS, depthWrite: false, depthTest: false, uniforms: { ...uni, uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 } } }));
  bg.frustumCulled = false; bg.renderOrder = -2;
  scene.add(bg);

  // a sparse field of far stars for parallax
  const S = coarse ? 380 : 700;
  const sp = new Float32Array(S * 3), sc = new Float32Array(S * 3), ss = new Float32Array(S), sa = new Float32Array(S);
  for (let i = 0; i < S; i++) {
    const r = R * (3 + Math.random() * 4), t = Math.random() * 6.283, v = Math.random() * 2 - 1, k = Math.sqrt(1 - v * v);
    sp.set([center.x + Math.cos(t) * k * r, center.y + v * r * 0.8, center.z + Math.sin(t) * k * r], i * 3);
    sc.set([0.75, 0.78, 0.9], i * 3); ss[i] = 0.5; sa[i] = 0.12 + Math.random() * 0.3;
  }
  const nodeMat = (min: number, max: number) => new THREE.ShaderMaterial({
    vertexShader: NODE_VS, fragmentShader: NODE_FS, transparent: true, depthWrite: true,
    uniforms: { ...uni, uScale: { value: 300 }, uMin: { value: min }, uMax: { value: max } },
  });
  const pointsGeo = (p: Float32Array, c: Float32Array, s: Float32Array, a: Float32Array) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(p, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(s, 1));
    geo.setAttribute("alpha", new THREE.BufferAttribute(a, 1));
    return geo;
  };
  const starMat = nodeMat(1, 1.6);
  scene.add(new THREE.Points(pointsGeo(sp, sc, ss, sa), starMat));

  // relations: hairlines between every pair the builder linked
  const E = g.edges.length / 3;
  const ep = new Float32Array(E * 6), ec = new Float32Array(E * 6), ea = new Float32Array(E * 2), et = new Float32Array(E * 2);
  const edgeBase = new Float32Array(E);
  const tint = (i: number) => {
    const b = rows[i]?.b;
    const c = (b && color.get(b)) || [0.6, 0.6, 0.65];
    return light ? mix3([0.1, 0.1, 0.12], c, 0.5) : mix3([0.86, 0.87, 0.9], c, 0.55);
  };
  for (let e = 0; e < E; e++) {
    const a = g.edges[e * 3], b = g.edges[e * 3 + 1], s = g.edges[e * 3 + 2];
    ep.set([pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], e * 6);
    ec.set([...tint(a), ...tint(b)], e * 6);
    edgeBase[e] = 0.05 + s * 0.22;
    ea[e * 2] = ea[e * 2 + 1] = edgeBase[e];
    et[e * 2] = 0; et[e * 2 + 1] = 1;
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(ep, 3));
  edgeGeo.setAttribute("color", new THREE.BufferAttribute(ec, 3));
  edgeGeo.setAttribute("a", new THREE.BufferAttribute(ea, 1));
  edgeGeo.setAttribute("t", new THREE.BufferAttribute(et, 1));
  const lineMat = (pulse: number) => new THREE.ShaderMaterial({ vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false, uniforms: { ...uni, uPulse: { value: pulse } } });
  const edgeMat = lineMat(0);
  scene.add(new THREE.LineSegments(edgeGeo, edgeMat));

  // the trunk: one quiet curve from a shared root up to each branch
  const tp: number[] = [], tc: number[] = [], ta: number[] = [], tt: number[] = [];
  const root = new THREE.Vector3(g.root[0], g.root[1], g.root[2]);
  for (const b of g.branches) {
    const end = new THREE.Vector3(b.c[0], b.c[1] - b.r * 0.9, b.c[2]);
    const curve = new THREE.CubicBezierCurve3(root, new THREE.Vector3(root.x, root.y + (end.y - root.y) * 0.6, root.z), new THREE.Vector3(end.x * 0.55, end.y - R * 0.35, end.z * 0.55), end);
    const pts = curve.getPoints(40);
    const c = light ? mix3([0.1, 0.1, 0.12], color.get(b.id) || [0.5, 0.5, 0.5], 0.4) : mix3([0.8, 0.8, 0.85], color.get(b.id) || [0.5, 0.5, 0.5], 0.5);
    for (let s = 0; s < 40; s++) {
      tp.push(pts[s].x, pts[s].y, pts[s].z, pts[s + 1].x, pts[s + 1].y, pts[s + 1].z);
      tc.push(...c, ...c); ta.push(0.09, 0.09); tt.push(s / 40, (s + 1) / 40);
    }
  }
  const trunkGeo = new THREE.BufferGeometry();
  trunkGeo.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
  trunkGeo.setAttribute("color", new THREE.Float32BufferAttribute(tc, 3));
  trunkGeo.setAttribute("a", new THREE.Float32BufferAttribute(ta, 1));
  trunkGeo.setAttribute("t", new THREE.Float32BufferAttribute(tt, 1));
  const trunkMat = lineMat(0.35);
  scene.add(new THREE.LineSegments(trunkGeo, trunkMat));

  // the links themselves
  const nc = new Float32Array(N * 3), ns = new Float32Array(N), na = new Float32Array(N);
  const paint = () => {
    for (let i = 0; i < N; i++) {
      const r = rows[i];
      const c = (r && color.get(r.b)) || [0.5, 0.5, 0.55];
      nc.set(light ? mix3([0.14, 0.14, 0.17], c, 0.62) : mix3([0.93, 0.93, 0.95], c, 0.5), i * 3);
      ns[i] = !r ? 0.6 : r.f ? 1.55 : r.g ? 1.3 : 1.05;
    }
  };
  paint();
  for (let i = 0; i < N; i++) na[i] = rows[i] ? 1 : 0.2;
  const nodeGeo = pointsGeo(pos, nc, ns, na);
  const nMat = nodeMat(2.2, 11);
  scene.add(new THREE.Points(nodeGeo, nMat));

  // focus layer: selection ring + soft glow on hover and on related links
  const FMAX = 24;
  const fp = new Float32Array(FMAX * 3), fs = new Float32Array(FMAX), fa = new Float32Array(FMAX);
  const focusGeo = new THREE.BufferGeometry();
  focusGeo.setAttribute("position", new THREE.BufferAttribute(fp, 3));
  focusGeo.setAttribute("size", new THREE.BufferAttribute(fs, 1));
  focusGeo.setAttribute("alpha", new THREE.BufferAttribute(fa, 1));
  const glowMat = new THREE.ShaderMaterial({ vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: light ? THREE.NormalBlending : THREE.AdditiveBlending, uniforms: { ...uni, uScale: { value: 300 }, uColor: { value: new THREE.Color(1, 1, 1) } } });
  const focus = new THREE.Points(focusGeo, glowMat);
  focus.renderOrder = 5;
  focus.frustumCulled = false; // its buffer changes every selection; never cull it
  scene.add(focus);
  const hiGeo = new THREE.BufferGeometry();
  const HMAX = 64;
  hiGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(HMAX * 6), 3));
  hiGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(HMAX * 6), 3));
  hiGeo.setAttribute("a", new THREE.BufferAttribute(new Float32Array(HMAX * 2), 1));
  hiGeo.setAttribute("t", new THREE.BufferAttribute(new Float32Array(HMAX * 2), 1));
  const hiMat = lineMat(1);
  const hiLines = new THREE.LineSegments(hiGeo, hiMat);
  hiLines.renderOrder = 4;
  hiLines.frustumCulled = false;
  scene.add(hiLines);

  // ---------- labels (DOM, level of detail by distance) ----------
  labelsEl.innerHTML = "";
  const mk = (cls: string, html: string, onClick?: () => void) => {
    const el = document.createElement(onClick ? "button" : "div");
    el.className = cls; el.innerHTML = html;
    if (onClick) el.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
    labelsEl.appendChild(el);
    return el;
  };
  const bName = new Map(branches.map((b) => [b.id, b.name]));
  const branchCount = new Map(g.branches.map((b) => [b.id, b.n]));
  const bLabels = g.branches.map((b) => ({ b, el: mk("f3-label", `<i style="--c:${branches.find((x) => x.id === b.id)?.color}"></i>${esc(bName.get(b.id) || b.id)}<span>${b.n}</span>`, () => { cb.onEnter(); engine.flyToBranch(b.id); }) }));
  const sLabels = g.subs.map((s) => ({ s, el: mk("f3-sub", esc(s.name)) }));
  const NL = 14;
  const nLabels = Array.from({ length: NL }, () => mk("f3-name", ""));

  // ---------- camera ----------
  let mode: "loop" | "explore" = "loop";
  let narrow = false, offY = 0.28;
  let tween: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3 | null; t1: THREE.Vector3; start: number; dur: number } | null = null;
  const dist0 = () => R * (narrow ? 3.4 : 2.45) + 8;
  const loopPos = (ph: number, out = new THREE.Vector3()) => {
    const d = dist0();
    return out.set(center.x + Math.cos(ph) * d, center.y + R * 0.42 + Math.sin(2 * ph) * R * 0.14, center.z + Math.sin(ph) * d);
  };
  camera.position.copy(loopPos(0));
  controls.target.copy(center);
  camera.lookAt(center);
  const flyTo = (target: THREE.Vector3, distance: number, dur = 1100, dir?: THREE.Vector3) => {
    const d = (dir || camera.position.clone().sub(controls.target)).normalize();
    if (!isFinite(d.x) || d.lengthSq() < 0.5) d.set(0.3, 0.35, 1).normalize();
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: target.clone().add(d.multiplyScalar(distance)), t1: target.clone(), start: performance.now(), dur };
  };

  // ---------- state ----------
  let sel = -1, hover = -1;
  const trail: number[] = [];
  let lastInput = performance.now();
  let focusBranch = "";
  let zoomBranch: string | null = null; // the branch you zoomed into: others dim but stay clickable
  const vis = new Float32Array(N).fill(1); // search/branch filter: hidden lights can't be picked
  const fb = () => focusBranch || zoomBranch || "";
  let matchList: number[] = [], matchAt = -1;
  let drifting = false, driftNext = 0;
  const visible = (i: number) => !!rows[i] && vis[i] > 0.5;

  // ---------- projection helpers ----------
  const v = new THREE.Vector3();
  let W = 1, H = 1;
  const toScreen = (x: number, y: number, z: number) => {
    v.set(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, z: v.z, ok: v.z < 1 && v.z > -1 };
  };
  // the on-screen radius of a light, from the same formula the shader uses
  const drawnRadius = (i: number) => {
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(camera.matrixWorldInverse);
    const u = nMat.uniforms;
    const device = Math.min(u.uMax.value, Math.max(u.uMin.value, (ns[i] * u.uScale.value) / Math.max(-v.z, 0.1)));
    return device / renderer.getPixelRatio() / 2;
  };

  // ---------- picking: exact, in the same space as the render ----------
  let mx = -1e4, my = -1e4, touch = false, pending = false;
  const REGION = 70; // px: how far around the pointer we look to decide which branch's space you're in
  const pickAt = (x: number, y: number) => {
    // 1. a light the pointer is actually on: the front-most one wins, because that is the one you see
    // 2. otherwise the nearest light within reach (fingers get more slack than a mouse)
    // 3. otherwise, the branch that dominates the space around the pointer (lights weighted by closeness),
    //    so clicking between lights zooms into that branch instead of doing nothing
    let onTop = -1, onTopZ = Infinity, near = -1, nearScore = Infinity;
    const weight = new Map<string, number>();
    for (let i = 0; i < N; i++) {
      if (!visible(i)) continue;
      const s = toScreen(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      if (!s.ok) continue;
      const d = Math.hypot(s.x - x, s.y - y), r = drawnRadius(i);
      if (d <= r + 1.5) { if (s.z < onTopZ) { onTopZ = s.z; onTop = i; } continue; }
      const reach = r + (touch ? 18 : 8);
      if (d <= reach && d / reach < nearScore) { nearScore = d / reach; near = i; }
      if (d < REGION) { const b = rows[i]!.b; weight.set(b, (weight.get(b) || 0) + (1 - d / REGION) ** 2); }
    }
    const node = onTop >= 0 ? onTop : near;
    let region: string | null = null, best = 0.35; // need a few lights around before it counts as a branch
    if (node < 0) for (const [b, w] of weight) if (w > best) { best = w; region = b; }
    return { node, region, direct: onTop >= 0 };
  };
  const updateHover = () => {
    pending = false;
    const hit = mode === "explore" || !touch ? pickAt(mx, my) : { node: -1, region: null };
    hover = hit.node;
    const region = hit.region && hit.region !== zoomBranch ? hit.region : null;
    canvas.style.cursor = hover >= 0 ? "pointer" : region ? "zoom-in" : mode === "explore" ? "grab" : "pointer";
    const r = hover >= 0 ? rows[hover] : null;
    if (!touch && ((r && hover !== sel) || region)) {
      tipEl.style.display = "block";
      tipEl.style.transform = `translate(${mx}px, ${my}px)`;
      tipEl.innerHTML = r ? `<b>${esc(r.n)}</b><span>${esc(r.h)}</span>` : `<b>${esc(bName.get(region!) || region!)}</b><span>Click to zoom in · ${branchCount.get(region!) || 0} links</span>`;
    } else tipEl.style.display = "none";
    refreshFocus();
  };
  let downX = 0, downY = 0;
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
  const onMove = (e: PointerEvent) => { touch = e.pointerType !== "mouse"; local(e); if (!pending) { pending = true; requestAnimationFrame(updateHover); } };
  const onDown = (e: PointerEvent) => { touch = e.pointerType !== "mouse"; downX = e.clientX; downY = e.clientY; lastInput = performance.now(); if (mode === "explore") tween = null; };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > (touch ? 10 : 5)) return;
    local(e);
    const { node, region, direct } = pickAt(mx, my);
    if (mode === "loop") cb.onEnter();
    // fingers: at overview distance lights are a few pixels wide, so a tap that lands near (not on) a light
    // in a branch you aren't zoomed into zooms into that branch first; a tap right on a light always opens it
    if (touch && node >= 0 && !direct && rows[node]!.b !== zoomBranch) { engine.select(-1); engine.flyToBranch(rows[node]!.b); return; }
    if (node >= 0) engine.select(node);
    else if (region && region !== zoomBranch) { engine.select(-1); engine.flyToBranch(region); }
    else if (mode === "explore" && sel >= 0 && !touch) engine.select(-1);
  };
  const onLeave = () => { hover = -1; tipEl.style.display = "none"; refreshFocus(); };
  const onWheel = () => { lastInput = performance.now(); tween = null; };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: true });
  controls.addEventListener("start", () => { lastInput = performance.now(); tween = null; if (drifting) engine.drift(false); });

  // ---------- focus layer ----------
  const refreshFocus = () => {
    let k = 0;
    const put = (i: number, size: number, alpha: number) => {
      if (k >= FMAX || i < 0) return;
      fp.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], k * 3); fs[k] = size; fa[k] = alpha; k++;
    };
    if (sel >= 0) { put(sel, 5.5, 1); for (const [j] of adj[sel].slice(0, 8)) if (visible(j)) put(j, 3, 0.35); }
    if (hover >= 0 && hover !== sel) put(hover, 4, 0.42);
    focusGeo.setDrawRange(0, k);
    for (const n of ["position", "size", "alpha"]) focusGeo.attributes[n].needsUpdate = true;
    const selColor = sel >= 0 && rows[sel] ? color.get(rows[sel]!.b) : null;
    glowMat.uniforms.uColor.value.setRGB(...((selColor || [0.85, 0.88, 1]) as [number, number, number]));

    // highlight the selected link's relations and the trail behind you
    const hp = hiGeo.attributes.position.array as Float32Array, hc = hiGeo.attributes.color.array as Float32Array;
    const ha = hiGeo.attributes.a.array as Float32Array, ht = hiGeo.attributes.t.array as Float32Array;
    let m = 0;
    const seg = (a: number, b: number, alpha: number) => {
      if (m >= HMAX) return;
      hp.set([pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]], m * 6);
      hc.set([...tint(a), ...tint(b)], m * 6); ha[m * 2] = ha[m * 2 + 1] = alpha; ht[m * 2] = 0; ht[m * 2 + 1] = 1; m++;
    };
    const anchor = sel >= 0 ? sel : hover;
    if (anchor >= 0) for (const [j, s] of adj[anchor].slice(0, 10)) if (visible(j)) seg(anchor, j, 0.3 + s * 0.6);
    for (let t = 1; t < trail.length; t++) seg(trail[t - 1], trail[t], 0.18);
    hiGeo.setDrawRange(0, m * 2);
    for (const n of ["position", "color", "a", "t"]) hiGeo.attributes[n].needsUpdate = true;
  };

  // ---------- size, theme, visibility ----------
  const fit = () => {
    W = canvas.clientWidth; H = canvas.clientHeight;
    if (!W || !H) return;
    narrow = W < 760;
    renderer.setPixelRatio(Math.min(coarse ? 1.5 : 2, devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = W / H < 0.9 ? 58 : 42;
    camera.updateProjectionMatrix();
    const px = renderer.getPixelRatio();
    bg.material.uniforms.uRes.value.set(W * px, H * px);
    const scale = H * px * 0.62;
    nMat.uniforms.uScale.value = scale; glowMat.uniforms.uScale.value = scale;
    nMat.uniforms.uMin.value = 2.2 * px; nMat.uniforms.uMax.value = 11 * px;
    starMat.uniforms.uMin.value = 1 * px; starMat.uniforms.uMax.value = 1.6 * px;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  const onTheme = () => {
    light = document.documentElement.dataset.theme === "light";
    uni.uLight.value = light ? 1 : 0;
    paint(); nodeGeo.attributes.color.needsUpdate = true;
    for (let e = 0; e < E; e++) ec.set([...tint(g.edges[e * 3]), ...tint(g.edges[e * 3 + 1])], e * 6);
    edgeGeo.attributes.color.needsUpdate = true;
    glowMat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending; glowMat.needsUpdate = true;
    refreshFocus();
  };
  window.addEventListener("themechange", onTheme);
  let onScreen = true;
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; });
  io.observe(canvas);

  // ---------- frame ----------
  const t0 = performance.now();
  let raf = 0;
  const placed: number[][] = [];
  const free = (b: number[]) => !placed.some((q) => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
  const show = (el: HTMLElement, x: number, y: number, op: number, pad = 8) => {
    const w = el.offsetWidth || 80, h = el.offsetHeight || 20;
    const box = [x - w / 2 - pad, y - h - pad / 2, x + w / 2 + pad, y + pad / 2];
    if (op <= 0.02 || y < 70 || !free(box)) { el.style.opacity = "0"; el.style.pointerEvents = "none"; return false; }
    placed.push(box);
    el.style.opacity = op.toFixed(2);
    el.style.pointerEvents = op > 0.3 && el.tagName === "BUTTON" ? "auto" : "none"; // only branch labels take clicks
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    return true;
  };
  const nearList: [number, number][] = [];

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if ((!onScreen && mode === "loop") || document.hidden) return;
    const sec = still ? 0 : ((now - t0) / 1000) % LOOP;
    const ph = (sec / LOOP) * Math.PI * 2;
    uni.uPh.value = ph;
    bg.material.uniforms.uT.value = still ? 0 : now / 1000;

    // the hero keeps the canopy above the headline; explore centres it (and lifts it above the card on phones)
    const offTarget = mode === "loop" ? (narrow ? 0.3 : 0.28) : narrow && sel >= 0 ? 0.2 : 0;
    offY += (offTarget - offY) * 0.08;
    if (Math.abs(offY) > 0.002) camera.setViewOffset(W, H, 0, H * offY, W, H); else camera.clearViewOffset();

    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.dur), e = ease(k);
      camera.position.lerpVectors(tween.p0, tween.p1 ?? loopPos(ph), e);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      camera.lookAt(controls.target);
      if (k >= 1) tween = null;
    } else if (mode === "loop") {
      loopPos(ph, camera.position);
      controls.target.copy(center);
      camera.lookAt(center);
    } else controls.update();
    camera.updateMatrixWorld();

    if (mode === "explore") {
      if (drifting && now > driftNext) { driftNext = now + 3600; engine.cycle(0); }
      if (now - lastInput > IDLE_MS && sel < 0 && !drifting) { lastInput = now; cb.onIdle(); }
    }

    // labels by level of detail, never under the HUD
    placed.length = 0;
    if (mode === "explore") {
      const cr = canvas.getBoundingClientRect();
      for (const el of labelsEl.parentElement!.querySelectorAll<HTMLElement>(".f3-branches, .f3-card, .f3-top, .f3-mobile, .f3-zoom, .f3-hint")) {
        const b = el.getBoundingClientRect();
        if (b.width) placed.push([b.left - cr.left - 8, b.top - cr.top - 8, b.right - cr.left + 8, b.bottom - cr.top + 8]);
      }
    }
    const explore = mode === "explore";
    const camDist = camera.position.distanceTo(controls.target);
    // 1. the selected link's own name, always
    // 2. names of the nearest links when you are close
    nearList.length = 0;
    if (explore && camDist < R * 1.1) {
      for (let i = 0; i < N; i++) {
        if (!visible(i)) continue;
        const d = camera.position.distanceToSquared(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
        if (d < (R * 0.9) ** 2) nearList.push([i, d]);
      }
      nearList.sort((a, b) => a[1] - b[1]);
    }
    const named = sel >= 0 ? [[sel, 0] as [number, number], ...nearList.filter(([i]) => i !== sel)] : nearList;
    let used = 0;
    for (const [i, d] of named) {
      if (used >= NL) break;
      const s = toScreen(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      if (!s.ok) continue;
      const el = nLabels[used];
      if (el.dataset.i !== String(i)) { el.dataset.i = String(i); el.textContent = rows[i]!.n; el.classList.toggle("sel", i === sel); }
      const op = i === sel ? 1 : Math.max(0, Math.min(0.9, 1.4 - Math.sqrt(d) / (R * 0.6)));
      if (show(el, s.x, s.y - drawnRadius(i) - 4, op, 4)) used++;
      else if (i !== sel) continue;
    }
    for (let k = used; k < NL; k++) { nLabels[k].style.opacity = "0"; nLabels[k].dataset.i = ""; }
    // 3. sub-branches at middle distance
    for (const { s, el } of sLabels) {
      const sc = toScreen(s.c[0], s.c[1], s.c[2]);
      const d = camera.position.distanceTo(v.set(s.c[0], s.c[1], s.c[2]));
      const op = explore && sc.ok && (!fb() || fb() === s.b) ? Math.max(0, Math.min(0.8, (R * 1.5 - d) / (R * 0.5))) * Math.min(1, (d - 3) / 4) : 0;
      show(el, sc.x, sc.y, op, 6);
    }
    // 4. branches from afar
    for (const { b, el } of bLabels) {
      const sc = toScreen(b.c[0], b.c[1] + b.r * 1.15, b.c[2]);
      const d = camera.position.distanceTo(v.set(b.c[0], b.c[1], b.c[2]));
      const op = explore && sc.ok ? Math.max(0, Math.min(1, (d - R * 0.5) / (R * 0.6))) * (fb() && fb() !== b.id ? 0.35 : 1) : 0;
      show(el, sc.x, sc.y, op, 10);
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  // what you see: filtered-out lights nearly vanish; outside a zoomed branch they dim but stay live
  const applyAlpha = () => {
    for (let i = 0; i < N; i++) {
      const r = rows[i];
      na[i] = !r ? 0.2 : vis[i] < 0.5 ? 0.1 : zoomBranch && r.b !== zoomBranch ? 0.3 : 1;
    }
    nodeGeo.attributes.alpha.needsUpdate = true;
    for (let e = 0; e < E; e++) {
      const a = g.edges[e * 3], b = g.edges[e * 3 + 1];
      const both = na[a] > 0.9 && na[b] > 0.9, any = na[a] > 0.25 && na[b] > 0.25;
      ea[e * 2] = ea[e * 2 + 1] = edgeBase[e] * (both ? 1 : any ? 0.3 : 0.12);
    }
    edgeGeo.attributes.a.needsUpdate = true;
    refreshFocus();
  };
  const setZoom = (b: string | null) => {
    if (zoomBranch === b) return;
    zoomBranch = b;
    applyAlpha();
    cb.onZoom(b);
  };
  const related = (i: number): Related[] => adj[i].filter(([j]) => rows[j]).slice(0, 6).map(([j, s]) => ({ row: rows[j]!, s }));

  const engine: Engine = {
    select(i, fly = true) {
      lastInput = performance.now();
      if (i < 0 || !rows[i]) { sel = -1; refreshFocus(); cb.onSelect(null, [], trail.length > 1); return; }
      if (sel >= 0 && sel !== i) trail.push(sel);
      if (trail.length > 24) trail.shift();
      sel = i;
      if (zoomBranch && rows[i]!.b !== zoomBranch) setZoom(rows[i]!.b);
      refreshFocus();
      if (fly) flyTo(P(i), narrow ? 13 : 10);
      cb.onSelect(rows[i], related(i), trail.length > 0);
    },
    selectId(id) { const i = g.ids.indexOf(id); if (i >= 0) engine.select(i); },
    flyToBranch(id) {
      lastInput = performance.now();
      const b = g.branches.find((x) => x.id === id);
      if (!b) return;
      setZoom(id);
      flyTo(new THREE.Vector3(b.c[0], b.c[1], b.c[2]), b.r * 2.6 + 7);
    },
    overview() {
      lastInput = performance.now();
      engine.select(-1);
      setZoom(null);
      flyTo(center, dist0() * 0.85);
    },
    surprise() {
      const pool: number[] = [];
      for (let i = 0; i < N; i++) if (visible(i) && i !== sel && (!zoomBranch || rows[i]!.b === zoomBranch)) pool.push(i);
      if (pool.length) engine.select(pool[Math.floor(Math.random() * pool.length)]);
    },
    // spatial navigation: the related or nearby link best aligned with the direction pressed
    move(dx, dy) {
      lastInput = performance.now();
      if (sel < 0) {
        let best = -1, bd = Infinity;
        for (let i = 0; i < N; i++) {
          if (!visible(i)) continue;
          const s = toScreen(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          if (!s.ok) continue;
          const d = Math.hypot(s.x - W / 2, s.y - H / 2);
          if (d < bd) { bd = d; best = i; }
        }
        if (best >= 0) engine.select(best);
        return;
      }
      const o = toScreen(pos[sel * 3], pos[sel * 3 + 1], pos[sel * 3 + 2]);
      const cand = new Set<number>(adj[sel].map(([j]) => j));
      const here = P(sel);
      const near: [number, number][] = [];
      for (let i = 0; i < N; i++) if (i !== sel && visible(i)) near.push([i, here.distanceToSquared(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]))]);
      near.sort((a, b) => a[1] - b[1]);
      for (const [i] of near.slice(0, 30)) cand.add(i);
      let best = -1, bestScore = Infinity;
      for (const j of cand) {
        if (!visible(j)) continue;
        const s = toScreen(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
        if (!s.ok) continue;
        const vx = s.x - o.x, vy = s.y - o.y, len = Math.hypot(vx, vy);
        if (len < 4) continue;
        const cos = (vx * dx + vy * dy) / len;
        if (cos < 0.45) continue;
        const sim = adj[sel].find(([k]) => k === j)?.[1] || 0;
        const score = (len / Math.max(W, H)) * (2.2 - cos) * (1 - sim * 0.8);
        if (score < bestScore) { bestScore = score; best = j; }
      }
      if (best >= 0) engine.select(best);
    },
    // walk the relations: +1/-1 through the list, 0 = a weighted step for drift
    cycle(d) {
      if (sel < 0) return engine.surprise();
      const list = adj[sel].filter(([j]) => visible(j));
      if (!list.length) return engine.surprise();
      if (d === 0) {
        const fresh = list.filter(([j]) => !trail.includes(j));
        const pool = fresh.length ? fresh : list;
        const total = pool.reduce((s, [, w]) => s + w, 0);
        let r = Math.random() * total;
        for (const [j, w] of pool) { r -= w; if (r <= 0) return engine.select(j); }
        return engine.select(pool[0][0]);
      }
      const prev = trail[trail.length - 1];
      const at = Math.max(0, list.findIndex(([j]) => j === prev));
      engine.select(list[(at + d + list.length) % list.length][0]);
    },
    back() {
      const prev = trail.pop();
      if (prev === undefined) return;
      sel = -1; // so select() doesn't push the current link back onto the trail
      engine.select(prev);
    },
    drift(on) {
      drifting = on ?? !drifting;
      driftNext = performance.now() + 400;
      cb.onDrift(drifting);
      return drifting;
    },
    nextMatch() {
      if (!matchList.length) return;
      matchAt = (matchAt + 1) % matchList.length;
      engine.select(matchList[matchAt]);
    },
    setExplore(on) {
      lastInput = performance.now();
      if (on && mode === "loop") {
        mode = "explore";
        controls.target.copy(center);
        controls.enabled = true;
      } else if (!on && mode === "explore") {
        mode = "loop";
        controls.enabled = false;
        drifting = false;
        trail.length = 0;
        setZoom(null);
        engine.select(-1);
        tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: null, t1: center.clone(), start: performance.now(), dur: 1800 };
      }
      setTimeout(fit, 40);
    },
    setFilter(m, f) {
      focusBranch = f;
      matchList = []; matchAt = -1;
      for (let i = 0; i < N; i++) {
        const r = rows[i];
        const on = !!r && (!f || r.b === f) && (!m || m.has(r.i));
        vis[i] = on ? 1 : 0;
        if (on && m) matchList.push(i);
      }
      applyAlpha();
    },
    zoomedBranch: () => zoomBranch,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener("themechange", onTheme);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
      controls.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); });
      renderer.dispose();
      labelsEl.innerHTML = "";
    },
  };
  fit();
  if (process.env.NODE_ENV !== "production") {
    // test hook: where each light is drawn right now, so tests can click it exactly
    (window as unknown as { __f3?: unknown }).__f3 = {
      n: N,
      at: (i: number) => { const r = canvas.getBoundingClientRect(); const s = toScreen(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); return { x: r.left + s.x, y: r.top + s.y, ok: s.ok && visible(i), name: rows[i]?.n, r: drawnRadius(i) }; },
      pick: (x: number, y: number, asTouch = false) => { const r = canvas.getBoundingClientRect(); const t = touch; touch = asTouch; const out = pickAt(x - r.left, y - r.top); touch = t; return out; },
      branchAt: (id: string) => { const b = g.branches.find((q) => q.id === id)!; const r = canvas.getBoundingClientRect(); const s = toScreen(b.c[0], b.c[1], b.c[2]); return { x: r.left + s.x, y: r.top + s.y }; },
      zoomed: () => zoomBranch,
      busy: () => !!tween || Math.abs(offY - (mode === "loop" ? (narrow ? 0.3 : 0.28) : narrow && sel >= 0 ? 0.2 : 0)) > 0.002,
    };
  }
  return engine;
}

export default function Field3D({ rows, branches, match, focus, query, onQuery, subName, children, fallback }: Props) {
  const wrap = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [explore, setExplore] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sel, setSel] = useState<{ row: Row; related: Related[]; canBack: boolean } | null>(null);
  const [drifting, setDrifting] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const filter = useRef({ match, focus });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.b, (m.get(r.b) || 0) + 1);
    return m;
  }, [rows]);
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.i, r])), [rows]);

  useEffect(() => {
    fetch("/api/graph.json").then((r) => (r.ok ? r.json() : Promise.reject())).then(setGraph).catch(() => setFailed(true));
  }, []);

  const enter = useCallback(() => {
    const el = wrap.current;
    if (!el || el.classList.contains("explore")) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--ct", `${Math.max(0, r.top)}px`);
    el.style.setProperty("--cb", `${Math.max(0, innerHeight - r.bottom)}px`);
    setExplore(true);
  }, []);
  const exit = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setClosing(false); setExplore(false); }, 420);
  }, []);

  useEffect(() => {
    if (!graph || !canvas.current) return;
    const e = createEngine(canvas.current, labels.current!, tip.current!, graph, rowsById, branches, {
      onSelect: (row, related, canBack) => setSel(row ? { row, related, canBack } : null),
      onEnter: () => enter(),
      onIdle: () => exit(),
      onDrift: setDrifting,
      onZoom: setZoomed,
    });
    if (!e) { queueMicrotask(() => setFailed(true)); return; }
    engine.current = e;
    e.setFilter(filter.current.match, filter.current.focus);
    return () => { e.dispose(); engine.current = null; };
  }, [graph, rowsById, branches, enter, exit]);

  useEffect(() => { filter.current = { match, focus }; engine.current?.setFilter(match, focus); }, [match, focus]);

  useEffect(() => {
    engine.current?.setExplore(explore);
    document.documentElement.classList.toggle("f3-lock", explore);
    if (!explore) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea");
      const g = engine.current;
      if (!g) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (typing) (e.target as HTMLElement).blur();
        else if (sel) g.select(-1);
        else if (g.zoomedBranch()) g.overview();
        else exit();
        return;
      }
      if (typing) { if (e.key === "Enter") { e.preventDefault(); g.nextMatch(); } return; }
      const k = e.key;
      if (k === " ") { e.preventDefault(); g.surprise(); }
      else if (k === "ArrowRight") { e.preventDefault(); g.move(1, 0); }
      else if (k === "ArrowLeft") { e.preventDefault(); g.move(-1, 0); }
      else if (k === "ArrowUp") { e.preventDefault(); g.move(0, -1); }
      else if (k === "ArrowDown") { e.preventDefault(); g.move(0, 1); }
      else if (k === "Tab") { e.preventDefault(); g.cycle(e.shiftKey ? -1 : 1); }
      else if (k === "Backspace" || k.toLowerCase() === "b") { e.preventDefault(); g.back(); }
      else if (k.toLowerCase() === "d") g.drift();
      else if (k.toLowerCase() === "h") g.overview();
      else if (k === "Enter" && sel) window.location.href = `/${sel.row.i}`;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [explore, sel, exit]);

  if (failed) return <>{fallback}</>;
  const s = sel?.row;
  const sColor = s ? branches.find((b) => b.id === s.b)?.color : undefined;

  return (
    <div className="f3-slot">
      <section ref={wrap} className={`stage f3 ${explore ? "explore" : ""} ${closing ? "closing" : ""}`}>
        <canvas ref={canvas} aria-label="A 3D map of every link in the library and how they relate" role="img" />
        <div ref={labels} className="f3-labels" aria-hidden={!explore} />
        <div ref={tip} className="f3-tip" style={{ display: "none" }} />
        {!explore && (
          <>
            <div className="veil" />
            <div className="copy">
              {children}
              <div className="f3-cta">
                <button className="pill" onClick={enter}>Explore the tree</button>
                <button className="pill ghost" onClick={() => { enter(); setTimeout(() => engine.current?.surprise(), 160); }}>Surprise me</button>
              </div>
            </div>
          </>
        )}
        {explore && (
          <div className="f3-hud">
            <div className="f3-top">
              <label className="f3-search">
                <SearchIcon size={16} />
                <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search, then Enter to fly through results" spellCheck={false} />
              </label>
              <button className="pill" onClick={() => engine.current?.surprise()}>Surprise <kbd>Space</kbd></button>
              <button className="pill ghost" aria-pressed={drifting} onClick={() => engine.current?.drift()}>Drift <kbd>D</kbd></button>
              <button className="pill ghost" onClick={() => engine.current?.overview()}>Overview <kbd>H</kbd></button>
              <button className="pill icon-btn" onClick={exit} aria-label="Close explorer"><XIcon size={16} /></button>
            </div>
            {zoomed && (
              <div className="f3-zoom">
                <button className="pill sm" onClick={() => engine.current?.overview()} aria-label="Back to all branches">‹ All branches</button>
                <span className="f3-zoom-name"><span className="swatch" style={{ "--c": branches.find((b) => b.id === zoomed)?.color } as React.CSSProperties} />{branches.find((b) => b.id === zoomed)?.name}<span className="n mono">{counts.get(zoomed)}</span></span>
              </div>
            )}
            <nav className="f3-branches" aria-label="Branches">
              <div className="eyebrow">Branches</div>
              {branches.filter((b) => counts.get(b.id)).map((b) => (
                <button key={b.id} aria-pressed={focus === b.id || zoomed === b.id} onClick={() => engine.current?.flyToBranch(b.id)}>
                  <span className="swatch" style={{ "--c": b.color } as React.CSSProperties} />{b.name}<span className="n">{counts.get(b.id)}</span>
                </button>
              ))}
            </nav>
            {s ? (
              <article className="f3-card" style={{ "--c": sColor } as React.CSSProperties}>
                <div className="head">
                  <Favicon host={s.h} name={s.n} />
                  <div style={{ minWidth: 0 }}>
                    <h3>{s.n}</h3>
                    <div className="host mono">{s.h}</div>
                  </div>
                  <button className="pill icon-btn sm" onClick={() => engine.current?.select(-1)} aria-label="Close"><XIcon size={14} /></button>
                </div>
                {s.d && <p>{s.d}</p>}
                <div className="foot"><span className="swatch" /> {subName(s)} <span className="tag">{KIND_LABEL[s.k]}</span></div>
                <div className="actions">
                  {s.u && <a className="pill accent" href={s.u} target="_blank" rel="noopener">Open <ArrowIcon size={14} /></a>}
                  <Link className="pill" href={`/${s.i}`}>Details</Link>
                  <span className="spacer" />
                  {sel.canBack && <button className="pill ghost sm" onClick={() => engine.current?.back()} aria-label="Back">← Back</button>}
                </div>
                {sel.related.length > 0 && (
                  <div className="f3-related">
                    <div className="eyebrow">Related</div>
                    <div className="list">
                      {sel.related.map(({ row, s: sim }, k, all) => (
                        <button key={row.i} onClick={() => engine.current?.selectId(row.i)} style={{ "--c": branches.find((b) => b.id === row.b)?.color } as React.CSSProperties}>
                          <span className="swatch" />
                          <span className="nm">{row.n}</span>
                          <span className="bar" title={`${Math.round(sim * 100)}% similar`}><i style={{ width: `${Math.round((sim / all[0].s) * 100)}%` }} /></span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ) : (
              <p className="f3-hint mono">
                <span className="for-mouse">{zoomed ? "click a light to open it · click another cluster to move · esc for all branches" : "click a light to open it · click a cluster to zoom in · arrows travel · tab relations · D drift"}</span>
                <span className="for-touch">{zoomed ? "tap a light to open it · tap another cluster to move · ‹ All branches to zoom out" : "tap a light to open it · tap a cluster to zoom in · pinch to zoom · drag to turn"}</span>
              </p>
            )}
            {!s && (
              <div className="f3-mobile">
                <p className="mono">{zoomed ? "tap a light · tap another cluster to move" : "tap a light · tap a cluster to zoom in · pinch · drag"}</p>
                <nav className="f3-rail" aria-label="Branches">
                  {branches.filter((b) => counts.get(b.id)).map((b) => (
                    <button key={b.id} className="pill sm" onClick={() => engine.current?.flyToBranch(b.id)}>
                      <span className="swatch" style={{ "--c": b.color } as React.CSSProperties} />{b.name}<span className="n">{counts.get(b.id)}</span>
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
