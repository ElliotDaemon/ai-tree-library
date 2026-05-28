// Decorations rendered when a node is picked. Two parts:
//
//   1. AsteroidBelt — the picked-node indicator. Sparkling 3D particle
//      ring orbiting on a tilted plane. Replaces the previous billboarded
//      liquid-glass sprite rings per user feedback ("instead of a
//      transparent liquid glass circle that shines, let's just make it
//      like a sparkling 3D asteroid belt indicating we picked this node").
//
//   2. Particle burst — one-shot expanding cloud of particles in the
//      node's color, fading out over ~1.5s. Kept from the original
//      DiveDecor — it's the satisfying "POP!" the moment you commit to
//      a dive.

"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { LayoutNode } from "./Constellation";
import AsteroidBelt from "./AsteroidBelt";

interface Props {
  node: LayoutNode;
}

export default function DiveDecor({ node }: Props) {
  const burstGeoRef = useRef<THREE.BufferGeometry>(null);
  const burstMatRef = useRef<THREE.PointsMaterial>(null);
  const burstVelRef = useRef<THREE.Vector3[]>([]);
  const burstTimeRef = useRef(0);

  // Reset burst on each new dive target
  useEffect(() => {
    burstTimeRef.current = 0;
    if (burstMatRef.current) burstMatRef.current.opacity = 1;
    if (burstGeoRef.current) {
      const arr = burstGeoRef.current.attributes.position.array as Float32Array;
      arr.fill(0);
      burstGeoRef.current.attributes.position.needsUpdate = true;
    }
  }, [node]);

  // Per-particle velocity vectors (computed once)
  if (burstVelRef.current.length === 0) {
    const v: THREE.Vector3[] = [];
    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * 2;
      const y = (Math.random() - 0.5) * 2;
      const z = (Math.random() - 0.5) * 2;
      v.push(new THREE.Vector3(x, y, z).normalize().multiplyScalar(Math.random() * 0.8 + 0.2));
    }
    burstVelRef.current = v;
  }

  const burstPositions = useMemo(() => new Float32Array(100 * 3), []);

  useFrame(() => {
    if (burstMatRef.current && burstGeoRef.current && burstMatRef.current.opacity > 0) {
      burstTimeRef.current += 0.018;
      const arr = burstGeoRef.current.attributes.position.array as Float32Array;
      for (let i = 0; i < 100; i++) {
        arr[i * 3] += burstVelRef.current[i].x;
        arr[i * 3 + 1] += burstVelRef.current[i].y;
        arr[i * 3 + 2] += burstVelRef.current[i].z;
      }
      burstGeoRef.current.attributes.position.needsUpdate = true;
      burstMatRef.current.opacity = Math.max(0, 1 - burstTimeRef.current * 2.5);
    }
  });

  const color = new THREE.Color(node.color[0], node.color[1], node.color[2]);

  return (
    <>
      {/* The persistent selection indicator */}
      <AsteroidBelt node={node} />

      {/* One-shot particle burst at the picked node's center */}
      <group position={node.position}>
        <points>
          <bufferGeometry ref={burstGeoRef}>
            <bufferAttribute attach="attributes-position" args={[burstPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={burstMatRef}
            color={color}
            size={1.6}
            transparent
            opacity={1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      </group>
    </>
  );
}
