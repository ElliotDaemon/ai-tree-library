// The tree in three dimensions. Pure arithmetic, stable for any library size:
//   crowns  → packed outward from the biggest one on a Fibonacci sphere, squashed into a dome above the trunk
//   links   → a Fibonacci ball inside their crown (radius ∝ ∛j, so density stays even)
//   trunk   → one curve per crown from a shared root below
import { GOLDEN } from "./canopy";

export interface Row3 { i: string; b: string; s: string; f?: 1; g?: 1 }
export interface Branch3 { id: string; name: string; color: string }
export interface Crown3 { id: string; name: string; color: string; x: number; y: number; z: number; R: number; n: number; idx: number }

export function layout3d<R extends Row3>(rows: R[], branches: Branch3[]) {
  const by = new Map<string, R[]>(branches.map((b) => [b.id, []]));
  for (const r of rows) by.get(r.b)?.push(r);
  // within a crown, keep each sub-branch together so neighbours are related
  for (const list of by.values()) list.sort((a, z) => a.s.localeCompare(z.s));

  const crowns: Crown3[] = [];
  const order = branches.map((b, idx) => ({ b, idx, list: by.get(b.id) || [] })).sort((a, z) => z.list.length - a.list.length || a.idx - z.idx);
  for (const { b, idx, list } of order) {
    const n = list.length;
    const R = 1.6 * Math.cbrt(n + 8);
    let x = 0, y = 0, z = 0;
    if (crowns.length) {
      for (let k = 1; k < 40000; k++) {
        const rho = 1.15 * Math.cbrt(k);
        const t = k * GOLDEN;
        const v = 1 - ((k * 0.618034) % 1) * 2; // low-discrepancy height in [-1, 1]
        const ring = Math.sqrt(1 - v * v);
        x = Math.cos(t) * ring * rho * 1.35;
        z = Math.sin(t) * ring * rho * 1.35;
        y = v * rho * 0.62;
        if (crowns.every((c) => Math.hypot(c.x - x, c.y - y, c.z - z) > c.R + R + 1.6)) break;
      }
    }
    crowns.push({ id: b.id, name: b.name, color: b.color, x, y, z, R, n, idx });
  }

  const pos: number[] = [], rows3: (R | null)[] = [], crownOf: number[] = [];
  for (const c of crowns) {
    const list = by.get(c.id) || [];
    const count = list.length || 10; // empty branches keep a faint seed
    for (let j = 0; j < count; j++) {
      const r = c.R * 0.92 * Math.cbrt((j + 0.5) / count);
      const v = 1 - (2 * (j + 0.5)) / count;
      const ring = Math.sqrt(1 - v * v);
      const t = j * GOLDEN;
      pos.push(c.x + Math.cos(t) * ring * r, c.y + v * r, c.z + Math.sin(t) * ring * r);
      rows3.push(list.length ? list[j] : null);
      crownOf.push(crowns.indexOf(c));
    }
  }

  let minY = Infinity, maxR = 0;
  for (const c of crowns) { minY = Math.min(minY, c.y - c.R); maxR = Math.max(maxR, Math.hypot(c.x, c.z) + c.R); }
  const root = { x: 0, y: minY - Math.max(10, maxR * 0.9), z: 0 };
  return { crowns, pos: new Float32Array(pos), rows: rows3, crownOf, root, radius: maxR };
}
