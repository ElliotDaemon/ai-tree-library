"use client";
// The Field, in 3D. Two states:
//   loop    — the hero: the camera rides a closed path and every motion is a function of one phase,
//             so the scene repeats seamlessly every LOOP seconds. Scrolling the page is never captured.
//   explore — full screen: orbit, zoom, fly to branches, step through links, "surprise me".
//             Leave it alone for a while and it eases back into the loop.
// One draw call for all links; colour flows through them in a slow iridescent wave.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { layout3d } from "@/lib/canopy3d";
import type { Row } from "@/lib/types";
import { Favicon, KIND_LABEL } from "./Card";
import { ArrowIcon, SearchIcon, XIcon } from "./Icons";

export interface FieldBranch { id: string; name: string; color: string }
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
interface Engine {
  select: (i: number) => void;
  flyToCrown: (c: number) => void;
  overview: () => void;
  surprise: () => void;
  step: (d: number) => void;
  crownStep: (d: number) => void;
  setExplore: (on: boolean) => void;
  setFilter: (m: Set<string> | null, f: string) => void;
  dispose: () => void;
}

const LOOP = 48; // seconds for one perfect loop
const IDLE_MS = 30_000;

const NEBULA_VS = `void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const NEBULA_FS = `
precision highp float;
uniform vec2 uRes; uniform float uPh; uniform float uLight;
float h(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*n(p); p=p*2.03+1.7; a*=.5; } return s; }
void main(){
  vec2 uv = (gl_FragCoord.xy - .5*uRes)/uRes.y;
  // a circle through noise space: the drift returns exactly to its start every loop
  vec3 q = vec3(uv*1.6, 0.) + vec3(cos(uPh), sin(uPh), 0.)*.55;
  float a = fbm(q + fbm(q*1.7 + 3.1));
  float b = fbm(q*2.3 - 5.7);
  vec3 c1 = vec3(.16,.05,.32), c2 = vec3(.02,.20,.30), c3 = vec3(.32,.06,.18);
  vec3 col = mix(mix(c1, c2, smoothstep(.3,.8,a)), c3, smoothstep(.55,.95,b)*.7);
  float glow = smoothstep(1.2, .0, length(uv - vec2(0., .05)));
  col *= (.18 + .55*glow) * (.65 + .7*a);
  if (uLight > .5) { col = vec3(.86,.86,.875) + (col - vec3(.06,.05,.1))*.55 + vec3(.03,.0,.06)*glow; }
  gl_FragColor = vec4(col, 1.);
}`;

const PTS_VS = `
uniform float uPh; uniform float uPx; uniform float uPsy; uniform float uMax;
attribute vec3 color; attribute float size; attribute float alpha; attribute float seed;
varying vec3 vColor; varying float vAlpha;
void main(){
  vec3 p = position;
  float s6 = seed*6.2831853;
  p += .32*vec3(sin(uPh + s6), sin(2.*uPh + s6*1.7), cos(uPh + s6*1.3));
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float beat = 1. + .18*sin(3.*uPh + s6);
  gl_PointSize = min(uMax, size * beat * uPx / max(.5, -mv.z));
  float wave = .5 + .5*sin(dot(position, vec3(.09,.13,.07))*2.6 - 2.*uPh);
  vec3 rainbow = .55 + .45*cos(6.2831853*(vec3(0.,.33,.67) + wave + seed*.12) + uPh);
  vColor = mix(color, rainbow, uPsy*(.3 + .4*wave));
  vAlpha = alpha;
}`;
const PTS_FS = `
precision highp float;
uniform float uLight;
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - .5);
  if (d > .5) discard;
  float core = smoothstep(.2, .0, d);
  float halo = pow(smoothstep(.5, .0, d), 1.5);
  if (uLight > .5) { vec3 v = mix(vColor, vColor*vColor, .35)*1.05; gl_FragColor = vec4(mix(v, vec3(1.), core*.35), (core*.95 + halo*.5)*vAlpha); return; }
  vec3 c = vColor*halo*1.1 + mix(vColor, vec3(1.), .55)*core;
  gl_FragColor = vec4(c*vAlpha, 1.);
}`;

const LINE_VS = `
attribute float t; attribute vec3 color; varying float vT; varying vec3 vColor;
void main(){ vT = t; vColor = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const LINE_FS = `
precision highp float;
uniform float uPh; uniform float uLight; uniform float uBase;
varying float vT; varying vec3 vColor;
void main(){
  // energy rising from the root: three pulses per loop
  float pulse = pow(.5 + .5*sin(vT*12.566 - 3.*uPh), 10.);
  float a = uBase + pulse*.55*smoothstep(0., .15, vT);
  if (uLight > .5) { gl_FragColor = vec4(vColor*.6, a*.9); return; }
  gl_FragColor = vec4(vColor*a, 1.);
}`;

const RING_FS = `
precision highp float;
uniform float uPh;
void main(){
  float d = length(gl_PointCoord - .5);
  float r = .38 + .04*sin(uPh*6.);
  float ring = smoothstep(.03, .0, abs(d - r));
  if (ring < .01) discard;
  gl_FragColor = vec4(vec3(1.), ring);
}`;

function hex(c: string) { const n = parseInt(c.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
const ease = (k: number) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

function createEngine(
  canvas: HTMLCanvasElement,
  labelsEl: HTMLDivElement,
  tipEl: HTMLDivElement,
  rows: Row[],
  branches: FieldBranch[],
  cb: { onSelect: (r: Row | null) => void; onEnter: () => void; onIdle: () => void; onActivity: () => void },
): Engine | null {
  let renderer: THREE.WebGLRenderer;
  const coarse = matchMedia("(pointer: coarse)").matches;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse || devicePixelRatio < 2, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let light = document.documentElement.dataset.theme === "light";
  const L = layout3d(rows.map((r) => ({ ...r })), branches);
  const center = new THREE.Vector3(0, L.crowns.reduce((s, c) => s + c.y, 0) / Math.max(1, L.crowns.length), 0);
  const dist0 = L.radius * 1.9 + 7;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 4000);
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.5;
  controls.maxDistance = dist0 * 2.2;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.9;

  const uni = { uPh: { value: 0 }, uLight: { value: light ? 1 : 0 } };

  // nebula backdrop
  const nebula = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: NEBULA_VS, fragmentShader: NEBULA_FS, depthWrite: false, depthTest: false, uniforms: { ...uni, uRes: { value: new THREE.Vector2(1, 1) } } }),
  );
  nebula.frustumCulled = false;
  nebula.renderOrder = -1;
  scene.add(nebula);

  // dust for depth
  const DUST = coarse ? 1100 : 2400;
  const dp = new Float32Array(DUST * 3), dc = new Float32Array(DUST * 3), ds = new Float32Array(DUST), da = new Float32Array(DUST), dseed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const r = L.radius * (1.4 + Math.random() * 2.6), t = Math.random() * 6.283, v = Math.random() * 2 - 1, ring = Math.sqrt(1 - v * v);
    dp.set([Math.cos(t) * ring * r, center.y + v * r * 0.7, Math.sin(t) * ring * r], i * 3);
    dc.set([0.75, 0.8, 1], i * 3); ds[i] = 0.8 + Math.random() * 1.6; da[i] = 0.12 + Math.random() * 0.25; dseed[i] = Math.random();
  }
  const ptsMat = (size: number) => new THREE.ShaderMaterial({
    vertexShader: PTS_VS, fragmentShader: PTS_FS, transparent: true, depthWrite: false,
    blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
    uniforms: { ...uni, uPx: { value: size }, uPsy: { value: 1 }, uMax: { value: 40 } },
  });
  const geo = (p: Float32Array, c: Float32Array, s: Float32Array, a: Float32Array, sd: Float32Array) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    g.setAttribute("size", new THREE.BufferAttribute(s, 1));
    g.setAttribute("alpha", new THREE.BufferAttribute(a, 1));
    g.setAttribute("seed", new THREE.BufferAttribute(sd, 1));
    return g;
  };
  const dustMat = ptsMat(200);
  dustMat.uniforms.uPsy.value = 0.5;
  const dust = new THREE.Points(geo(dp, dc, ds, da, dseed), dustMat);
  scene.add(dust);

  // trunk: one curve per crown, pulses climbing it
  const SEG = 48;
  const lp: number[] = [], lt: number[] = [], lc: number[] = [];
  const root = new THREE.Vector3(L.root.x, L.root.y, L.root.z);
  for (const c of L.crowns) {
    const end = new THREE.Vector3(c.x, c.y - c.R * 0.6, c.z);
    const curve = new THREE.CubicBezierCurve3(root, new THREE.Vector3(0, root.y + (end.y - root.y) * 0.55, 0), new THREE.Vector3(c.x * 0.6, end.y - c.R * 2.2, c.z * 0.6), end);
    const pts = curve.getPoints(SEG);
    const col = hex(c.color);
    for (let s = 0; s < SEG; s++) {
      lp.push(pts[s].x, pts[s].y, pts[s].z, pts[s + 1].x, pts[s + 1].y, pts[s + 1].z);
      lt.push(s / SEG, (s + 1) / SEG);
      lc.push(...col, ...col);
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
  lg.setAttribute("t", new THREE.Float32BufferAttribute(lt, 1));
  lg.setAttribute("color", new THREE.Float32BufferAttribute(lc, 3));
  const lineMat = new THREE.ShaderMaterial({ vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false, blending: light ? THREE.NormalBlending : THREE.AdditiveBlending, uniforms: { ...uni, uBase: { value: 0.1 } } });
  scene.add(new THREE.LineSegments(lg, lineMat));

  // the links
  const N = L.rows.length;
  const pc = new Float32Array(N * 3), ps = new Float32Array(N), pa = new Float32Array(N), pseed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const row = L.rows[i];
    pc.set(hex(L.crowns[L.crownOf[i]].color), i * 3);
    ps[i] = row ? (row.f ? 2.6 : row.g ? 2.1 : 1.6) : 0.9;
    pa[i] = row ? 1 : 0.25;
    pseed[i] = (i * 0.6180339) % 1;
  }
  const pg = geo(L.pos, pc, ps, pa, pseed);
  const pMat = ptsMat(320);
  scene.add(new THREE.Points(pg, pMat));

  // selection ring + lines to its neighbours
  const ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3), 3));
  const ringMat = new THREE.ShaderMaterial({ vertexShader: `uniform float uPx; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = min(90., uPx/max(.5,-mv.z)); }`, fragmentShader: RING_FS, transparent: true, depthTest: false, uniforms: { ...uni, uPx: { value: 2600 } } });
  const ring = new THREE.Points(ringGeo, ringMat);
  ring.visible = false;
  scene.add(ring);
  const nGeo = new THREE.BufferGeometry();
  nGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 6), 3));
  nGeo.setAttribute("t", new THREE.BufferAttribute(new Float32Array(16 * 2), 1));
  nGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(16 * 6).fill(1), 3));
  const nMat = new THREE.ShaderMaterial({ vertexShader: LINE_VS, fragmentShader: LINE_FS, transparent: true, depthWrite: false, blending: light ? THREE.NormalBlending : THREE.AdditiveBlending, uniforms: { ...uni, uBase: { value: 0.35 } } });
  const nLines = new THREE.LineSegments(nGeo, nMat);
  nLines.visible = false;
  scene.add(nLines);

  // DOM labels, one per crown
  labelsEl.innerHTML = "";
  const labels = L.crowns.map((c, ci) => {
    const b = document.createElement("button");
    b.className = "f3-label";
    b.style.setProperty("--c", c.color);
    b.innerHTML = `<i></i>${c.name}<span>${c.n}</span>`;
    b.onclick = (e) => { e.stopPropagation(); cb.onEnter(); engine.flyToCrown(ci); };
    labelsEl.appendChild(b);
    return b;
  });

  // ---------- camera ----------
  let mode: "loop" | "explore" = "loop";
  let tween: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3 | null; t1: THREE.Vector3; start: number; dur: number } | null = null;
  let sel = -1;
  let offY = 0.23, narrow = false;
  let focusId = "";
  let lastInput = performance.now();
  const loopPos = (ph: number, out = new THREE.Vector3()) =>
    out.set(Math.cos(ph) * dist0 * (narrow ? 1.5 : 1.12), center.y + L.radius * 0.38 + Math.sin(2 * ph) * L.radius * 0.18, Math.sin(ph) * dist0 * (narrow ? 1.5 : 1.12));
  camera.position.copy(loopPos(0));
  camera.lookAt(center);

  const flyTo = (target: THREE.Vector3, distance: number, dur = 1300) => {
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (!isFinite(dir.x) || dir.lengthSq() < 0.5) dir.set(0.4, 0.3, 1).normalize();
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: target.clone().add(dir.multiplyScalar(distance)), t1: target.clone(), start: performance.now(), dur };
  };
  const pointPos = (i: number) => new THREE.Vector3(L.pos[i * 3], L.pos[i * 3 + 1], L.pos[i * 3 + 2]);

  // ---------- picking (screen space) ----------
  const v = new THREE.Vector3(), tmp = new THREE.Vector3();
  const byCount = L.crowns.map((_, i) => i).sort((a, b) => L.crowns[b].n - L.crowns[a].n);
  let hover = -1, mx = -1, my = -1, pending = false;
  let touch = false;
  const pick = () => {
    pending = false;
    const r = canvas.getBoundingClientRect();
    const reach = touch ? 30 : 18;
    let best = -1, bd = reach * reach;
    for (let i = 0; i < N; i++) {
      if (!L.rows[i] || pa[i] < 0.3) continue;
      v.set(L.pos[i * 3], L.pos[i * 3 + 1], L.pos[i * 3 + 2]).project(camera);
      if (v.z > 1) continue;
      const dx = (v.x * 0.5 + 0.5) * r.width - mx, dy = (-v.y * 0.5 + 0.5) * r.height - my;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    }
    hover = best;
    canvas.style.cursor = best >= 0 ? "pointer" : mode === "explore" ? "grab" : "zoom-in";
    if (best >= 0 && !touch) {
      const row = L.rows[best]!;
      tipEl.style.display = "block";
      tipEl.style.transform = `translate(${mx}px, ${my}px)`;
      tipEl.innerHTML = `<b>${esc(row.n)}</b><span>${esc(row.h)}</span>`;
    } else tipEl.style.display = "none";
  };
  let downX = 0, downY = 0;
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
    if (!pending) { pending = true; requestAnimationFrame(pick); }
  };
  const onDown = (e: PointerEvent) => { touch = e.pointerType !== "mouse"; downX = e.clientX; downY = e.clientY; lastInput = performance.now(); cb.onActivity(); tween = null; };
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > (touch ? 10 : 6)) return; // that was a drag
    const r = canvas.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top;
    pick();
    if (mode === "loop") cb.onEnter();
    if (hover >= 0) engine.select(hover);
  };
  const onLeave = () => { hover = -1; tipEl.style.display = "none"; };
  const onWheel = () => { lastInput = performance.now(); tween = null; };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: true });

  // ---------- size, theme, visibility ----------
  const fit = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(coarse ? 1.5 : 1.75, devicePixelRatio || 1));
    narrow = w < 760;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole canopy in frame on narrow screens
    camera.fov = w / h < 0.9 ? 64 : 48;
    camera.updateProjectionMatrix();
    const px = renderer.getPixelRatio();
    nebula.material.uniforms.uRes.value.set(w * px, h * px);
    pMat.uniforms.uPx.value = h * px * 0.8;
    pMat.uniforms.uMax.value = (coarse ? 22 : 34) * px;
    dustMat.uniforms.uMax.value = 6 * px;
    dustMat.uniforms.uPx.value = h * px * 0.35;
    ringMat.uniforms.uPx.value = h * px * 1.6;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  const onTheme = () => {
    light = document.documentElement.dataset.theme === "light";
    uni.uLight.value = light ? 1 : 0;
    for (const m of [pMat, dustMat, lineMat, nMat]) { m.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending; m.needsUpdate = true; }
  };
  window.addEventListener("themechange", onTheme);
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);

  // ---------- frame ----------
  const t0 = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if ((!visible && mode === "loop") || document.hidden) return;
    const sec = still ? 0 : ((now - t0) / 1000) % LOOP;
    const ph = (sec / LOOP) * Math.PI * 2;
    uni.uPh.value = ph;

    offY += ((mode === "loop" ? (narrow ? 0.3 : 0.23) : narrow ? (sel >= 0 ? 0.2 : 0.1) : 0) - offY) * 0.06;
    if (Math.abs(offY) > 0.001) camera.setViewOffset(canvas.clientWidth, canvas.clientHeight, 0, canvas.clientHeight * offY, canvas.clientWidth, canvas.clientHeight);
    else camera.clearViewOffset();
    if (tween) {
      const k = Math.min(1, (now - tween.start) / tween.dur), e = ease(k);
      const p1 = tween.p1 ?? loopPos(ph);
      camera.position.lerpVectors(tween.p0, p1, e);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      camera.lookAt(controls.target);
      if (k >= 1) tween = null;
    } else if (mode === "loop") {
      loopPos(ph, camera.position);
      controls.target.copy(center);
      camera.lookAt(center);
    }
    if (mode === "explore") {
      if (!tween) controls.update();
      if (now - lastInput > IDLE_MS && sel < 0) { lastInput = now; cb.onIdle(); }
    }

    // labels: none in the hero loop; in explore, biggest crowns first and never overlapping
    const r = canvas.getBoundingClientRect();
    const placed: number[][] = [];
    for (const ci of byCount) {
      const c = L.crowns[ci], el = labels[ci];
      v.set(c.x, c.y + c.R + 0.9, c.z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * r.width, sy = (-v.y * 0.5 + 0.5) * r.height;
      const d = camera.position.distanceTo(tmp.set(c.x, c.y, c.z));
      let op = mode === "loop" || v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05 ? 0 : Math.max(0, Math.min(1, 1.7 - d / (dist0 * 1.1))) * (c.n ? 1 : 0.5) * (focusId && focusId !== c.id ? 0.3 : 1);
      const w = el.offsetWidth || 120, box = [sx - w / 2, sy - 24, sx + w / 2, sy];
      if (sy < 78) op = 0; // keep clear of the search bar
      if (op > 0 && placed.some((q) => box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1])) op = 0;
      if (op > 0.05) placed.push(box);
      el.style.opacity = op.toFixed(2);
      el.style.pointerEvents = op > 0.25 ? "auto" : "none";
      el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
    }
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  const engine: Engine = {
    select(i) {
      lastInput = performance.now();
      sel = i;
      if (i < 0 || !L.rows[i]) { ring.visible = false; nLines.visible = false; cb.onSelect(null); return; }
      const p = pointPos(i);
      (ringGeo.attributes.position as THREE.BufferAttribute).set([p.x, p.y, p.z]);
      ringGeo.attributes.position.needsUpdate = true;
      ring.visible = true;
      // threads to the nearest links in the same sub-branch
      const row = L.rows[i]!;
      const near = L.rows
        .map((r, j) => [j, r] as const)
        .filter(([j, r]) => j !== i && r && r.b === row.b && r.s === row.s)
        .map(([j]) => [j, pointPos(j).distanceTo(p)] as const)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 16);
      const arr = nGeo.attributes.position.array as Float32Array, ta = nGeo.attributes.t.array as Float32Array, ca = nGeo.attributes.color.array as Float32Array;
      arr.fill(0); ta.fill(0);
      const col = hex(L.crowns[L.crownOf[i]].color);
      near.forEach(([j], k) => {
        arr.set([p.x, p.y, p.z, L.pos[j * 3], L.pos[j * 3 + 1], L.pos[j * 3 + 2]], k * 6);
        ta.set([0, 1], k * 2);
        ca.set([...col, ...col], k * 6);
      });
      nGeo.attributes.position.needsUpdate = nGeo.attributes.t.needsUpdate = nGeo.attributes.color.needsUpdate = true;
      nGeo.setDrawRange(0, near.length * 2);
      nLines.visible = near.length > 0;
      flyTo(p, (10 + L.crowns[L.crownOf[i]].R * 0.9) * (narrow ? 1.35 : 1));
      cb.onSelect(row);
    },
    flyToCrown(ci) {
      lastInput = performance.now();
      const c = L.crowns[ci];
      flyTo(new THREE.Vector3(c.x, c.y, c.z), c.R * 3.1 + 6);
    },
    overview() {
      lastInput = performance.now();
      engine.select(-1);
      flyTo(center, dist0 * 0.9);
    },
    surprise() {
      const pool: number[] = [];
      for (let i = 0; i < N; i++) if (L.rows[i] && pa[i] > 0.5 && i !== sel) pool.push(i);
      if (pool.length) engine.select(pool[Math.floor(Math.random() * pool.length)]);
    },
    step(d) {
      if (sel < 0) return engine.surprise();
      const ci = L.crownOf[sel];
      const idx: number[] = [];
      for (let i = 0; i < N; i++) if (L.crownOf[i] === ci && L.rows[i] && pa[i] > 0.5) idx.push(i);
      const at = idx.indexOf(sel);
      engine.select(idx[(at + d + idx.length) % idx.length] ?? sel);
    },
    crownStep(d) {
      const live = L.crowns.map((c, i) => [c, i] as const).filter(([c]) => c.n > 0);
      if (!live.length) return;
      const cur = sel >= 0 ? L.crownOf[sel] : -1;
      const at = live.findIndex(([, i]) => i === cur);
      const [, next] = live[(at + d + live.length) % live.length];
      const first = L.crownOf.findIndex((c, i) => c === next && L.rows[i] && pa[i] > 0.5);
      if (first >= 0) engine.select(first); else engine.flyToCrown(next);
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
        engine.select(-1);
        tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: null, t1: center.clone(), start: performance.now(), dur: 1800 };
      }
      setTimeout(fit, 30);
    },
    setFilter(m, f) {
      focusId = f;
      for (let i = 0; i < N; i++) {
        const row = L.rows[i];
        pa[i] = !row ? 0.25 : f && L.crowns[L.crownOf[i]].id !== f ? 0.08 : m ? (m.has(row.i) ? 1 : 0.07) : 1;
      }
      pg.attributes.alpha.needsUpdate = true;
    },
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
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      renderer.dispose();
      labelsEl.innerHTML = "";
    },
  };
  // pointer travel resets the idle timer; dragging, wheel and keys reset it too
  controls.addEventListener("start", () => { lastInput = performance.now(); tween = null; });
  fit();
  return engine;
}

export default function Field3D({ rows, branches, match, focus, query, onQuery, subName, children, fallback }: Props) {
  const wrap = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [explore, setExplore] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);
  const [failed, setFailed] = useState(false);
  const filter = useRef({ match, focus });

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.b, (m.get(r.b) || 0) + 1);
    return m;
  }, [rows]);

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
    const e = createEngine(canvas.current!, labels.current!, tip.current!, rows, branches, {
      onSelect: setSel,
      onEnter: () => enter(),
      onIdle: () => exit(),
      onActivity: () => {},
    });
    if (!e) { queueMicrotask(() => setFailed(true)); return; } // no WebGL: fall back to the flat field
    engine.current = e;
    e.setFilter(filter.current.match, filter.current.focus);
    return () => { e.dispose(); engine.current = null; };
  }, [rows, branches, enter, exit]);

  useEffect(() => { filter.current = { match, focus }; engine.current?.setFilter(match, focus); }, [match, focus]);

  useEffect(() => {
    engine.current?.setExplore(explore);
    document.documentElement.classList.toggle("f3-lock", explore);
    if (!explore) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea");
      if (e.key === "Escape") { e.preventDefault(); if (typing) (e.target as HTMLElement).blur(); else if (sel) engine.current?.select(-1); else exit(); return; }
      if (typing) return;
      const g = engine.current;
      if (!g) return;
      if (e.key === " " || e.key.toLowerCase() === "r") { e.preventDefault(); g.surprise(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); g.step(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); g.step(-1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); g.crownStep(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); g.crownStep(-1); }
      else if (e.key.toLowerCase() === "h") g.overview();
      else if (e.key === "Enter" && sel) window.open(`/${sel.i}`, "_self");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [explore, sel, exit]);

  if (failed) return <>{fallback}</>;

  return (
    <div className="f3-slot">
    <section ref={wrap} className={`stage f3 ${explore ? "explore" : ""} ${closing ? "closing" : ""}`}>
      <canvas ref={canvas} aria-label="A 3D map of every link in the library" role="img" />
      <div ref={labels} className="f3-labels" aria-hidden={!explore} />
      <div ref={tip} className="f3-tip" style={{ display: "none" }} />
      {!explore && (
        <>
          <div className="veil" />
          <div className="copy">
            {children}
            <div className="f3-cta">
              <button className="pill" onClick={enter}>Explore the tree</button>
              <button className="pill ghost" onClick={() => { enter(); setTimeout(() => engine.current?.surprise(), 120); }}>✦ Surprise me</button>
            </div>
          </div>
        </>
      )}
      {explore && (
        <div className="f3-hud">
          <div className="f3-top">
            <label className="f3-search glass">
              <SearchIcon size={16} />
              <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search the tree…" spellCheck={false} />
            </label>
            <button className="pill" onClick={() => engine.current?.surprise()}>✦ Surprise <kbd>Space</kbd></button>
            <button className="pill ghost" onClick={() => engine.current?.overview()}>Overview <kbd>H</kbd></button>
            <button className="pill icon-btn" onClick={exit} aria-label="Close explorer"><XIcon size={16} /></button>
          </div>
          <nav className="f3-branches glass" aria-label="Branches">
            {branches.filter((b) => counts.get(b.id)).map((b) => (
              <button key={b.id} onClick={() => engine.current?.flyToCrown(layoutIndex(rows, branches, b.id))}>
                <span className="swatch" style={{ "--c": b.color } as React.CSSProperties} />{b.name}<span className="n">{counts.get(b.id)}</span>
              </button>
            ))}
          </nav>
          {sel ? (
            <article className="f3-card glass" style={{ "--c": branches.find((b) => b.id === sel.b)?.color } as React.CSSProperties}>
              <div className="head">
                <Favicon host={sel.h} name={sel.n} />
                <div style={{ minWidth: 0 }}>
                  <h3>{sel.n}</h3>
                  <div className="host mono">{sel.h}</div>
                </div>
                <button className="pill icon-btn sm" onClick={() => engine.current?.select(-1)} aria-label="Close"><XIcon size={14} /></button>
              </div>
              {sel.d && <p>{sel.d}</p>}
              <div className="foot"><span className="swatch" /> {subName(sel)} <span className="tag">{KIND_LABEL[sel.k]}</span></div>
              <div className="actions">
                {sel.u && <a className="pill accent" href={sel.u} target="_blank" rel="noopener">Open <ArrowIcon size={14} /></a>}
                <Link className="pill" href={`/${sel.i}`}>Details</Link>
                <span className="spacer" />
                <button className="pill ghost sm" onClick={() => engine.current?.step(-1)} aria-label="Previous in branch">←</button>
                <button className="pill ghost sm" onClick={() => engine.current?.step(1)} aria-label="Next in branch">→</button>
                <button className="pill ghost sm f3-only-touch" onClick={() => engine.current?.surprise()} aria-label="Surprise me">✦</button>
              </div>
            </article>
          ) : (
            <>
              <p className="f3-hint mono">drag to orbit · scroll to zoom · click a light · ← → walk a branch · ↑ ↓ change branch · space to wander</p>
              <div className="f3-mobile">
                <p className="mono">drag to turn · pinch to zoom · tap a light</p>
                <nav className="f3-rail" aria-label="Branches">
                  {branches.filter((b) => counts.get(b.id)).map((b) => (
                    <button key={b.id} className="pill sm" onClick={() => engine.current?.flyToCrown(layoutIndex(rows, branches, b.id))}>
                      <span className="swatch" style={{ "--c": b.color } as React.CSSProperties} />{b.name}<span className="n">{counts.get(b.id)}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </>
          )}
        </div>
      )}
    </section>
    </div>
  );
}

/** The crown index the layout gives a branch (crowns are ordered by size, not by taxonomy). */
function layoutIndex(rows: Row[], branches: FieldBranch[], id: string) {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.b, (counts.get(r.b) || 0) + 1);
  const order = branches.map((b, idx) => ({ b, idx, n: counts.get(b.id) || 0 })).sort((a, z) => z.n - a.n || a.idx - z.idx);
  return order.findIndex((o) => o.b.id === id);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
