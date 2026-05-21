// The actual 3D constellation: nodes (trunk, categories, subcategories, entries)
// connected by plexus lines, with glow via the parent Scene's Bloom postprocess.
//
// Performance notes:
//   - All entry nodes use one InstancedMesh (one draw call).
//   - Categories + subcategories are individual meshes (fewer of them, varied colors).
//   - Lines are one BufferGeometry of merged LineSegments.

"use client";

import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";

export interface LayoutNode {
  id: string;
  kind: "trunk" | "category" | "subcategory" | "entry";
  name?: string;
  color: string;
  featured?: boolean;
  gem?: boolean;
  parentId?: string | null;
  position: [number, number, number];
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

export default function Constellation({ nodes, links, onSelectEntry, selectedId }: Props) {
  const categoryNodes = useMemo(() => nodes.filter((n) => n.kind === "category"), [nodes]);
  const subcategoryNodes = useMemo(() => nodes.filter((n) => n.kind === "subcategory"), [nodes]);
  const entryNodes = useMemo(() => nodes.filter((n) => n.kind === "entry"), [nodes]);
  const trunkNode = useMemo(() => nodes.find((n) => n.kind === "trunk"), [nodes]);

  const nodeById = useMemo(() => {
    const map = new Map<string, LayoutNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  // --- Lines (plexus) ---
  const lineGeometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    for (const link of links) {
      const a = nodeById.get(link.source);
      const b = nodeById.get(link.target);
      if (!a || !b) continue;
      positions.push(...a.position, ...b.position);
      const ac = new THREE.Color(a.color);
      const bc = new THREE.Color(b.color);
      colors.push(ac.r, ac.g, ac.b, bc.r, bc.g, bc.b);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geom;
  }, [links, nodeById]);

  // --- Entries: InstancedMesh ---
  const instancedRef = useRef<THREE.InstancedMesh>(null!);
  const entryMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        emissiveIntensity: 1.4,
        roughness: 0.4,
        metalness: 0,
      }),
    []
  );

  useMemo(() => {
    if (!instancedRef.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < entryNodes.length; i++) {
      const n = entryNodes[i];
      dummy.position.fromArray(n.position);
      const scale = n.featured ? 1.6 : n.gem ? 1.2 : 0.85;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      instancedRef.current.setMatrixAt(i, dummy.matrix);
      color.set(n.color);
      instancedRef.current.setColorAt(i, color);
    }
    instancedRef.current.instanceMatrix.needsUpdate = true;
    if (instancedRef.current.instanceColor) instancedRef.current.instanceColor.needsUpdate = true;
  }, [entryNodes]);

  // Subtle scene-wide rotation so the whole tree feels alive
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.02;
  });

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hovered = hoveredId ? nodeById.get(hoveredId) : null;

  return (
    <group ref={groupRef}>
      {/* Plexus lines */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Trunk: small glowing core */}
      {trunkNode ? (
        <mesh position={trunkNode.position}>
          <sphereGeometry args={[3, 32, 32]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ) : null}

      {/* Category anchors */}
      {categoryNodes.map((n) => (
        <mesh
          key={n.id}
          position={n.position}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredId(n.id);
          }}
          onPointerOut={() => setHoveredId(null)}
        >
          <sphereGeometry args={[3.5, 24, 24]} />
          <meshStandardMaterial
            color={n.color}
            emissive={n.color}
            emissiveIntensity={2.5}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Subcategory anchors */}
      {subcategoryNodes.map((n) => (
        <mesh
          key={n.id}
          position={n.position}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredId(n.id);
          }}
          onPointerOut={() => setHoveredId(null)}
        >
          <sphereGeometry args={[1.8, 16, 16]} />
          <meshStandardMaterial
            color={n.color}
            emissive={n.color}
            emissiveIntensity={1.8}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Entries: InstancedMesh */}
      <instancedMesh
        ref={instancedRef}
        args={[undefined, undefined, entryNodes.length]}
        material={entryMaterial}
        onPointerOver={(e) => {
          e.stopPropagation();
          const id = entryNodes[e.instanceId ?? 0]?.id;
          if (id) setHoveredId(id);
        }}
        onPointerOut={() => setHoveredId(null)}
        onClick={(e) => {
          e.stopPropagation();
          const id = entryNodes[e.instanceId ?? 0]?.id;
          if (id) onSelectEntry(id);
        }}
      >
        <sphereGeometry args={[1, 12, 12]} />
      </instancedMesh>

      {/* Hover label */}
      {hovered ? (
        <Html
          position={hovered.position}
          center
          distanceFactor={120}
          style={{
            pointerEvents: "none",
            color: "white",
            fontSize: "12px",
            background: "rgba(10,10,20,0.85)",
            padding: "4px 10px",
            borderRadius: "6px",
            border: `1px solid ${hovered.color}`,
            whiteSpace: "nowrap",
            transform: "translate(0, -24px)",
          }}
        >
          {hovered.name ?? hovered.id}
        </Html>
      ) : null}

      {/* Selected highlight ring */}
      {selectedId ? (() => {
        const sel = nodeById.get(selectedId);
        if (!sel) return null;
        return (
          <mesh position={sel.position}>
            <ringGeometry args={[2.5, 3.0, 32]} />
            <meshBasicMaterial color={sel.color} side={THREE.DoubleSide} transparent opacity={0.7} />
          </mesh>
        );
      })() : null}
    </group>
  );
}
