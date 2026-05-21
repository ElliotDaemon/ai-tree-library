// R3F Canvas wrapper for the Neural Arbor tree.
// Background dust, FogExp2, auto-rotate, custom-shader particle cloud.
// No EffectComposer/Bloom — the glow comes from the per-particle radial texture
// + additive blending in Constellation.tsx.

"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Constellation, { type LayoutNode, type LayoutLink } from "./Constellation";
import DetailPanel from "./DetailPanel";

interface LibraryFile {
  generatedAt: string;
  entries: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    description: string;
    categoryId: string | null;
    tags: string[];
    pricing: string;
    featured: boolean;
    gem: boolean;
    logoUrl: string;
    source: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string;
    isTopLevel: boolean;
  }>;
  layout: { nodes: LayoutNode[]; links: LayoutLink[] };
}

interface Props {
  library: LibraryFile;
}

// Background ambient dust — 800 faint specks drifting around the tree.
function Dust() {
  const ref = useRef<THREE.Points>(null);
  const { positions } = useMemo(() => {
    const count = 800;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 400;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 400;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    return { positions: arr };
  }, []);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.02;
      ref.current.rotation.x = state.clock.elapsedTime * 0.01;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#445577"
        size={1.5}
        transparent
        opacity={0.35}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export default function Scene({ library }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entryById = useMemo(() => {
    const m = new Map<string, LibraryFile["entries"][number]>();
    for (const e of library.entries) m.set(e.id, e);
    return m;
  }, [library.entries]);

  const categoryById = useMemo(() => {
    const m = new Map<string, LibraryFile["categories"][number]>();
    for (const c of library.categories) m.set(c.id, c);
    return m;
  }, [library.categories]);

  const selected = selectedId ? entryById.get(selectedId) ?? null : null;
  const selectedCategory = selected?.categoryId ? categoryById.get(selected.categoryId) ?? null : null;

  return (
    <>
      <Canvas
        camera={{ position: [0, 30, 180], fov: 60, near: 0.1, far: 1000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#030508"]} />
        <fogExp2 attach="fog" args={["#030508", 0.003]} />
        <Suspense fallback={null}>
          <Dust />
          <Constellation
            nodes={library.layout.nodes}
            links={library.layout.links}
            onSelectEntry={setSelectedId}
            selectedId={selectedId}
          />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          autoRotate
          autoRotateSpeed={0.5}
          minDistance={20}
          maxDistance={350}
          target={[0, 10, 0]}
        />
      </Canvas>
      {selected ? (
        <DetailPanel
          entry={selected}
          category={selectedCategory ?? null}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </>
  );
}
