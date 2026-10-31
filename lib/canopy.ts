// The canopy layout, shared by the live Field and the share image.
// Pure arithmetic: branches packed outward on a wide golden spiral, links in sunflower phyllotaxis inside them.
export interface CanopyRow { i: string; b: string; f?: 1; g?: 1 }
export interface CanopyBranch { id: string; name: string; color: string }
export interface Pt<R = CanopyRow> { x: number; y: number; r: number; c: number; row: R | null; ph: number }
export interface Crown { id: string; name: string; color: string; x: number; y: number; R: number; n: number }

export const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export function layout<R extends CanopyRow>(rows: R[], branches: CanopyBranch[]) {
  const unit = 1;
  const by = new Map<string, R[]>(branches.map((b) => [b.id, []]));
  for (const r of rows) by.get(r.b)?.push(r);
  const crowns: Crown[] = [];
  const pts: Pt<R>[] = [];
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

