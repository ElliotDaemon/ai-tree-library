// Shared canvas-texture factory for the liquid-glass ring used by both
// HoverRing (Constellation) and DiveDecor.
//
// Renders a thin glassy ring with:
//   - a soft outer halo that fades into the void
//   - a bright shine arc (the "glint") covering ~45° at the top so the
//     ring reads as a curved glass surface catching light
//   - a faint inner rim highlight
//
// Drawn in pure white + alpha; tinting is done at runtime via the
// spriteMaterial's `color` prop so the ring matches each node's hue.
//
// Sprite-based, so the ring is BILLBOARDED — it always faces the camera
// regardless of how the tree rotates in 3D space, which is what the user
// asked for. Animating `material.rotation` over time sweeps the shine arc
// around the ring without breaking the billboard.

import * as THREE from "three";

let cachedRing: THREE.CanvasTexture | null = null;

export function createRingTexture(): THREE.CanvasTexture {
  if (cachedRing) return cachedRing;

  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const ringOuter = 102;
  const ringInner = 92;
  const ringMid = (ringOuter + ringInner) / 2;
  const ringWidth = ringOuter - ringInner;

  ctx.clearRect(0, 0, size, size);

  // --- Outer halo: soft glow extending past the ring's outer edge ---
  const outerGrad = ctx.createRadialGradient(cx, cy, ringOuter - 2, cx, cy, ringOuter + 24);
  outerGrad.addColorStop(0, "rgba(255,255,255,0.55)");
  outerGrad.addColorStop(0.55, "rgba(255,255,255,0.12)");
  outerGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, ringOuter + 24, 0, Math.PI * 2);
  ctx.fill();

  // --- Cut out the inside so the center is fully transparent (glass) ---
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, ringInner, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // --- Main ring body: low-alpha "glass" tube ---
  ctx.lineWidth = ringWidth;
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.beginPath();
  ctx.arc(cx, cy, ringMid, 0, Math.PI * 2);
  ctx.stroke();

  // --- Inner edge highlight (catches light, makes it feel like glass) ---
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(cx, cy, ringInner + 1.5, 0, Math.PI * 2);
  ctx.stroke();

  // --- Outer edge highlight (thinner, more subtle) ---
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.arc(cx, cy, ringOuter - 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // --- Shine arc: bright crescent that sweeps a ~45° wedge of the ring ---
  // This is the part that animates via material.rotation, creating the
  // "specular highlight slides around the glass" effect.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = "round";

  // Soft wide underlay
  ctx.lineWidth = ringWidth + 2;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(0, 0, ringMid, -Math.PI / 8, Math.PI / 8);
  ctx.stroke();

  // Bright narrow core
  ctx.lineWidth = ringWidth - 2;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(0, 0, ringMid, -Math.PI / 14, Math.PI / 14);
  ctx.stroke();
  ctx.restore();

  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  t.colorSpace = THREE.SRGBColorSpace;
  cachedRing = t;
  return t;
}
