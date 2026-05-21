// Tree-shaped point cloud constellation (Neural Arbor visual).
// Particles are positioned at build time (see scripts/fetch-content.mjs)
// and rendered via a custom ShaderMaterial for per-particle glow.

"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";

export interface LayoutNode {
  id: string;
  kind: "trunk" | "category" | "subcategory" | "entry" | "ambient";
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
  onSelectEntry: (id: string) => void;
  selectedId: string | null;
}

// Generates a radial glow texture (matches the reference design's gradient)
function makeGlowTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const VERTEX_SHADER = /* glsl */ `
attribute float size;
attribute vec3 color;
varying vec3 vColor;
void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * (320.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D pointTexture;
varying vec3 vColor;
void main() {
  vec4 tex = texture2D(pointTexture, gl_PointCoord);
  gl_FragColor = vec4(vColor, 1.0) * tex;
  if (gl_FragColor.a < 0.02) discard;
}
`;

export default function Constellation({ nodes, links, onSelectEntry, selectedId }: Props) {
  const { gl } = useThree();

  // --- One-time particle attribute buffers ---
  const { positionsArr, colorsArr, sizesArr, interactiveLookup } = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    const lookup: Array<LayoutNode | null> = new Array(nodes.length).fill(null);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      positions[i * 3] = n.position[0];
      positions[i * 3 + 1] = n.position[1];
      positions[i * 3 + 2] = n.position[2];
      colors[i * 3] = n.color[0];
      colors[i * 3 + 1] = n.color[1];
      colors[i * 3 + 2] = n.color[2];
      sizes[i] = n.size;
      // Only entries / categories / subcategories are interactive
      if (n.kind === "entry" || n.kind === "category" || n.kind === "subcategory") {
        lookup[i] = n;
      }
    }
    return { positionsArr: positions, colorsArr: colors, sizesArr: sizes, interactiveLookup: lookup };
  }, [nodes]);

  // --- Plexus line buffer (vertex colors blend between endpoints) ---
  const { linePositions, lineColors } = useMemo(() => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const pos: number[] = [];
    const col: number[] = [];
    for (const link of links) {
      const a = nodeById.get(link.source);
      const b = nodeById.get(link.target);
      if (!a || !b) continue;
      pos.push(a.position[0], a.position[1], a.position[2], b.position[0], b.position[1], b.position[2]);
      col.push(a.color[0], a.color[1], a.color[2], b.color[0], b.color[1], b.color[2]);
    }
    return { linePositions: new Float32Array(pos), lineColors: new Float32Array(col) };
  }, [links, nodes]);

  const shaderUniforms = useMemo(
    () => ({ pointTexture: { value: makeGlowTexture() } }),
    []
  );

  const treeGroupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const raycaster = useMemo(() => {
    const r = new THREE.Raycaster();
    // Generous threshold — tree particles are sparse in screen-space; this
    // makes nodes easier to click without making ambient particles steal hits
    // (we filter by kind in the picker).
    r.params.Points = { threshold: 4.0 };
    return r;
  }, []);

  const { camera, pointer } = useThree();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Subtle floating animation for the whole tree (matches reference)
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (treeGroupRef.current) {
      treeGroupRef.current.position.y = Math.sin(t * 0.5) * 1.6;
    }
    // Per-frame raycast to find hovered interactive particle.
    // We scan ALL hits (not just the first) so ambient particles in the
    // foreground don't block clicks on interactive nodes behind them.
    if (pointsRef.current) {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(pointsRef.current);
      let foundId: string | null = null;
      let bestDistance = Infinity;
      for (const hit of hits) {
        const idx = hit.index ?? -1;
        const candidate = interactiveLookup[idx];
        if (!candidate) continue;
        // Prefer the closest interactive hit (by distance to camera ray)
        const d = hit.distanceToRay ?? hit.distance;
        if (d < bestDistance) {
          bestDistance = d;
          foundId = candidate.id;
        }
      }
      if (foundId !== hoveredId) setHoveredId(foundId);
    }
  });

  const hoveredNode = hoveredId ? nodes.find((n) => n.id === hoveredId) : null;
  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;

  // Side effect: cursor pointer on hover of clickable nodes
  useMemo(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = hoveredId ? "pointer" : "default";
  }, [hoveredId]);

  return (
    <group ref={treeGroupRef}>
      {/* Plexus lines */}
      {linePositions.length > 0 ? (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>
      ) : null}

      {/* The particle cloud */}
      <points
        ref={pointsRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          // Use the currently hovered interactive node (from the per-frame
          // raycast) rather than e.index — e.index can land on a nearby
          // ambient particle inside the generous threshold.
          if (hoveredId) {
            const n = nodes.find((x) => x.id === hoveredId);
            if (n && n.kind === "entry") {
              onSelectEntry(n.id);
            }
          }
        }}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positionsArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colorsArr, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizesArr, 1]} />
        </bufferGeometry>
        <shaderMaterial
          args={[
            {
              uniforms: shaderUniforms,
              vertexShader: VERTEX_SHADER,
              fragmentShader: FRAGMENT_SHADER,
              transparent: true,
              depthTest: false,
              blending: THREE.AdditiveBlending,
            },
          ]}
        />
      </points>

      {/* Hover tooltip — only for interactive nodes with a name */}
      {hoveredNode && hoveredNode.name ? (
        <Html
          position={hoveredNode.position}
          center
          distanceFactor={140}
          style={{ pointerEvents: "none" }}
        >
          <div className="ne-tooltip">
            <div className="ne-tooltip-name">{hoveredNode.name}</div>
            <div className="ne-tooltip-status">
              {hoveredNode.kind === "entry"
                ? hoveredNode.featured
                  ? "FEATURED NODE"
                  : hoveredNode.gem
                  ? "HIDDEN GEM"
                  : "ACTIVE DATA NODE"
                : hoveredNode.kind === "category"
                ? "CATEGORY BRANCH"
                : "SUBCATEGORY"}
            </div>
          </div>
        </Html>
      ) : null}

      {/* Selection ring */}
      {selectedNode ? (
        <mesh position={selectedNode.position}>
          <ringGeometry args={[selectedNode.size * 1.3, selectedNode.size * 1.55, 32]} />
          <meshBasicMaterial
            color={
              new THREE.Color(
                selectedNode.color[0],
                selectedNode.color[1],
                selectedNode.color[2]
              )
            }
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}
