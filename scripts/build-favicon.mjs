// Generates public/favicon.ico from the canonical tree-mark SVG.
//
// Why this exists: Safari iOS, the Google iOS app, older Edge, and many
// in-app browsers auto-request /favicon.ico regardless of any <link>
// tags Next.js advertises. Without a real file at that path, they fall
// back to whatever's in their cache — for us, that's the default Vercel
// triangle the project shipped with for one week, now cached for the
// life of the cache.
//
// We can't generate favicon.ico via Next.js's app/favicon.ico file
// convention (it must be a literal binary). So we generate it once at
// build time from the same SVG that powers app/icon.tsx and
// app/apple-icon.tsx — keeps the three variants visually identical.
//
// Multi-resolution ICO (16/32/48) so Windows taskbar, browser tabs,
// bookmarks bars, and Spotlight search all pick the right size.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const OUT_PATH = join(PUBLIC_DIR, "favicon.ico");

// Same node-tree silhouette as app/icon.tsx and app/apple-icon.tsx.
// Includes a rounded dark background that reads against light browser
// chrome (e.g. Chrome's light-mode tab strip) without the cyan getting
// lost.
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" ry="7" fill="#030508"/>
  <g stroke="#00f3ff" stroke-linecap="round" fill="none">
    <line x1="16" y1="29" x2="16" y2="14" stroke-width="1.6" opacity="0.7"/>
    <line x1="16" y1="20" x2="9" y2="13" stroke-width="1.6" opacity="0.6"/>
    <line x1="16" y1="20" x2="23" y2="13" stroke-width="1.6" opacity="0.6"/>
    <line x1="16" y1="14" x2="11" y2="8" stroke-width="1.4" opacity="0.5"/>
    <line x1="16" y1="14" x2="21" y2="8" stroke-width="1.4" opacity="0.5"/>
  </g>
  <g fill="#00f3ff">
    <circle cx="16" cy="14" r="1.7"/>
    <circle cx="16" cy="20" r="1.5" opacity="0.95"/>
    <circle cx="9" cy="13" r="1.6" opacity="0.95"/>
    <circle cx="23" cy="13" r="1.6" opacity="0.95"/>
    <circle cx="11" cy="8" r="1.4" opacity="0.88"/>
    <circle cx="21" cy="8" r="1.4" opacity="0.88"/>
    <circle cx="16" cy="3.5" r="2.0"/>
  </g>
</svg>`;

const svgBuffer = Buffer.from(SVG);

// 16/32/48 covers tab favicon, taskbar, bookmarks bar, and large list views.
// Skipping 64/128 — they're overkill for the .ico container and the
// 180×180 apple-icon already covers high-DPI home screens.
const sizes = [16, 32, 48];

const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(svgBuffer, { density: 384 }) // higher density renders crisper at small sizes
      .resize(size, size)
      .png()
      .toBuffer(),
  ),
);

const icoBuffer = await pngToIco(pngBuffers);

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, icoBuffer);

console.log(`[build-favicon] Wrote ${OUT_PATH} (${icoBuffer.length} bytes, ${sizes.length} sizes)`);

// ---------- iOS legacy fallback paths ----------
// iPad Safari and a few in-app webviews auto-request these conventional
// paths at the site root REGARDLESS of any <link rel="apple-touch-icon">
// tag in HTML. With /apple-icon (Next.js's generated route) advertised
// via the link tag they SHOULD find the modern icon, but in practice
// iPadOS's WebKit has cached the missing-file 404 from before our
// favicon shipped and is refusing to re-check. Putting real files at
// these literal paths kills that fallback path forever.
//
// /apple-touch-icon.png            — default Apple convention
// /apple-touch-icon-precomposed.png — same image, signals "don't add
//                                     iOS's gloss overlay" (precomposed)
// /apple-touch-icon-180x180.png    — size-suffixed variant some
//                                     Safaris look for first
const appleSize = 180;
const appleBuffer = await sharp(svgBuffer, { density: 480 })
  .resize(appleSize, appleSize)
  .png()
  .toBuffer();

const appleAliases = [
  "apple-touch-icon.png",
  "apple-touch-icon-precomposed.png",
  `apple-touch-icon-${appleSize}x${appleSize}.png`,
];
for (const name of appleAliases) {
  const p = join(PUBLIC_DIR, name);
  await writeFile(p, appleBuffer);
  console.log(`[build-favicon] Wrote ${p} (${appleBuffer.length} bytes)`);
}
