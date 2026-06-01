// Per-article Open Graph image. 1200×630 PNG generated on demand by Vercel
// and cached at the edge.
//
// Functions as TWO things at once:
//   1. The social-share card (Twitter / LinkedIn / Slack previews)
//   2. The hero image at the top of the live article page itself
//      (the article template references the same /article/[slug]/opengraph-image
//      URL inside an <img> tag — single source of truth, one render per build)
//
// Visual: title in large Spectral over a constellation backdrop tinted by
// the article's `coverTint` (cyan / purple / pink / gold). Each article
// gets a unique-but-stable arrangement seeded by article.id so the hero
// is consistent for every visitor and across reloads.

import { ImageResponse } from "next/og";
import { findArticleBySlug, formatArticleDate } from "../../../lib/articles";

export const alt = "AI Tree Library article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ---------- Constellation backdrop (mirrors per-tool OG) ----------

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

const TINT_RGB: Record<string, [number, number, number]> = {
  cyan: [0, 243, 255],
  purple: [167, 139, 250],
  pink: [240, 171, 252],
  gold: [252, 211, 77],
};

const TINT_HEX: Record<string, string> = {
  cyan: "#00f3ff",
  purple: "#a78bfa",
  pink: "#f0abfc",
  gold: "#fcd34d",
};

function gradientColor(y: number, accent: [number, number, number]): [number, number, number] {
  const root: [number, number, number] = [112, 0, 255];
  const trunk: [number, number, number] = [0, 243, 255];
  const canopy: [number, number, number] = [255, 0, 170];
  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
  const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
  const base: [number, number, number] =
    y < -10
      ? mix(root, trunk, Math.max(0, Math.min(1, (y + 65) / 55)))
      : mix(trunk, canopy, Math.max(0, Math.min(1, (y + 10) / 85)));
  return mix(base, accent, 0.4);
}

export default async function ArticleOG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await findArticleBySlug(slug);
  if (!article) {
    return fallbackImage("AI Tree Library Articles");
  }

  const tintKey = TINT_RGB[article.coverTint] ? article.coverTint : "cyan";
  const accent = TINT_RGB[tintKey];
  const accentHex = TINT_HEX[tintKey];

  // Seed the constellation by article.id — every article gets its own
  // stable arrangement of dots that doesn't change between visits.
  const seed = parseInt((article.id || "").replace(/-/g, "").slice(0, 8), 16) || 0x9e3779b1;
  const rnd = mkRnd(seed);

  const dots: Array<{ cx: number; cy: number; r: number; rgb: [number, number, number]; alpha: number }> = [];
  for (let i = 0; i < 850; i++) {
    const y = rnd() * 140 - 65;
    const baseR = treeRadius(y);
    const r2 = baseR * Math.pow(rnd(), 0.6);
    const theta = rnd() * Math.PI * 2;
    const x = r2 * Math.cos(theta) + (rnd() - 0.5) * 4;
    const noisedY = y + (rnd() - 0.5) * 4;
    // Position the tree toward the right third so the title block has room
    const cx = 880 + x * 4.6;
    const cy = 315 - noisedY * 3.4;
    if (cy < -20 || cy > 660 || cx < -20 || cx > 1220) continue;
    const rgb = gradientColor(noisedY, accent);
    const sz = rnd() * 2.4 + 0.55;
    const prominent = rnd() > 0.94;
    dots.push({
      cx,
      cy,
      r: prominent ? sz + 2 : sz,
      rgb,
      alpha: prominent ? 0.95 : 0.55 + rnd() * 0.3,
    });
  }

  const title = article.title || "Untitled";
  const excerpt = (article.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 170);
  const date = formatArticleDate(article.publishedDate);
  const titleFontSize = title.length > 50 ? 56 : title.length > 28 ? 68 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          background:
            `radial-gradient(ellipse at 25% 20%, rgba(${accent.join(",")}, 0.14), transparent 55%),` +
            `radial-gradient(ellipse at 78% 85%, rgba(${accent.join(",")}, 0.08), transparent 55%),` +
            `radial-gradient(ellipse at 60% 50%, rgba(255, 0, 170, 0.04), transparent 70%),` +
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

        {/* Left vignette so the title block reads cleanly over the constellation */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(3, 5, 8, 0.85) 0%, rgba(3, 5, 8, 0.55) 40%, rgba(3, 5, 8, 0.0) 70%)",
          }}
        />

        {/* Text column */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 740,
            height: 630,
            padding: "60px 56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Top: brand mark + tag eyebrow */}
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
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
                AI TREE LIBRARY · ARTICLES
              </div>
            </div>

            {/* Tags eyebrow */}
            {article.tags.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: 14,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  color: accentHex,
                  fontWeight: 500,
                }}
              >
                {article.tags.slice(0, 3).map((t, i) => (
                  <span key={i} style={{ display: "flex" }}>
                    {i > 0 ? <span style={{ color: "rgba(255,255,255,0.2)", marginRight: 12 }}>·</span> : null}
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Middle: title + excerpt */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                color: "#ffffff",
                fontSize: titleFontSize,
                fontWeight: 700,
                lineHeight: 1.04,
                letterSpacing: -1.5,
                display: "flex",
                fontFamily: "Georgia, Times New Roman, serif",
              }}
            >
              {title}
            </div>
            {excerpt ? (
              <div
                style={{
                  color: "rgba(200, 215, 235, 0.78)",
                  fontSize: 22,
                  fontWeight: 400,
                  fontStyle: "italic",
                  letterSpacing: 0.3,
                  lineHeight: 1.45,
                  display: "flex",
                  fontFamily: "Georgia, Times New Roman, serif",
                }}
              >
                {excerpt}
              </div>
            ) : null}
          </div>

          {/* Bottom: byline */}
          <div
            style={{
              display: "flex",
              gap: 14,
              fontSize: 14,
              color: "rgba(200, 220, 240, 0.65)",
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "rgba(220, 232, 248, 0.95)" }}>{article.author}</span>
            {date ? (
              <>
                <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
                <span>{date}</span>
              </>
            ) : null}
            <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
            <span>{article.readingTimeMinutes} MIN READ</span>
          </div>
        </div>

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
    { ...size },
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
    { ...size },
  );
}
