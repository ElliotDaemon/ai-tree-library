// Per-tool Open Graph image. 1200×630 PNG rendered on demand by Vercel.
// Same tree backdrop as the global OG, but the text block is the specific
// tool: name, category, rarity, lede sentence.

import { ImageResponse } from "next/og";
import { findEntryBySlug, findCategoryById, topLevelOf, rarityMeta } from "../../lib/library";

export const alt = "AI Tree Library tool page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function treeRadius(y: number) {
  if (y < -45) return 8 + Math.pow(-45 - y, 1.4) * 1.2;
  if (y < 10) return Math.max(2, 6 - (y + 45) * 0.05);
  if (y < 55) return 3 + Math.pow(y - 10, 1.2) * 1.1;
  const maxR = 3 + Math.pow(45, 1.2) * 1.1;
  const t = ((y - 55) * Math.PI) / 40;
  return Math.max(0.1, maxR * Math.cos(t));
}

function mkRnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function gradientColor(y: number, accent?: [number, number, number]): [number, number, number] {
  const root: [number, number, number] = [112, 0, 255];
  const trunk: [number, number, number] = [0, 243, 255];
  const canopy: [number, number, number] = [255, 0, 170];
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
  let base: [number, number, number];
  if (y < -10) base = mix(root, trunk, Math.max(0, Math.min(1, (y + 65) / 55)));
  else base = mix(trunk, canopy, Math.max(0, Math.min(1, (y + 10) / 85)));
  if (accent) return mix(base, accent, 0.35);
  return base;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length !== 6) return [255, 255, 255];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = await findEntryBySlug(slug);
  if (!entry) {
    // Fallback image (just the global brand)
    return fallbackImage("AI Tree Library");
  }
  const category = entry.categoryId ? await findCategoryById(entry.categoryId) : null;
  const topLevel = category ? await topLevelOf(category) : null;
  const accentHex = topLevel?.color || "#00f3ff";
  const accent = hexToRgb(accentHex);
  const rarity = rarityMeta(entry.rarity);

  // Seed by entry.id so the constellation behind the text is unique per tool
  const seed = parseInt((entry.id || "").replace(/-/g, "").slice(0, 8), 16) || 0x9e3779b1;
  const rnd = mkRnd(seed);

  const dots: Array<{ cx: number; cy: number; r: number; rgb: [number, number, number]; alpha: number }> = [];
  for (let i = 0; i < 750; i++) {
    const y = rnd() * 140 - 65;
    const baseR = treeRadius(y);
    const r2 = baseR * Math.pow(rnd(), 0.6);
    const theta = rnd() * Math.PI * 2;
    const x = r2 * Math.cos(theta) + (rnd() - 0.5) * 4;
    const noisedY = y + (rnd() - 0.5) * 4;
    const cx = 760 + x * 5.2;
    const cy = 360 - noisedY * 3.4;
    if (cy < -20 || cy > 660 || cx < -20 || cx > 1220) continue;
    const rgb = gradientColor(noisedY, accent);
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

  const lede = (entry.description || `${entry.name} — curated in the AI Tree Library.`)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 130);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          background:
            `radial-gradient(ellipse at 25% 20%, rgba(${accent.join(",")}, 0.12), transparent 55%),` +
            `radial-gradient(ellipse at 78% 85%, rgba(${accent.join(",")}, 0.08), transparent 55%),` +
            `radial-gradient(ellipse at 60% 50%, rgba(255, 0, 170, 0.05), transparent 70%),` +
            `#030508`,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <svg width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }}>
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

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 600,
            height: 630,
            padding: "60px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Top: brand mark */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width={32} height={32} viewBox="0 0 32 32" fill="none" stroke="#00f3ff" strokeWidth={1.3}>
              <line x1="16" y1="29" x2="16" y2="14" opacity="0.55" />
              <line x1="16" y1="20" x2="9" y2="13" opacity="0.5" />
              <line x1="16" y1="20" x2="23" y2="13" opacity="0.5" />
              <circle cx="16" cy="14" r="1.6" fill="#00f3ff" stroke="none" />
              <circle cx="16" cy="3" r="1.8" fill="#00f3ff" stroke="none" />
            </svg>
            <div
              style={{
                color: "#ffffff",
                fontSize: 16,
                letterSpacing: 6,
                fontWeight: 300,
                display: "flex",
              }}
            >
              AI TREE LIBRARY
            </div>
          </div>

          {/* Middle: tool card */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {topLevel ? (
              <div
                style={{
                  display: "inline-flex",
                  alignSelf: "flex-start",
                  fontSize: 14,
                  letterSpacing: 3,
                  padding: "5px 14px",
                  border: `1px solid ${accentHex}`,
                  borderRadius: 999,
                  color: accentHex,
                  textTransform: "uppercase",
                  background: `rgba(${accent.join(",")}, 0.08)`,
                }}
              >
                {topLevel.name}
              </div>
            ) : null}
            <div
              style={{
                color: "#ffffff",
                fontSize: entry.name.length > 18 ? 60 : 72,
                fontWeight: 200,
                lineHeight: 1.02,
                letterSpacing: -1.5,
                display: "flex",
                gap: 14,
                alignItems: "baseline",
              }}
            >
              {(entry.rarity || "").includes("Legendary") ? (
                <span style={{ fontSize: 38, marginRight: 4 }}>👑</span>
              ) : null}
              {entry.name}
            </div>
            <div
              style={{
                color: "rgba(160, 180, 210, 0.78)",
                fontSize: 18,
                fontWeight: 400,
                letterSpacing: 0.3,
                lineHeight: 1.45,
                display: "flex",
              }}
            >
              {lede}
            </div>
          </div>

          {/* Bottom: meta + URL */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 14, fontSize: 13, color: "rgba(200, 220, 240, 0.7)", letterSpacing: 1.5 }}>
              <span style={{ color: accentHex }}>{rarity.icon} {rarity.label.toUpperCase()}</span>
              <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
              <span>{entry.type.toUpperCase()}</span>
              {entry.pricing && entry.pricing !== "Unknown" ? (
                <>
                  <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
                  <span>{entry.pricing.toUpperCase()}</span>
                </>
              ) : null}
            </div>
            <div
              style={{
                color: accentHex,
                fontSize: 18,
                letterSpacing: 4,
                fontWeight: 400,
                display: "flex",
              }}
            >
              AITREELIBRARY.COM/{slug.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Left-side vignette so text reads cleanly */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(3, 5, 8, 0.78) 0%, rgba(3, 5, 8, 0.0) 50%)",
          }}
        />

        {/* Copyright corner */}
        <div
          style={{
            position: "absolute",
            bottom: 18,
            right: 24,
            color: "rgba(180, 200, 220, 0.32)",
            fontSize: 11,
            letterSpacing: 2.5,
            display: "flex",
          }}
        >
          © AI TREE LIBRARY ®
        </div>
      </div>
    ),
    { ...size }
  );
}

function fallbackImage(title: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#030508",
          color: "#ffffff",
          fontSize: 56,
          fontWeight: 200,
          letterSpacing: 4,
        }}
      >
        {title}
      </div>
    ),
    { ...size }
  );
}
