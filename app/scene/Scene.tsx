// Top-level R3F Canvas wrapper for the constellation.
// Client-only (uses WebGL). Imported via next/dynamic with ssr:false from page.tsx.

"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Suspense, useMemo, useState } from "react";
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

export default function Scene({ library }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entryById = useMemo(() => {
    const map = new Map<string, LibraryFile["entries"][number]>();
    for (const e of library.entries) map.set(e.id, e);
    return map;
  }, [library.entries]);

  const categoryById = useMemo(() => {
    const map = new Map<string, LibraryFile["categories"][number]>();
    for (const c of library.categories) map.set(c.id, c);
    return map;
  }, [library.categories]);

  const selected = selectedId ? (entryById.get(selectedId) ?? null) : null;
  const selectedCategory = selected?.categoryId ? categoryById.get(selected.categoryId) : null;

  return (
    <>
      <Canvas
        camera={{ position: [180, 80, 220], fov: 50, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#050510"]} />
        <fog attach="fog" args={["#050510", 200, 800]} />
        <ambientLight intensity={0.2} />
        <Suspense fallback={null}>
          <Stars radius={400} depth={80} count={1500} factor={3} fade speed={0.5} />
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
          autoRotateSpeed={0.15}
          minDistance={40}
          maxDistance={500}
        />
        <EffectComposer multisampling={0}>
          <Bloom intensity={1.4} luminanceThreshold={0.2} luminanceSmoothing={0.9} mipmapBlur />
        </EffectComposer>
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
