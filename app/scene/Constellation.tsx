// Particle cloud: bright "prominent" data nodes (entries + categories + subcats)
// mixed with dim filler particles for visual mass.
// - Pointer/raycast checks all hits, picks the first PROMINENT one (so filler
//   in the foreground doesn't block clicks).
// - Hovering a prominent node emits hover events up (for cursor-following tooltip).
// - Click on a prominent node calls onNodeClick (used to trigger dive).

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

export interface LayoutNode {
  id: string;
  kind: "category" | "subcategory" | "entry" | "filler";
  name?: string;
  color: [number, number, number];
  rawColor?: string | null;
  featured?: boolean;
  gem?: boolean;
  parentId?: string | null;
  position: [number, number, number];
  size: number;
}

export interface LayoutLink {
  source: string;
  target: string;
  kind: string;
}

interface Props {
  nodes: LayoutNode[];
  links: LayoutLink[];
  onNodeClick: (node: LayoutNode) => void;
  onHoverNodeChange: (node: LayoutNode | null) => void;
  divedNodeId: string | null;
  bobActive: boolean;
}

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

const VS = /* glsl */ `
attribute float size;
attribute vec3 color;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (350.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const FS = /* glsl */ `
uniform sampler2D pointTexture;
varying vec3 vColor;
void main() {
  vec4 tex = texture2D(pointTexture, gl_PointCoord);
  gl_FragColor = vec4(vColor, 1.0) * tex;
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
}: Props) {
  const { gl, camera, pointer } = useThree();

  // Map index → node (used by hover + click)
  const indexToNode = useMemo(() => nodes, [nodes]);

  // Position / color / size buffers
  const { positions, colors, sizes } = useMemo(() => {
    const p = new Float32Array(nodes.length * 3);
    const c = new Float32Array(nodes.length * 3);
    const s = new Float32Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      p[i * 3] = nodes[i].position[0];
      p[i * 3 + 1] = nodes[i].position[1];
      p[i * 3 + 2] = nodes[i].position[2];
      c[i * 3] = nodes[i].color[0];
      c[i * 3 + 1] = nodes[i].color[1];
      c[i * 3 + 2] = nodes[i].color[2];
      s[i] = nodes[i].size;
    }
    return { positions: p, colors: c, sizes: s };
  }, [nodes]);

  // Plexus line buffer
  const { linePos, lineCol } = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const pos: number[] = [];
    const col: number[] = [];
    for (const l of links) {
      const a = byId.get(l.source);
      const b = byId.get(l.target);
      if (!a || !b) continue;
      pos.push(a.position[0], a.position[1], a.position[2], b.position[0], b.position[1], b.position[2]);
      col.push(a.color[0], a.color[1], a.color[2], b.color[0], b.color[1], b.color[2]);
    }
    return { linePos: new Float32Array(pos), lineCol: new Float32Array(col) };
  }, [links, nodes]);

  const uniforms = useMemo(() => ({ pointTexture: { value: makeGlowTexture() } }), []);
  const pointsRef = useRef<THREE.Points>(null);
  const treeGroupRef = useRef<THREE.Group>(null);

  // Raycaster (wider threshold than default — clicks/hover are forgiving)
  const raycaster = useMemo(() => {
    const r = new THREE.Raycaster();
    r.params.Points = { threshold: 2.5 };
    return r;
  }, []);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useFrame((s) => {
    // Subtle floating animation
    if (treeGroupRef.current) {
      treeGroupRef.current.position.y = bobActive ? Math.sin(s.clock.elapsedTime * 0.5) * 1.4 : 0;
    }

    // Per-frame hover raycast
    if (!pointsRef.current) return;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(pointsRef.current);

    // Pick the closest PROMINENT hit (skip filler)
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const h of hits) {
      const i = h.index ?? -1;
      const node = indexToNode[i];
      if (!node) continue;
      if (node.kind === "filler") continue;
      const d = h.distanceToRay ?? h.distance;
      if (d < bestDist) {
        bestDist = d;
        bestId = node.id;
      }
    }
    if (bestId !== hoveredId) {
      setHoveredId(bestId);
      onHoverNodeChange(bestId ? indexToNode.find((n) => n.id === bestId) ?? null : null);
    }
  });

  // Click handler — uses the hover state (so foreground filler doesn't steal)
  useEffect(() => {
    let downPos = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => { downPos = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (moved > 5) return; // it was a drag, not a click
      if (!hoveredId) return;
      const node = indexToNode.find((n) => n.id === hoveredId);
      if (node) onNodeClick(node);
    };
    const el = gl.domElement;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [gl, hoveredId, indexToNode, onNodeClick]);

  // Cursor feedback
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = hoveredId ? "pointer" : "default";
  }, [hoveredId]);

  return (
    <group ref={treeGroupRef}>
      {/* Plexus lines */}
      {linePos.length > 0 ? (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePos, 3]} />
            <bufferAttribute attach="attributes-color" args={[lineCol, 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
      ) : null}

      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
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

      {/* Hover ring on the prominent node currently under the cursor (skip during dive) */}
      {hoveredId && hoveredId !== divedNodeId ? (
        <HoverRing node={indexToNode.find((n) => n.id === hoveredId)!} />
      ) : null}
    </group>
  );
}

function HoverRing({ node }: { node: LayoutNode }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) {
      const t = 1 + Math.sin(s.clock.elapsedTime * 3) * 0.06;
      ref.current.scale.setScalar(t);
    }
  });
  return (
    <mesh ref={ref} position={node.position}>
      <ringGeometry args={[node.size * 1.2, node.size * 1.4, 32]} />
      <meshBasicMaterial
        color={new THREE.Color(node.color[0], node.color[1], node.color[2])}
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}
