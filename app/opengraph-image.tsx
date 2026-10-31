// Share image (1200×630): the same canopy the home page draws, from the live library, beside the line.
import { ImageResponse } from "next/og";
import { layout } from "@/lib/canopy";
import { loadLibrary } from "@/lib/library";
import { markDataUri } from "@/lib/mark";
import { BRANCHES, branchColor } from "@/lib/taxonomy.mjs";

export const alt = "AI Tree Library — the open library of the useful internet";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  const lib = await loadLibrary();
  const branches = BRANCHES.map((b) => ({ id: b.id, name: b.name, color: branchColor(b.id) }));
  const { pts, box } = layout(lib.map((e) => ({ i: e.id, b: e.branch, ...(e.featured ? { f: 1 as const } : {}) })), branches);
  // fit the canopy into the right half
  const W = 600, H = 470, ox = 560, oy = 70;
  const s = Math.min(W / (box.maxX - box.minX), H / (box.maxY - box.minY));
  const cx = ox + W / 2 - ((box.minX + box.maxX) / 2) * s, cy = oy + H / 2 - ((box.minY + box.maxY) / 2) * s;
  const dots = pts
    .map((p) => `<circle cx="${(cx + p.x * s).toFixed(1)}" cy="${(cy + p.y * s).toFixed(1)}" r="${(p.row ? p.r * 1.25 : 1.2).toFixed(1)}" fill="${branches[p.c].color}" opacity="${p.row ? 0.95 : 0.25}"/>`)
    .join("");
  const trunk = branches
    .map((_, bi) => pts.find((p) => p.c === bi))
    .filter(Boolean)
    .map((p) => `<path d="M${ox + W / 2} 700 C ${ox + W / 2} 520, ${(cx + p!.x * s).toFixed(1)} ${(cy + p!.y * s + 90).toFixed(1)}, ${(cx + p!.x * s).toFixed(1)} ${(cy + p!.y * s).toFixed(1)}" stroke="${branches[p!.c].color}" stroke-opacity=".18" fill="none"/>`)
    .join("");
  const field = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">${trunk}${dots}</svg>`).toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(180deg, #161618 0%, #0b0b0c 100%)", color: "#f2f2f0", fontFamily: "sans-serif", position: "relative" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={field} width={1200} height={630} style={{ position: "absolute", left: 0, top: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 60px 72px", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img src={markDataUri({ size: 56 })} width={56} height={56} />
            <span style={{ fontSize: 18, letterSpacing: 6, textTransform: "uppercase", fontWeight: 600 }}>AI Tree Library</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 68, lineHeight: 1.02, letterSpacing: -2.5, fontWeight: 700 }}>The open library of the useful internet</div>
            <div style={{ fontSize: 24, color: "#9c9c9a", marginTop: 22, lineHeight: 1.4 }}>Websites, AI tools, apps and extensions. Found by people, approved by a person.</div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 18, color: "#9c9c9a" }}>
            <span style={{ padding: "8px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)" }}>{lib.length ? `${lib.length.toLocaleString("en")} links` : "Open source"}</span>
            <span style={{ padding: "8px 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,.14)" }}>{BRANCHES.length} branches</span>
            <span style={{ padding: "8px 18px", borderRadius: 999, background: "#3987e5", color: "#fff" }}>aitreelibrary.com</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
