// The library's mark, as one SVG source for every size: a glass tile, a trunk that splits in three,
// and a crown of nodes with one accent. At larger sizes a small phyllotaxis canopy grows around the crown.
import { GOLDEN } from "./canopy";

const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#2f9e44", "#9085e9", "#e66767"];

export function markSvg({ size = 64, tile = "rounded", canopy = false }: { size?: number; tile?: "rounded" | "square" | "none"; canopy?: boolean } = {}) {
  const small = size <= 32;
  const sw = small ? 3.6 : canopy ? 1.8 : 2.4;
  const big = small ? 6 : canopy ? 3.6 : 5, side = small ? 5 : canopy ? 3 : 4.2; // heavier at small sizes so it never turns to mush
  const dots: string[] = [];
  if (canopy) {
    // a soft glow, then seeds spiralling out from the crown in the branch palette
    dots.push(`<defs><radialGradient id="glow"><stop offset="0" stop-color="#3987e5" stop-opacity=".32"/><stop offset="1" stop-color="#3987e5" stop-opacity="0"/></radialGradient></defs><ellipse cx="32" cy="21" rx="24" ry="15" fill="url(#glow)"/>`);
    for (let j = 1; j < 90; j++) {
      const r = 1.7 * Math.sqrt(j);
      const a = j * GOLDEN;
      const x = 32 + Math.cos(a) * r * 1.45;
      const y = 21 + Math.sin(a) * r * 0.82;
      if (y > 31 || Math.hypot((x - 32) / 1.45, (y - 21) / 0.82) < 5) continue;
      dots.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${(0.95 - j / 200).toFixed(2)}" fill="${SERIES[j % SERIES.length]}" opacity="${(1 - j / 130).toFixed(2)}"/>`);
    }
  }
  const bg =
    tile === "none"
      ? ""
      : `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#232325"/><stop offset="1" stop-color="#0b0b0c"/></linearGradient>
         <linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
         <rect width="64" height="64" rx="${tile === "rounded" ? 15 : 0}" fill="url(#g)"/>
         <rect x=".5" y=".5" width="63" height="63" rx="${tile === "rounded" ? 14.5 : 0}" fill="url(#h)" stroke="#fff" stroke-opacity=".12"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${bg}
    ${dots.join("")}
    <path d="M32 54V38M32 38 20 25M32 38 44 25M32 38V18" stroke="#f2f2f0" stroke-opacity=".55" stroke-width="${sw}" stroke-linecap="round" fill="none"/>
    <circle cx="32" cy="15" r="${big}" fill="#f2f2f0"/>
    <circle cx="18" cy="22.5" r="${side}" fill="#3987e5"/>
    <circle cx="46" cy="22.5" r="${side}" fill="#f2f2f0" fill-opacity=".8"/>
    <circle cx="32" cy="55" r="${small ? 3.4 : 2.6}" fill="#f2f2f0" fill-opacity=".45"/>
  </svg>`;
}

export const markDataUri = (o?: Parameters<typeof markSvg>[0]) => `data:image/svg+xml;base64,${Buffer.from(markSvg(o)).toString("base64")}`;
