// Dynamic OG image for social-link unfurls (1200×630).
// Renders a static representation of the AI Tree constellation: a tree
// silhouette of glowing dots (sampled from the same treeRadius function
// the live scene uses) + brand mark + slogan + live stats from
// public/library.json.
//
// Next.js convention: this file is auto-wired to <meta property="og:image">
// and <meta name="twitter:image"> on every route. Vercel renders it on
// demand and social platforms cache the result.

import { ImageResponse } from "next/og";
import { promises as fs } from "node:fs";
import { join } from "node:path";

export const alt = "AI Tree Library — a 3D constellation of curated AI tools, design inspo & creative resources";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same tree silhouette as scripts/fetch-content.mjs
function treeRadius(y: number) {
  if (y < -45) return 8 + Math.pow(-45 - y, 1.4) * 1.2;
  if (y < 10) return Math.max(2, 6 - (y + 45) * 0.05);
  if (y < 55) return 3 + Math.pow(y - 10, 1.2) * 1.1;
  const maxR = 3 + Math.pow(45, 1.2) * 1.1;
  const t = ((y - 55) * Math.PI) / 40;
  return Math.max(0.1, maxR * Math.cos(t));
}

// Deterministic PRNG — identical tree across renders/caches.
function mkRnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function gradientColor(y: number): [number, number, number] {
  const root: [number, number, number] = [112, 0, 255];
  const trunk: [number, number, number] = [0, 243, 255];
  const canopy: [number, number, number] = [255, 0, 170];
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
  if (y < -10) return mix(root, trunk, Math.max(0, Math.min(1, (y + 65) / 55)));
  return mix(trunk, canopy, Math.max(0, Math.min(1, (y + 10) / 85)));
}

interface Stats { entries: number; topLevel: number; categories: number; gems: number; featured: number }

async function loadStats(): Promise<Stats | null> {
  try {
    const raw = await fs.readFile(join(process.cwd(), "public", "library.json"), "utf8");
    const lib = JSON.parse(raw);
    return lib.stats ?? null;
  } catch {
    return null;
  }
}

export default async function OGImage() {
  const stats = await loadStats();

  // Generate ~700 dots sampled inside the tree silhouette. Project to 2D.
  const rnd = mkRnd(0x9e3779b1);
  const dots: Array<{ cx: number; cy: number; r: number; rgb: [number, number, number]; alpha: number }> = [];

  for (let i = 0; i < 750; i++) {
    const y = rnd() * 140 - 65;
    const baseR = treeRadius(y);
    const r2 = baseR * Math.pow(rnd(), 0.6);
    const theta = rnd() * Math.PI * 2;
    const x = r2 * Math.cos(theta) + (rnd() - 0.5) * 4;
    const noisedY = y + (rnd() - 0.5) * 4;
    // Map scene-space (~-65..75 vertical, ~-40..40 horizontal) → image-space (1200×630)
    // Center the tree slightly right of center so the brand text fits on the left.
    const cx = 760 + x * 5.2;
    const cy = 360 - noisedY * 3.4;
    if (cy < -20 || cy > 660 || cx < -20 || cx > 1220) continue;
    const rgb = gradientColor(noisedY);
    const size = rnd() * 2.5 + 0.6;
    const prominent = rnd() > 0.94;
    dots.push({
      cx,
      cy,
      r: prominent ? size + 2 : size,
      rgb,
      alpha: prominent ? 0.95 : 0.55 + rnd() * 0.3,
    });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          background:
            "radial-gradient(ellipse at 25% 20%, rgba(112, 0, 255, 0.16), transparent 55%)," +
            "radial-gradient(ellipse at 78% 85%, rgba(0, 243, 255, 0.08), transparent 55%)," +
            "radial-gradient(ellipse at 60% 50%, rgba(255, 0, 170, 0.05), transparent 70%)," +
            "#030508",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        {/* Tree of dots */}
        <svg
          width={1200}
          height={630}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          {dots.map((d, i) => (
            <circle
              key={i}
              cx={d.cx}
              cy={d.cy}
              r={d.r}
              fill={`rgb(${d.rgb[0].toFixed(0)}, ${d.rgb[1].toFixed(0)}, ${d.rgb[2].toFixed(0)})`}
              opacity={d.alpha}
            />
          ))}
        </svg>

        {/* Left-side text block */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 560,
            height: 630,
            padding: "64px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* Tree icon — same geometry as app/icon.svg */}
            <svg width={44} height={44} viewBox="0 0 32 32" fill="none" stroke="#00f3ff" strokeWidth={1.3}>
              <line x1="16" y1="29" x2="16" y2="14" opacity="0.55" />
              <line x1="16" y1="20" x2="9" y2="13" opacity="0.5" />
              <line x1="16" y1="20" x2="23" y2="13" opacity="0.5" />
              <line x1="16" y1="14" x2="11" y2="8" opacity="0.4" />
              <line x1="16" y1="14" x2="21" y2="8" opacity="0.4" />
              <line x1="11" y1="8" x2="8" y2="4" opacity="0.35" />
              <line x1="21" y1="8" x2="24" y2="4" opacity="0.35" />
              <circle cx="16" cy="14" r="1.6" fill="#00f3ff" stroke="none" />
              <circle cx="16" cy="20" r="1.4" fill="#00f3ff" stroke="none" />
              <circle cx="9" cy="13" r="1.5" fill="#00f3ff" stroke="none" />
              <circle cx="23" cy="13" r="1.5" fill="#00f3ff" stroke="none" />
              <circle cx="11" cy="8" r="1.3" fill="#00f3ff" stroke="none" />
              <circle cx="21" cy="8" r="1.3" fill="#00f3ff" stroke="none" />
              <circle cx="8" cy="4" r="1.1" fill="#00f3ff" stroke="none" />
              <circle cx="24" cy="4" r="1.1" fill="#00f3ff" stroke="none" />
              <circle cx="16" cy="3" r="1.8" fill="#00f3ff" stroke="none" />
            </svg>
            <div
              style={{
                color: "#ffffff",
                fontSize: 22,
                letterSpacing: 8,
                fontWeight: 300,
                display: "flex",
              }}
            >
              AI TREE LIBRARY
            </div>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                color: "#ffffff",
                fontSize: 64,
                fontWeight: 200,
                lineHeight: 1.05,
                letterSpacing: -1,
                display: "flex",
              }}
            >
              A living constellation of curated tools.
            </div>
            <div
              style={{
                color: "rgba(160, 180, 210, 0.78)",
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: 0.4,
                lineHeight: 1.4,
                display: "flex",
              }}
            >
              AI tools · design inspo · creative resources — explored in 3D.
            </div>
          </div>

          {/* Stats row + URL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {stats ? (
              <div style={{ display: "flex", gap: 16, fontSize: 15, color: "rgba(200, 220, 240, 0.7)", letterSpacing: 1.5 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ color: "#00f3ff", fontWeight: 600 }}>{stats.entries}</span>
                  <span>NODES</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.18)" }}>·</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ color: "#00f3ff", fontWeight: 600 }}>{stats.topLevel}</span>
                  <span>CATEGORIES</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.18)" }}>·</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ color: "#00f3ff", fontWeight: 600 }}>{stats.gems}</span>
                  <span>GEMS</span>
                </div>
              </div>
            ) : null}
            <div
              style={{
                color: "#00f3ff",
                fontSize: 18,
                letterSpacing: 4,
                fontWeight: 400,
                display: "flex",
              }}
            >
              AITREELIBRARY.COM
            </div>
          </div>
        </div>

        {/* Subtle vignette overlay for depth */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(3, 5, 8, 0.72) 0%, rgba(3, 5, 8, 0.0) 45%)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
