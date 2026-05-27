// Particle cloud — pure data, no filler. Three line kinds rendered separately:
//   - backbone   (cat→subcat→entry): brightest, opacity 0.35
//   - cluster    (intra-subcat star constellation): medium, opacity 0.18
//   - tag-bridge (cross-subcat shared-tag): faintest, opacity 0.08
//
// Filter mask (visibleIds): when active, only entries/categories whose id is in
// the set are rendered. Filler/non-matching nodes vanish entirely.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { createRingTexture } from "./ringTexture";

export interface LayoutNode {
  id: string;
  kind: "trunk" | "category" | "subcategory" | "entry" | "filler";
  name?: string;
  color: [number, number, number];
  rawColor?: string | null;
  featured?: boolean;
  gem?: boolean;
  rarity?: "legendary" | "established" | "rare" | "gem" | null;
  parentId?: string | null;
  position: [number, number, number];
  size: number;
}

export interface LayoutLink {
  source: string;
  target: string;
  kind: string; // backbone | cluster | tag-bridge | proximity (legacy)
}

interface Props {
  nodes: LayoutNode[];
  links: LayoutLink[];
  onNodeClick: (node: LayoutNode) => void;
  onHoverNodeChange: (node: LayoutNode | null) => void;
  divedNodeId: string | null;
  bobActive: boolean;
  visibleIds: Set<string> | null; // null = show everything
  highlightIds: Set<string> | null; // null = no special highlight
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

const VS = /* glsl */ `
attribute float size;
attribute vec3 color;
attribute float alpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = color;
  vAlpha = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (350.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const FS = /* glsl */ `
uniform sampler2D pointTexture;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 tex = texture2D(pointTexture, gl_PointCoord);
  gl_FragColor = vec4(vColor, 1.0) * tex * vAlpha;
  if (gl_FragColor.a < 0.02) discard;
}
`;

export default function Constellation({
  nodes,
  links,
  onNodeClick,
  onHoverNodeChange,
  divedNodeId,
  bobActive,
  visibleIds,
  highlightIds,
}: Props) {
  const { gl, camera, pointer } = useThree();

  const nodeByIndex = useMemo(() => nodes, [nodes]);
  const nodeById = useMemo(() => {
    const m = new Map<string, LayoutNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Visibility resolution: any filter applied?
  const filterActive = visibleIds !== null;
  const highlightActive = highlightIds !== null;

  // Per-node alpha (filtered out = 0, dimmed = 0.18, highlighted = 1.0)
  const { positions, colors, sizes, alphas } = useMemo(() => {
    const p = new Float32Array(nodes.length * 3);
    const c = new Float32Array(nodes.length * 3);
    const s = new Float32Array(nodes.length);
    const a = new Float32Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      p[i * 3] = n.position[0]; p[i * 3 + 1] = n.position[1]; p[i * 3 + 2] = n.position[2];
      c[i * 3] = n.color[0]; c[i * 3 + 1] = n.color[1]; c[i * 3 + 2] = n.color[2];
      s[i] = n.size;

      let alpha = 1;
      // Trunk: always invisible (it's just a logical anchor)
      if (n.kind === "trunk") alpha = 0;
      else if (filterActive) {
        alpha = visibleIds!.has(n.id) ? 1 : 0;
      } else if (highlightActive) {
        alpha = highlightIds!.has(n.id) ? 1 : 0.22;
      }
      a[i] = alpha;
    }
    return { positions: p, colors: c, sizes: s, alphas: a };
  }, [nodes, visibleIds, highlightIds, filterActive, highlightActive]);

  // --- Lines: one combined mesh, Gemini-style. The "plexus" links carry
  // the dense web between all particles. Backbone is rendered on top with
  // slightly higher opacity so hierarchy still reads. ---
  const lineSets = useMemo(() => {
    const plexus: { pos: number[]; col: number[] } = { pos: [], col: [] };
    const backbone: { pos: number[]; col: number[] } = { pos: [], col: [] };
    for (const link of links) {
      const a = nodeById.get(link.source);
      const b = nodeById.get(link.target);
      if (!a || !b) continue;
      if (a.kind === "trunk" || b.kind === "trunk") continue;
      if (filterActive) {
        if (!visibleIds!.has(a.id) || !visibleIds!.has(b.id)) continue;
      }
      const target = link.kind === "backbone" ? backbone : plexus;
      target.pos.push(a.position[0], a.position[1], a.position[2], b.position[0], b.position[1], b.position[2]);
      target.col.push(a.color[0], a.color[1], a.color[2], b.color[0], b.color[1], b.color[2]);
    }
    return {
      plexus: { pos: new Float32Array(plexus.pos), col: new Float32Array(plexus.col) },
      backbone: { pos: new Float32Array(backbone.pos), col: new Float32Array(backbone.col) },
    };
  }, [links, nodeById, visibleIds, filterActive]);

  const uniforms = useMemo(() => ({ pointTexture: { value: makeGlowTexture() } }), []);
  const pointsRef = useRef<THREE.Points>(null);
  const treeGroupRef = useRef<THREE.Group>(null);

  const raycaster = useMemo(() => {
    const r = new THREE.Raycaster();
    r.params.Points = { threshold: 2.5 };
    return r;
  }, []);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // R3F's `pointer` defaults to (0, 0) NDC = the center of the canvas, so on
  // mount the raycaster would fire from screen-center and "hover" whichever
  // node sits at the tree's center — visible on mobile as a phantom tooltip
  // appearing top-left before the user has touched anything. Gate the
  // raycast on a real pointer interaction (move OR press) having happened.
  const pointerActiveRef = useRef(false);

  useEffect(() => {
    const el = gl.domElement;
    const mark = () => { pointerActiveRef.current = true; };
    el.addEventListener("pointermove", mark, { passive: true });
    el.addEventListener("pointerdown", mark, { passive: true });
    return () => {
      el.removeEventListener("pointermove", mark);
      el.removeEventListener("pointerdown", mark);
    };
  }, [gl]);

  useFrame((s) => {
    if (treeGroupRef.current) {
      treeGroupRef.current.position.y = bobActive ? Math.sin(s.clock.elapsedTime * 0.5) * 1.4 : 0;
    }
    if (!pointsRef.current) return;
    // Skip hover-raycast until first real pointer interaction (fixes the
    // mobile mount glitch where a tooltip appears top-left for a node the
    // user never touched).
    if (!pointerActiveRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(pointsRef.current);
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const h of hits) {
      const i = h.index ?? -1;
      const n = nodeByIndex[i];
      if (!n) continue;
      if (n.kind === "filler" || n.kind === "trunk") continue;
      // Respect filter: can't hover filtered-out nodes
      if (filterActive && !visibleIds!.has(n.id)) continue;
      const d = h.distanceToRay ?? h.distance;
      if (d < bestDist) { bestDist = d; bestId = n.id; }
    }
    if (bestId !== hoveredId) {
      setHoveredId(bestId);
      onHoverNodeChange(bestId ? (nodeByIndex.find((n) => n.id === bestId) ?? null) : null);
    }
  });

  useEffect(() => {
    let downPos = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { downPos = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (moved > 5) return;
      if (!hoveredId) return;
      const node = nodeByIndex.find((n) => n.id === hoveredId);
      if (node) onNodeClick(node);
    };
    const el = gl.domElement;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [gl, hoveredId, nodeByIndex, onNodeClick]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = hoveredId ? "pointer" : "default";
  }, [hoveredId]);

  return (
    <group ref={treeGroupRef}>
      {/* Plexus web — all-particle proximity lines, the soul of the Neural Arbor look */}
      {lineSets.plexus.pos.length > 0 ? (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[lineSets.plexus.pos, 3]} />
            <bufferAttribute attach="attributes-color" args={[lineSets.plexus.col, 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
      ) : null}

      {/* Structural backbone — rendered on top with slightly higher opacity */}
      {lineSets.backbone.pos.length > 0 ? (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[lineSets.backbone.pos, 3]} />
            <bufferAttribute attach="attributes-color" args={[lineSets.backbone.col, 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
      ) : null}

      {/* Particle cloud (all nodes; per-vertex alpha hides filtered ones) */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-alpha" args={[alphas, 1]} />
        </bufferGeometry>
        <shaderMaterial
          args={[{
            uniforms,
            vertexShader: VS,
            fragmentShader: FS,
            transparent: true,
            depthTest: false,
            blending: THREE.AdditiveBlending,
          }]}
        />
      </points>

      {/* Rarity decorations (crowns / sparkles) intentionally removed — they
          added visual clutter on top of an already dense scene. Size + brightness
          already differentiate the tiers. */}

      {/* Hover ring */}
      {hoveredId && hoveredId !== divedNodeId ? (
        <HoverRing node={nodeByIndex.find((n) => n.id === hoveredId)!} />
      ) : null}
    </group>
  );
}

function RarityDecorations({ nodes, visibleIds }: { nodes: LayoutNode[]; visibleIds: Set<string> | null }) {
  const filterActive = visibleIds !== null;
  const legendaries = useMemo(() => nodes.filter((n) => n.kind === "entry" && n.rarity === "legendary" && (!filterActive || visibleIds!.has(n.id))), [nodes, visibleIds, filterActive]);
  const gems = useMemo(() => nodes.filter((n) => n.kind === "entry" && n.rarity === "gem" && (!filterActive || visibleIds!.has(n.id))), [nodes, visibleIds, filterActive]);

  const crownTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "#fde68a"); g.addColorStop(0.5, "#fbbf24"); g.addColorStop(1, "#f59e0b");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(8, 50); ctx.lineTo(8, 24); ctx.lineTo(20, 36); ctx.lineTo(32, 14);
    ctx.lineTo(44, 36); ctx.lineTo(56, 24); ctx.lineTo(56, 50); ctx.closePath();
    ctx.fill();
    ctx.fillRect(8, 50, 48, 6);
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(20, 30, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(32, 10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(44, 30, 2.5, 0, Math.PI * 2); ctx.fill();
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
  }, []);

  const sparkleTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 32; c.height = 32;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255, 235, 150, 1)");
    g.addColorStop(0.4, "rgba(255, 200, 80, 0.7)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }, []);

  const sparkleGroupRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!sparkleGroupRef.current) return;
    const t = s.clock.elapsedTime;
    for (let i = 0; i < sparkleGroupRef.current.children.length; i++) {
      const child = sparkleGroupRef.current.children[i];
      child.rotation.y = t * 0.8 + i * 0.7;
      child.rotation.x = t * 0.4 + i * 0.5;
    }
  });

  return (
    <>
      {legendaries.map((n) => (
        <sprite
          key={`crown-${n.id}`}
          position={[n.position[0], n.position[1] + n.size * 1.5, n.position[2]]}
          scale={[3.2, 3.2, 1]}
        >
          <spriteMaterial map={crownTexture} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      <group ref={sparkleGroupRef}>
        {gems.map((n) => (
          <group key={`gem-${n.id}`} position={n.position}>
            {[0, 1, 2].map((j) => {
              const r = n.size * 1.5;
              const ang = (j / 3) * Math.PI * 2;
              return (
                <sprite key={j} position={[Math.cos(ang) * r, Math.sin(ang) * r * 0.4, Math.sin(ang) * r]} scale={[0.9, 0.9, 1]}>
                  <spriteMaterial map={sparkleTexture} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                </sprite>
              );
            })}
          </group>
        ))}
      </group>
    </>
  );
}

// Billboarded liquid-glass ring shown around the currently-hovered node.
// Uses the shared ringTexture so the ring always faces the camera (it does
// NOT spin awkwardly with the scene like the previous flat ringGeometry).
// Slowly rotates the texture so the shine arc sweeps around the ring,
// giving the glass-catching-light feel the user asked for.
function HoverRing({ node }: { node: LayoutNode }) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const ringTexture = useMemo(() => createRingTexture(), []);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (spriteRef.current) {
      // Subtle pulse — much gentler than the dive rings
      const breath = 1 + Math.sin(t * 2.4) * 0.04;
      const base = node.size * 1.35;
      spriteRef.current.scale.set(base * breath, base * breath, 1);
    }
    if (matRef.current) {
      // Shine sweeps around the ring
      matRef.current.rotation = t * 0.5;
    }
  });

  const color = new THREE.Color(node.color[0], node.color[1], node.color[2]);

  return (
    <sprite ref={spriteRef} position={node.position}>
      <spriteMaterial
        ref={matRef}
        map={ringTexture}
        color={color}
        transparent
        opacity={0.75}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </sprite>
  );
}
