// R3F Canvas wrapper for the Neural Arbor tree.
// Movement: free-flight (WASD + drag-to-look + R/F up/down + scroll boost).
// Selection: auto-lock to the nearest interactive node (no pixel-precise clicking).

"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { FlyControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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

// Background ambient dust — sparse drifting specks (visual depth only).
function Dust() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 500;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 500;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 500;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    return arr;
  }, []);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.015;
      ref.current.rotation.x = state.clock.elapsedTime * 0.008;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#3a4a66"
        size={1.2}
        transparent
        opacity={0.3}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// Scroll wheel boosts forward/back along camera's look direction.
function ScrollBoost() {
  const { camera, gl } = useThree();
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const boost = -e.deltaY * 0.08;
      camera.position.addScaledVector(forward, boost);
    };
    const el = gl.domElement;
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [camera, gl]);
  return null;
}

// Two-finger pinch zoom for touch — also handles two-finger drag as forward thrust.
function TouchPinchZoom() {
  const { camera, gl } = useThree();
  useEffect(() => {
    let lastDist: number | null = null;
    const distance = (touches: TouchList) => {
      if (touches.length < 2) return null;
      const a = touches[0];
      const b = touches[1];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const d = distance(e.touches);
        if (d != null && lastDist != null) {
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          camera.position.addScaledVector(forward, (d - lastDist) * 0.2);
        }
        lastDist = d;
        e.preventDefault();
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) lastDist = null;
    };
    const el = gl.domElement;
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [camera, gl]);
  return null;
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
        camera={{ position: [0, 15, 95], fov: 60, near: 0.1, far: 2000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#030508"]} />
        <fogExp2 attach="fog" args={["#030508", 0.0025]} />
        <Suspense fallback={null}>
          <Dust />
          <Constellation
            nodes={library.layout.nodes}
            links={library.layout.links}
            onSelectEntry={setSelectedId}
          />
        </Suspense>
        <FlyControls
          movementSpeed={18}
          rollSpeed={0.6}
          dragToLook
          autoForward={false}
        />
        <ScrollBoost />
        <TouchPinchZoom />
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
