// Tree-shaped point cloud + auto-lock targeting.
// Each frame finds the interactive node closest to the camera; that node
// gets the highlight ring + tooltip. Clicking anywhere opens its detail.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
}

// Radial-gradient glow texture (per-particle soft sprite)
function makeGlowTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.3)");
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

const LOCK_RADIUS = 35; // units; how close camera needs to be to start locking to a node

export default function Constellation({ nodes, links, onSelectEntry }: Props) {
  const { camera, gl } = useThree();

  // Particle attribute buffers
  const { positionsArr, colorsArr, sizesArr, interactiveNodes } = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    const interactive: LayoutNode[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      positions[i * 3] = n.position[0];
      positions[i * 3 + 1] = n.position[1];
      positions[i * 3 + 2] = n.position[2];
      colors[i * 3] = n.color[0];
      colors[i * 3 + 1] = n.color[1];
      colors[i * 3 + 2] = n.color[2];
      sizes[i] = n.size;
      if (n.kind === "entry" || n.kind === "category" || n.kind === "subcategory") {
        interactive.push(n);
      }
    }
    return { positionsArr: positions, colorsArr: colors, sizesArr: sizes, interactiveNodes: interactive };
  }, [nodes]);

  // Plexus line buffer
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

  const [lockedId, setLockedId] = useState<string | null>(null);
  const lockedRef = useRef<string | null>(null);
  lockedRef.current = lockedId;

  // Per-frame: find nearest interactive node to camera (within LOCK_RADIUS).
  // We weight slightly toward what's in front of the camera so flying past
  // a node feels intuitive — the next-forward one takes over earlier than
  // strict Euclidean distance would suggest.
  useFrame(() => {
    const cp = camera.position;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    let best: LayoutNode | null = null;
    let bestScore = Infinity;
    for (const n of interactiveNodes) {
      const dx = n.position[0] - cp.x;
      const dy = n.position[1] - cp.y;
      const dz = n.position[2] - cp.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > LOCK_RADIUS) continue;
      // Forward dot product: positive = in front of camera
      const forwardDot = (dx * forward.x + dy * forward.y + dz * forward.z) / Math.max(dist, 0.001);
      // Score: distance penalized by how far behind it is
      const behindPenalty = forwardDot < 0 ? 8 : 0;
      const score = dist + behindPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    const newId = best?.id ?? null;
    if (newId !== lockedRef.current) setLockedId(newId);
  });

  // Click anywhere → if locked on an entry, open it
  useEffect(() => {
    const el = gl.domElement;
    const handler = () => {
      const id = lockedRef.current;
      if (!id) return;
      const n = interactiveNodes.find((x) => x.id === id);
      if (n && n.kind === "entry") onSelectEntry(n.id);
    };
    // Use click rather than pointerdown so it doesn't fire during drag-to-look
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [gl, interactiveNodes, onSelectEntry]);

  const lockedNode = lockedId ? interactiveNodes.find((n) => n.id === lockedId) ?? null : null;

  // Cursor feedback
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = lockedNode?.kind === "entry" ? "pointer" : "default";
  }, [lockedNode]);

  return (
    <group>
      {/* Plexus lines (very faint, just adds depth) */}
      {linePositions.length > 0 ? (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            vertexColors
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </lineSegments>
      ) : null}

      {/* Particle cloud */}
      <points>
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

      {/* Locked tooltip */}
      {lockedNode && lockedNode.name ? (
        <Html
          position={lockedNode.position}
          center
          distanceFactor={140}
          style={{ pointerEvents: "none" }}
        >
          <div className="ne-tooltip">
            <div className="ne-tooltip-name">{lockedNode.name}</div>
            <div className="ne-tooltip-status">
              {lockedNode.kind === "entry"
                ? lockedNode.featured
                  ? "FEATURED · CLICK TO OPEN"
                  : lockedNode.gem
                  ? "HIDDEN GEM · CLICK TO OPEN"
                  : "CLICK TO OPEN"
                : lockedNode.kind === "category"
                ? "CATEGORY"
                : "SUBCATEGORY"}
            </div>
          </div>
        </Html>
      ) : null}

      {/* Selection ring on locked node */}
      {lockedNode ? (
        <SelectionRing node={lockedNode} />
      ) : null}
    </group>
  );
}

function SelectionRing({ node }: { node: LayoutNode }) {
  const ringRef = useRef<THREE.Mesh>(null);
  // Pulse the ring scale subtly
  useFrame((state) => {
    if (ringRef.current) {
      const s = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
      ringRef.current.scale.setScalar(s);
    }
  });
  return (
    <mesh ref={ringRef} position={node.position}>
      <ringGeometry args={[node.size * 1.4, node.size * 1.65, 32]} />
      <meshBasicMaterial
        color={new THREE.Color(node.color[0], node.color[1], node.color[2])}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}
