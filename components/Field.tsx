"use client";
// The Field: every link in the library as a point of light, grown as a tree.
// Layout is pure arithmetic, so it never needs hand-tuning as the library grows:
//   branches  → crowns packed outward on a golden-angle spiral (stable order, no overlap)
//   links     → sunflower phyllotaxis inside their crown (r ∝ √i, θ = i·golden angle)
//   trunk     → one curve from a shared root to every crown
// Searching or filtering dims what doesn't match, so the field doubles as a live map of the results.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Row } from "@/lib/types";

export interface FieldBranch { id: string; name: string; color: string }
interface Pt { x: number; y: number; r: number; c: number; row: Row | null; ph: number }
interface Crown { id: string; name: string; color: string; x: number; y: number; R: number; n: number }

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function layout(rows: Row[], branches: FieldBranch[]) {
  const unit = 1;
  const by = new Map<string, Row[]>(branches.map((b) => [b.id, []]));
  for (const r of rows) by.get(r.b)?.push(r);
  const crowns: Crown[] = [];
  const pts: Pt[] = [];
  // biggest crown in the middle, the rest packed outward on a wide golden spiral: a canopy
  const order = branches.map((b, bi) => ({ b, bi, list: by.get(b.id) || [] })).sort((a, z) => z.list.length - a.list.length || a.bi - z.bi);
  for (const { b, bi, list } of order) {
    const n = list.length;
    const R = unit * Math.sqrt(n + 6);
    let x = 0, y = 0;
    if (crowns.length) {
      for (let k = 1; k < 20000; k++) {
        const rho = Math.sqrt(k) * 0.6, a = k * GOLDEN;
        x = Math.cos(a) * rho * 1.75;
        y = Math.sin(a) * rho * 0.95;
        if (crowns.every((c) => Math.hypot(c.x - x, c.y - y) > c.R + R + 2.2)) break;
      }
    }
    crowns.push({ id: b.id, name: b.name, color: b.color, x, y, R, n });
    const count = n || 7; // empty branches still show a faint seed
    for (let j = 0; j < count; j++) {
      const rr = unit * 0.95 * Math.sqrt(j + 0.5);
      const th = j * GOLDEN + bi;
      const row = n ? list[j] : null;
      pts.push({ x: x + Math.cos(th) * rr, y: y + Math.sin(th) * rr, r: row?.f ? 2.6 : row?.g ? 2 : row ? 1.6 : 1.1, c: bi, row, ph: (j * 7.13 + bi) % 6.283 });
    }
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of crowns) {
    minX = Math.min(minX, c.x - c.R); maxX = Math.max(maxX, c.x + c.R);
    minY = Math.min(minY, c.y - c.R); maxY = Math.max(maxY, c.y + c.R);
  }
  return { crowns, pts, box: { minX, maxX, minY, maxY } };
}

export default function Field({ rows, branches, match, focus }: { rows: Row[]; branches: FieldBranch[]; match: Set<string> | null; focus: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const state = useRef({ match, focus });
  const router = useRouter();
  useEffect(() => { state.current = { match, focus }; }, [match, focus]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const { crowns, pts, box } = layout(rows, branches);
    const colors = branches.map((b) => b.color);
    const byCount = [...crowns].sort((a, b) => b.n - a.n);
    const font = getComputedStyle(document.body).fontFamily;
    let w = 0, h = 0, dpr = 1, scale = 1, sx = 1, ox = 0, oy = 0, raf = 0, visible = true;
    let mx = -1e4, my = -1e4, px = 0, py = 0, hover: Pt | null = null;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let light = document.documentElement.dataset.theme === "light";

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height; dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = w * dpr; canvas.height = h * dpr;
      const bw = box.maxX - box.minX, bh = box.maxY - box.minY;
      const padX = Math.min(90, w * 0.06), top = 96, bottom = Math.max(250, h * 0.42);
      scale = Math.min((w - padX * 2) / bw, (h - top - bottom) / bh);
      // let the crown spread to the stage's width, up to 1.7× wider than tall
      sx = Math.max(1, Math.min(1.7, (w - padX * 2) / (bw * scale)));
      ox = w / 2 - ((box.minX + box.maxX) / 2) * scale * sx;
      oy = top + (h - top - bottom) / 2 - ((box.minY + box.maxY) / 2) * scale;
    };

    const draw = (t: number) => {
      const { match, focus } = state.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // gentle parallax toward the pointer
      px += ((mx > -1e3 ? (mx - w / 2) / w : 0) * -10 - px) * 0.05;
      py += ((my > -1e3 ? (my - h / 2) / h : 0) * -6 - py) * 0.05;
      const X = (x: number) => ox + x * scale * sx + px;
      const Y = (y: number) => oy + y * scale + py;
      const rootX = w / 2 + px, rootY = h + 40;
      const ink = light ? "11,11,12" : "242,242,240";

      // trunk: one curve from the root to every crown
      ctx.lineWidth = 1;
      for (const c of crowns) {
        const on = !focus || focus === c.id;
        ctx.strokeStyle = hexA(c.color, on ? (light ? 0.22 : 0.16) : 0.04);
        ctx.beginPath();
        ctx.moveTo(rootX, rootY);
        ctx.bezierCurveTo(rootX, rootY - h * 0.35, X(c.x), Y(c.y) + c.R * scale * 1.6, X(c.x), Y(c.y));
        ctx.stroke();
      }
      // crown glow
      for (const c of crowns) {
        const on = !focus || focus === c.id;
        const g = ctx.createRadialGradient(X(c.x), Y(c.y), 0, X(c.x), Y(c.y), c.R * scale * 1.5);
        g.addColorStop(0, hexA(c.color, on ? (light ? 0.16 : 0.13) : 0.03));
        g.addColorStop(1, hexA(c.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(X(c.x), Y(c.y), c.R * scale * 1.5, 0, 6.283);
        ctx.fill();
      }
      // points
      const big = pts.length > 4000;
      for (const p of pts) {
        const dx = still ? 0 : Math.sin(t * 0.0005 + p.ph) * 0.9;
        const dy = still ? 0 : Math.cos(t * 0.0004 + p.ph * 1.3) * 0.9;
        const x = X(p.x) + dx, y = Y(p.y) + dy;
        const inFocus = !focus || branches[p.c].id === focus;
        const hit = p.row ? (match ? match.has(p.row.i) : true) : false;
        const a = !p.row ? 0.18 : !inFocus ? 0.07 : match && !hit ? 0.1 : 0.95;
        ctx.fillStyle = p === hover ? `rgba(${ink},1)` : hexA(colors[p.c], a);
        const r = p === hover ? p.r + 2 : match && hit ? p.r + 0.6 : p.r;
        if (big) ctx.fillRect(x - r, y - r, r * 2, r * 2);
        else { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
      }
      // labels: biggest crowns first; a label that would collide waits until its crown is focused
      ctx.textAlign = "center";
      ctx.font = `500 10px ${font}`;
      const placed: number[][] = [];
      for (const c of byCount) {
        const on = !focus || focus === c.id;
        const label = spaced(`${c.name.toUpperCase()}  ${c.n}`);
        const lw = ctx.measureText(label).width, lx = Math.min(w - lw / 2 - 10, Math.max(lw / 2 + 10, X(c.x))), ly = Y(c.y) - c.R * scale - 8;
        const r = [lx - lw / 2 - 6, ly - 10, lx + lw / 2 + 6, ly + 4];
        const clash = placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
        if (clash && focus !== c.id) continue;
        placed.push(r);
        ctx.lineWidth = 4;
        ctx.strokeStyle = light ? "rgba(217,217,219,.85)" : "rgba(13,13,14,.85)";
        ctx.strokeText(label, lx, ly);
        ctx.fillStyle = `rgba(${ink},${on ? 0.62 : 0.18})`;
        ctx.fillText(label, lx, ly);
      }
      if (!still && visible) raf = requestAnimationFrame(draw);
    };

    const pick = () => {
      let best: Pt | null = null, bd = 14 * 14;
      for (const p of pts) {
        if (!p.row) continue;
        const d = (ox + p.x * scale * sx + px - mx) ** 2 + (oy + p.y * scale + py - my) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      hover = best;
      canvas.style.cursor = best ? "pointer" : "default";
      const el = tip.current!;
      if (best?.row) {
        el.style.display = "block";
        el.style.left = `${ox + best.x * scale * sx + px}px`;
        el.style.top = `${oy + best.y * scale + py}px`;
        el.innerHTML = `<b>${esc(best.row.n)}</b><span class="mono muted">${esc(best.row.h)}</span>`;
      } else el.style.display = "none";
      if (still) draw(0);
    };

    const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; pick(); };
    const onLeave = () => { mx = my = -1e4; hover = null; tip.current!.style.display = "none"; if (still) draw(0); };
    const onClick = () => { if (hover?.row) router.push(`/${hover.row.i}`); };
    const onTheme = () => { light = document.documentElement.dataset.theme === "light"; if (still) draw(0); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !still) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); } });
    const ro = new ResizeObserver(() => { fit(); if (still) draw(0); });

    fit();
    ro.observe(canvas); io.observe(canvas);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("click", onClick);
    window.addEventListener("themechange", onTheme);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("themechange", onTheme);
    };
  }, [rows, branches, router]);

  return (
    <>
      <canvas ref={ref} aria-label="A map of every link in the library, grouped by branch" role="img" />
      <div ref={tip} className="field-tip" style={{ display: "none" }} />
    </>
  );
}

const spaced = (s: string) => s.split("").join(String.fromCharCode(8202));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
