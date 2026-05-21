// Decorations rendered around a node during dive: three gyroscopic rings + a
// one-shot particle burst that fades out.

"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import gsap from "gsap";
import type { LayoutNode } from "./Constellation";

interface Props {
  node: LayoutNode;
}

const RING_RADII = [1.8, 2.3, 2.8];
const RING_THICKNESS = [0.08, 0.06, 0.04];

export default function DiveDecor({ node }: Props) {
  const ringMatsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const ringMeshesRef = useRef<THREE.Mesh[]>([]);
  const groupRef = useRef<THREE.Group>(null);
  const burstGeoRef = useRef<THREE.BufferGeometry>(null);
  const burstMatRef = useRef<THREE.PointsMaterial>(null);
  const burstVelRef = useRef<THREE.Vector3[]>([]);
  const burstTimeRef = useRef(0);

  // Initial scale = small (pops in)
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.scale.setScalar(0.1);
    gsap.to(groupRef.current.scale, {
      x: node.size,
      y: node.size,
      z: node.size,
      duration: 1.4,
      ease: "elastic.out(1, 0.7)",
    });
    ringMatsRef.current.forEach((m) => {
      m.opacity = 0;
      gsap.to(m, { opacity: 0.85, duration: 1, ease: "power2.out" });
    });
    // Reset burst
    burstTimeRef.current = 0;
    if (burstMatRef.current) burstMatRef.current.opacity = 1;
    if (burstGeoRef.current) {
      const arr = burstGeoRef.current.attributes.position.array as Float32Array;
      arr.fill(0);
      burstGeoRef.current.attributes.position.needsUpdate = true;
    }
    return () => {
      gsap.killTweensOf(groupRef.current?.scale ?? {});
      ringMatsRef.current.forEach((m) => gsap.killTweensOf(m));
    };
  }, [node]);

  // Burst velocity vectors (computed once)
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
    // Rotate the rings
    const meshes = ringMeshesRef.current;
    if (meshes[0]) { meshes[0].rotation.x += 0.018; meshes[0].rotation.y += 0.012; }
    if (meshes[1]) { meshes[1].rotation.y -= 0.015; meshes[1].rotation.z += 0.018; }
    if (meshes[2]) { meshes[2].rotation.x -= 0.012; meshes[2].rotation.z -= 0.015; }

    // Burst animation
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
    <group position={node.position}>
      <group ref={groupRef}>
        {RING_RADII.map((r, i) => (
          <mesh
            key={i}
            ref={(m) => {
              if (m) ringMeshesRef.current[i] = m;
            }}
            rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]}
          >
            <torusGeometry args={[r, RING_THICKNESS[i], 16, 64]} />
            <meshBasicMaterial
              ref={(m) => {
                if (m) ringMatsRef.current[i] = m;
              }}
              color={color}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Particle burst */}
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
  );
}
